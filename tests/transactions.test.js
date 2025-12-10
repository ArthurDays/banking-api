const request = require('supertest');
const app = require('../src/index');

describe('Transactions Endpoints', () => {
    let sourceAccountId = '';
    let destAccountId = '';

    beforeAll(async () => {
        // Create source account
        const sourceRes = await request(app)
            .post('/api/accounts')
            .send({
                holder_name: 'Source Account',
                document: `${Date.now()}`.slice(-11),
                bank_code: '001',
                agency: '1234',
                account_number: `src${Date.now()}`.slice(-6),
                account_type: 'checking',
                initial_balance: 10000
            });
        sourceAccountId = sourceRes.body.data.id;

        // Create destination account
        const destRes = await request(app)
            .post('/api/accounts')
            .send({
                holder_name: 'Destination Account',
                document: `${Date.now() + 1}`.slice(-11),
                bank_code: '001',
                agency: '1234',
                account_number: `dst${Date.now()}`.slice(-6),
                account_type: 'checking',
                initial_balance: 500
            });
        destAccountId = destRes.body.data.id;
    });

    describe('GET /api/transactions', () => {
        it('should return list of transactions', async () => {
            const res = await request(app)
                .get('/api/transactions');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should filter by type', async () => {
            const res = await request(app)
                .get('/api/transactions?type=deposit');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /api/transactions/deposit', () => {
        it('should perform a deposit', async () => {
            const res = await request(app)
                .post('/api/transactions/deposit')
                .send({
                    account_id: sourceAccountId,
                    amount: 500,
                    description: 'Test deposit'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.new_balance).toBe(10500);
        });

        it('should fail with invalid amount', async () => {
            const res = await request(app)
                .post('/api/transactions/deposit')
                .send({
                    account_id: sourceAccountId,
                    amount: -100
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should fail with non-existent account', async () => {
            const res = await request(app)
                .post('/api/transactions/deposit')
                .send({
                    account_id: 'non-existent-id',
                    amount: 100
                });

            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });

    describe('POST /api/transactions/withdraw', () => {
        it('should perform a withdrawal', async () => {
            const res = await request(app)
                .post('/api/transactions/withdraw')
                .send({
                    account_id: sourceAccountId,
                    amount: 200,
                    description: 'Test withdrawal'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should fail with insufficient balance', async () => {
            const res = await request(app)
                .post('/api/transactions/withdraw')
                .send({
                    account_id: sourceAccountId,
                    amount: 999999
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('POST /api/transactions/transfer', () => {
        it('should perform a transfer', async () => {
            const res = await request(app)
                .post('/api/transactions/transfer')
                .send({
                    source_account_id: sourceAccountId,
                    destination_account_id: destAccountId,
                    amount: 100,
                    description: 'Test transfer'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should fail transferring to same account', async () => {
            const res = await request(app)
                .post('/api/transactions/transfer')
                .send({
                    source_account_id: sourceAccountId,
                    destination_account_id: sourceAccountId,
                    amount: 100
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should fail with insufficient balance', async () => {
            const res = await request(app)
                .post('/api/transactions/transfer')
                .send({
                    source_account_id: sourceAccountId,
                    destination_account_id: destAccountId,
                    amount: 999999
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('POST /api/transactions/pix', () => {
        it('should perform a PIX transfer', async () => {
            // Get destination document
            const destRes = await request(app)
                .get(`/api/accounts/${destAccountId}`);

            const pixKey = destRes.body.data.document;

            const res = await request(app)
                .post('/api/transactions/pix')
                .send({
                    source_account_id: sourceAccountId,
                    pix_key: pixKey,
                    amount: 50,
                    description: 'Test PIX'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should fail with non-existent PIX key', async () => {
            const res = await request(app)
                .post('/api/transactions/pix')
                .send({
                    source_account_id: sourceAccountId,
                    pix_key: '00000000000',
                    amount: 50
                });

            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });
});
