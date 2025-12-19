const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'NeoBank API',
            version: '1.0.0',
            description: 'API de transações bancárias com autenticação JWT',
            contact: {
                name: 'API Support',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                        name: { type: 'string' },
                    },
                },
                Account: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        holder_name: { type: 'string' },
                        document: { type: 'string' },
                        bank_code: { type: 'string' },
                        agency: { type: 'string' },
                        account_number: { type: 'string' },
                        account_type: { type: 'string', enum: ['checking', 'savings'] },
                        balance: { type: 'number' },
                        status: { type: 'string', enum: ['active', 'inactive'] },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Transaction: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        type: { type: 'string', enum: ['deposit', 'withdraw', 'transfer', 'pix'] },
                        amount: { type: 'number' },
                        description: { type: 'string' },
                        source_account_id: { type: 'string', format: 'uuid' },
                        destination_account_id: { type: 'string', format: 'uuid' },
                        status: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string' },
                    },
                },
            },
        },
        tags: [
            { name: 'Auth', description: 'Autenticação de usuários' },
            { name: 'Accounts', description: 'Gerenciamento de contas bancárias' },
            { name: 'Transactions', description: 'Operações financeiras' },
        ],
    },
    apis: ['./src/swagger-docs.js'],
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
