const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('../database');
const { authenticateToken } = require('./auth');

// Initialize Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
let genAI = null;
let model = null;

if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

// System prompt for the assistant
const SYSTEM_PROMPT = `Voce e o NeoAssistente, um assistente virtual do banco NeoBank.
Voce ajuda os usuarios a entender suas financas e responder perguntas sobre suas contas e transacoes.

Regras:
- Responda sempre em portugues brasileiro
- Seja conciso e objetivo
- Use formatacao simples (sem markdown complexo)
- Se nao souber algo, diga que nao tem essa informacao
- Nunca invente dados que nao foram fornecidos
- Formate valores monetarios como R$ X.XXX,XX
- Use linguagem amigavel e profissional

Voce tem acesso aos dados bancarios do usuario que serao fornecidos no contexto.`;

// Chat endpoint
router.post('/chat', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Mensagem e obrigatoria'
            });
        }

        if (!model) {
            return res.status(503).json({
                success: false,
                error: 'Assistente nao configurado. Configure GEMINI_API_KEY no ambiente.'
            });
        }

        // Get user's financial data for context
        const accounts = query('SELECT * FROM accounts WHERE status = ?', ['active']);
        const recentTransactions = query(
            'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 20'
        );

        // Calculate summary stats
        const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
        const totalAccounts = accounts.length;

        // Group transactions by type
        const transactionsByType = recentTransactions.reduce((acc, tx) => {
            acc[tx.type] = (acc[tx.type] || 0) + tx.amount;
            return acc;
        }, {});

        // Build context
        const context = `
DADOS DO USUARIO:

RESUMO:
- Total de contas: ${totalAccounts}
- Saldo total: R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

CONTAS:
${accounts.map(acc => `- ${acc.holder_name}: ${acc.account_type === 'checking' ? 'Corrente' : 'Poupanca'}, Saldo: R$ ${acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('\n')}

ULTIMAS TRANSACOES (${recentTransactions.length}):
${recentTransactions.slice(0, 10).map(tx => {
            const date = new Date(tx.created_at).toLocaleDateString('pt-BR');
            const type = { deposit: 'Deposito', withdraw: 'Saque', transfer: 'Transferencia', pix: 'PIX' }[tx.type] || tx.type;
            return `- ${date}: ${type} de R$ ${tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - ${tx.description || 'Sem descricao'}`;
        }).join('\n')}

MOVIMENTACAO POR TIPO:
${Object.entries(transactionsByType).map(([type, total]) => {
            const typeName = { deposit: 'Depositos', withdraw: 'Saques', transfer: 'Transferencias', pix: 'PIX' }[type] || type;
            return `- ${typeName}: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }).join('\n')}
`;

        // Create prompt with system instructions, context, and user message
        const fullPrompt = `${SYSTEM_PROMPT}

${context}

PERGUNTA DO USUARIO: ${message}

RESPOSTA:`;

        // Call Gemini API
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const assistantMessage = response.text();

        res.json({
            success: true,
            data: {
                message: assistantMessage,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Assistant error:', error);

        // Handle specific Gemini errors
        if (error.message?.includes('API key')) {
            return res.status(503).json({
                success: false,
                error: 'Erro de configuracao da API. Verifique a chave GEMINI_API_KEY.'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Erro ao processar sua pergunta. Tente novamente.'
        });
    }
});

// Health check for assistant
router.get('/status', (req, res) => {
    res.json({
        success: true,
        data: {
            available: !!model,
            model: model ? 'gemini-1.5-flash' : null
        }
    });
});

module.exports = router;
