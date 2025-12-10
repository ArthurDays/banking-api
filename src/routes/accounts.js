const express = require('express');
const router = express.Router();
const { query, queryOne, run, saveDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('./auth');
const { validateUUID, sanitizeString, auditLog } = require('../middleware/security');

// ValidaÃ§Ã£o de CPF
function validateCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) return false;

    // Verifica se todos os dÃ­gitos sÃ£o iguais
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    // ValidaÃ§Ã£o do primeiro dÃ­gito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    // ValidaÃ§Ã£o do segundo dÃ­gito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;

    return true;
}

// ValidaÃ§Ã£o de CNPJ
function validateCNPJ(cnpj) {
    cnpj = cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) return false;

    // Verifica se todos os dÃ­gitos sÃ£o iguais
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    // ValidaÃ§Ã£o do primeiro dÃ­gito
    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    const digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += numbers.charAt(size - i) * pos--;
        if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(0))) return false;

    // ValidaÃ§Ã£o do segundo dÃ­gito
    size = size + 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += numbers.charAt(size - i) * pos--;
        if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
}

// Valida CPF ou CNPJ
function validateDocument(document) {
    const cleanDoc = document.replace(/\D/g, '');
    if (cleanDoc.length === 11) return validateCPF(cleanDoc);
    if (cleanDoc.length === 14) return validateCNPJ(cleanDoc);
    return false;
}

// Listar todas as contas
router.get('/', (req, res) => {
    try {
        const accounts = query('SELECT * FROM accounts WHERE status = ?', ['active']);
        res.json({
            success: true,
            data: accounts,
            count: accounts.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar conta por ID
router.get('/:id', validateUUID('id'), (req, res) => {
    try {
        const account = queryOne('SELECT * FROM accounts WHERE id = ?', [req.params.id]);

        if (!account) {
            return res.status(404).json({ success: false, error: 'Conta nÃ£o encontrada' });
        }

        res.json({ success: true, data: account });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar saldo da conta
router.get('/:id/balance', validateUUID('id'), (req, res) => {
    try {
        const account = queryOne('SELECT id, holder_name, balance FROM accounts WHERE id = ?', [req.params.id]);

        if (!account) {
            return res.status(404).json({ success: false, error: 'Conta nÃ£o encontrada' });
        }

        res.json({
            success: true,
            data: {
                account_id: account.id,
                holder_name: account.holder_name,
                balance: account.balance,
                formatted_balance: `R$ ${account.balance.toFixed(2).replace('.', ',')}`
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar extrato da conta
router.get('/:id/statement', validateUUID('id'), (req, res) => {
    try {
        const account = queryOne('SELECT * FROM accounts WHERE id = ?', [req.params.id]);

        if (!account) {
            return res.status(404).json({ success: false, error: 'Conta nÃ£o encontrada' });
        }

        const transactions = query(
            `SELECT * FROM transactions 
       WHERE source_account_id = ? OR destination_account_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
            [req.params.id, req.params.id]
        );

        res.json({
            success: true,
            data: {
                account: {
                    id: account.id,
                    holder_name: account.holder_name,
                    balance: account.balance
                },
                transactions: transactions,
                count: transactions.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Criar nova conta (protegido)
router.post('/', authenticateToken, (req, res) => {
    try {
        const { holder_name, document, bank_code, agency, account_number, account_type, initial_balance } = req.body;

        // ValidaÃ§Ãµes
        if (!holder_name || !document || !bank_code || !agency || !account_number) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatÃ³rios: holder_name, document, bank_code, agency, account_number'
            });
        }

        // Validar CPF/CNPJ
        if (!validateDocument(document)) {
            return res.status(400).json({
                success: false,
                error: 'CPF ou CNPJ invÃ¡lido'
            });
        }

        // Verificar se documento jÃ¡ existe
        const existing = queryOne('SELECT id FROM accounts WHERE document = ?', [document.replace(/\D/g, '')]);
        if (existing) {
            return res.status(409).json({ success: false, error: 'Documento jÃ¡ cadastrado' });
        }

                // Sanitize inputs
        const sanitizedName = sanitizeString(holder_name);
        
        const id = uuidv4();
        const balance = initial_balance || 0;
        const now = new Date().toISOString();

        run(
            `INSERT INTO accounts (id, holder_name, document, bank_code, agency, account_number, account_type, balance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, sanitizedName, document, bank_code, agency, account_number, account_type || 'checking', balance, now, now]
        );

        const account = queryOne('SELECT * FROM accounts WHERE id = ?', [id]);

        res.status(201).json({ success: true, data: account });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Atualizar conta (protegido)
router.put('/:id', authenticateToken, validateUUID('id'), (req, res) => {
    try {
        const { holder_name, status } = req.body;
        const account = queryOne('SELECT * FROM accounts WHERE id = ?', [req.params.id]);

        if (!account) {
            return res.status(404).json({ success: false, error: 'Conta nÃ£o encontrada' });
        }

        const now = new Date().toISOString();
        run(
            `UPDATE accounts SET holder_name = ?, status = ?, updated_at = ? WHERE id = ?`,
            [holder_name || account.holder_name, status || account.status, now, req.params.id]
        );

        const updated = queryOne('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Desativar conta (protegido)
router.delete('/:id', authenticateToken, validateUUID('id'), (req, res) => {
    try {
        const account = queryOne('SELECT * FROM accounts WHERE id = ?', [req.params.id]);

        if (!account) {
            return res.status(404).json({ success: false, error: 'Conta nÃ£o encontrada' });
        }

        const now = new Date().toISOString();
        run("UPDATE accounts SET status = 'inactive', updated_at = ? WHERE id = ?", [now, req.params.id]);

        res.json({ success: true, message: 'Conta desativada com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

