const express = require('express');
const router = express.Router();
const { query, queryOne, run, saveDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('./auth');
const { validateUUID, isValidAmount, auditLog } = require('../middleware/security');

// Listar todas as transacoes
router.get('/', (req, res) => {
    try {
        const { limit = 50, offset = 0, type } = req.query;

        let sql = 'SELECT * FROM transactions';
        let params = [];

        if (type) {
            sql += ' WHERE type = ?';
            params.push(type);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const transactions = query(sql, params);

        res.json({
            success: true,
            data: transactions,
            count: transactions.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar transacao por ID
router.get('/:id', validateUUID('id'), (req, res) => {
    try {
        const transaction = queryOne('SELECT * FROM transactions WHERE id = ?', [req.params.id]);

        if (!transaction) {
            return res.status(404).json({ success: false, error: 'Transacao nao encontrada' });
        }

        res.json({ success: true, data: transaction });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Deposito (protegido)
router.post('/deposit', authenticateToken, (req, res) => {
    try {
        const { account_id, amount, description } = req.body;

        if (!account_id || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatorios: account_id, amount'
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'O valor do deposito deve ser maior que zero'
            });
        }

        const account = queryOne('SELECT * FROM accounts WHERE id = ? AND status = ?', [account_id, 'active']);

        if (!account) {
            return res.status(404).json({ success: false, error: 'Conta nao encontrada ou inativa' });
        }

        const transactionId = uuidv4();
        const newBalance = account.balance + amount;
        const now = new Date().toISOString();

        // Atualizar saldo
        run('UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?', [newBalance, now, account_id]);

        // Registrar transacao
        run(
            `INSERT INTO transactions (id, type, amount, description, destination_account_id, status, created_at)
       VALUES (?, 'deposit', ?, ?, ?, 'completed', ?)`,
            [transactionId, amount, description || 'Deposito em conta', account_id, now]
        );

        const transaction = queryOne('SELECT * FROM transactions WHERE id = ?', [transactionId]);

        // Broadcast update
        if (global.broadcast) {
            global.broadcast('DEPOSIT', { transaction, account_id, new_balance: newBalance });
        }

        res.status(201).json({
            success: true,
            data: {
                transaction,
                new_balance: newBalance,
                formatted_balance: `R$ ${newBalance.toFixed(2).replace('.', ',')}`
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Saque (protegido)
router.post('/withdraw', authenticateToken, (req, res) => {
    try {
        const { account_id, amount, description } = req.body;

        if (!account_id || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatorios: account_id, amount'
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'O valor do saque deve ser maior que zero'
            });
        }

        const account = queryOne('SELECT * FROM accounts WHERE id = ? AND status = ?', [account_id, 'active']);

        if (!account) {
            return res.status(404).json({ success: false, error: 'Conta nao encontrada ou inativa' });
        }

        if (account.balance < amount) {
            return res.status(400).json({
                success: false,
                error: 'Saldo insuficiente',
                available_balance: account.balance
            });
        }

        const transactionId = uuidv4();
        const newBalance = account.balance - amount;
        const now = new Date().toISOString();

        // Atualizar saldo
        run('UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?', [newBalance, now, account_id]);

        // Registrar transacao
        run(
            `INSERT INTO transactions (id, type, amount, description, source_account_id, status, created_at)
       VALUES (?, 'withdraw', ?, ?, ?, 'completed', ?)`,
            [transactionId, amount, description || 'Saque em conta', account_id, now]
        );

        const transaction = queryOne('SELECT * FROM transactions WHERE id = ?', [transactionId]);

        // Broadcast update
        if (global.broadcast) {
            global.broadcast('WITHDRAW', { transaction, account_id, new_balance: newBalance });
        }

        res.status(201).json({
            success: true,
            data: {
                transaction,
                new_balance: newBalance,
                formatted_balance: `R$ ${newBalance.toFixed(2).replace('.', ',')}`
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Transferencia (protegido)
router.post('/transfer', authenticateToken, (req, res) => {
    try {
        const { source_account_id, destination_account_id, amount, description } = req.body;

        if (!source_account_id || !destination_account_id || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatorios: source_account_id, destination_account_id, amount'
            });
        }

        if (source_account_id === destination_account_id) {
            return res.status(400).json({
                success: false,
                error: 'Conta de origem e destino nao podem ser iguais'
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'O valor da transferencia deve ser maior que zero'
            });
        }

        const sourceAccount = queryOne('SELECT * FROM accounts WHERE id = ? AND status = ?', [source_account_id, 'active']);
        const destAccount = queryOne('SELECT * FROM accounts WHERE id = ? AND status = ?', [destination_account_id, 'active']);

        if (!sourceAccount) {
            return res.status(404).json({ success: false, error: 'Conta de origem nao encontrada ou inativa' });
        }

        if (!destAccount) {
            return res.status(404).json({ success: false, error: 'Conta de destino nao encontrada ou inativa' });
        }

        if (sourceAccount.balance < amount) {
            return res.status(400).json({
                success: false,
                error: 'Saldo insuficiente',
                available_balance: sourceAccount.balance
            });
        }

        const transactionId = uuidv4();
        const sourceNewBalance = sourceAccount.balance - amount;
        const destNewBalance = destAccount.balance + amount;
        const now = new Date().toISOString();

        // Debitar da conta origem
        run('UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?', [sourceNewBalance, now, source_account_id]);

        // Creditar na conta destino
        run('UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?', [destNewBalance, now, destination_account_id]);

        // Registrar transacao
        run(
            `INSERT INTO transactions (id, type, amount, description, source_account_id, destination_account_id, status, created_at)
       VALUES (?, 'transfer', ?, ?, ?, ?, 'completed', ?)`,
            [transactionId, amount, description || 'Transferencia entre contas', source_account_id, destination_account_id, now]
        );

        const transaction = queryOne('SELECT * FROM transactions WHERE id = ?', [transactionId]);

        // Broadcast update
        if (global.broadcast) {
            global.broadcast('TRANSFER', { transaction, source_account_id, destination_account_id });
        }

        res.status(201).json({
            success: true,
            data: {
                transaction,
                source_account: {
                    id: source_account_id,
                    new_balance: sourceNewBalance,
                    formatted_balance: `R$ ${sourceNewBalance.toFixed(2).replace('.', ',')}`
                },
                destination_account: {
                    id: destination_account_id,
                    new_balance: destNewBalance,
                    formatted_balance: `R$ ${destNewBalance.toFixed(2).replace('.', ',')}`
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PIX (protegido)
router.post('/pix', authenticateToken, (req, res) => {
    try {
        const { source_account_id, destination_account_id, pix_key, amount, description } = req.body;

        if (!source_account_id || !amount || (!destination_account_id && !pix_key)) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatorios: source_account_id, amount, e destination_account_id ou pix_key'
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'O valor do PIX deve ser maior que zero'
            });
        }

        const sourceAccount = queryOne('SELECT * FROM accounts WHERE id = ? AND status = ?', [source_account_id, 'active']);

        if (!sourceAccount) {
            return res.status(404).json({ success: false, error: 'Conta de origem nao encontrada ou inativa' });
        }

        // Buscar conta destino por ID ou documento (simulando chave PIX)
        let destAccount;
        if (destination_account_id) {
            destAccount = queryOne('SELECT * FROM accounts WHERE id = ? AND status = ?', [destination_account_id, 'active']);
        } else if (pix_key) {
            destAccount = queryOne('SELECT * FROM accounts WHERE document = ? AND status = ?', [pix_key, 'active']);
        }

        if (!destAccount) {
            return res.status(404).json({ success: false, error: 'Conta de destino nao encontrada' });
        }

        if (sourceAccount.id === destAccount.id) {
            return res.status(400).json({
                success: false,
                error: 'Conta de origem e destino nao podem ser iguais'
            });
        }

        if (sourceAccount.balance < amount) {
            return res.status(400).json({
                success: false,
                error: 'Saldo insuficiente',
                available_balance: sourceAccount.balance
            });
        }

        const transactionId = uuidv4();
        const sourceNewBalance = sourceAccount.balance - amount;
        const destNewBalance = destAccount.balance + amount;
        const now = new Date().toISOString();

        // Debitar da conta origem
        run('UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?', [sourceNewBalance, now, source_account_id]);

        // Creditar na conta destino
        run('UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?', [destNewBalance, now, destAccount.id]);

        // Registrar transacao
        run(
            `INSERT INTO transactions (id, type, amount, description, source_account_id, destination_account_id, status, created_at)
       VALUES (?, 'pix', ?, ?, ?, ?, 'completed', ?)`,
            [transactionId, amount, description || 'PIX', source_account_id, destAccount.id, now]
        );

        const transaction = queryOne('SELECT * FROM transactions WHERE id = ?', [transactionId]);

        // Broadcast update
        if (global.broadcast) {
            global.broadcast('PIX', { transaction, source_account_id, destination_account_id: destAccount.id });
        }

        res.status(201).json({
            success: true,
            data: {
                transaction,
                source_account: {
                    id: source_account_id,
                    new_balance: sourceNewBalance,
                    formatted_balance: `R$ ${sourceNewBalance.toFixed(2).replace('.', ',')}`
                },
                destination_account: {
                    id: destAccount.id,
                    holder_name: destAccount.holder_name,
                    new_balance: destNewBalance
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
