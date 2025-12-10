const request = require('supertest');
const app = require('../src/index');

describe('Accounts Endpoints', () => {
    const testAccount = {
        holder_name: 'Account Test User',
        document: `${Date.now()}`.slice(-11),
        bank_code: '001',
        agency: '1234',
        account_number: `${Date.now()}`.slice(-6),
        account_type: 'checking',
        initial_balance: 1000
    };
    let accountId = '';

    describe('POST /api/accounts', () => {
        it('should create a new account', async () => {
            const res = await request(app)
                .post('/api/accounts')
                .send(testAccount);

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('id');
            expect(res.body.data.holder_name).toBe(testAccount.holder_name);
            expect(res.body.data.balance).toBe(testAccount.initial_balance);
            accountId = res.body.data.id;
        });

        it('should fail with duplicate document', async () => {
            const res = await request(app)
                .post('/api/accounts')
                .send(testAccount);

            expect(res.statusCode).toBe(409);
            expect(res.body.success).toBe(false);
        });

        it('should fail with missing required fields', async () => {
            const res = await request(app)
                .post('/api/accounts')
                .send({ holder_name: 'Incomplete' });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('GET /api/accounts', () => {
        it('should return list of accounts', async () => {
            const res = await request(app)
                .get('/api/accounts');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /api/accounts/:id', () => {
        it('should return account by id', async () => {
            // First create an account
            const createRes = await request(app)
                .post('/api/accounts')
                .send({
                    ...testAccount,
                    document: `${Date.now()}`.slice(-11),
                    account_number: `${Date.now()}`.slice(-6)
                });

            const id = createRes.body.data.id;

            const res = await request(app)
                .get(`/api/accounts/${id}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(id);
        });

        it('should return 404 for non-existent account', async () => {
            const res = await request(app)
                .get('/api/accounts/non-existent-id');

            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });

    describe('GET /api/accounts/:id/balance', () => {
        it('should return account balance', async () => {
            const createRes = await request(app)
                .post('/api/accounts')
                .send({
                    ...testAccount,
                    document: `${Date.now()}`.slice(-11),
                    account_number: `${Date.now()}`.slice(-6),
                    initial_balance: 500
                });

            const id = createRes.body.data.id;

            const res = await request(app)
                .get(`/api/accounts/${id}/balance`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.balance).toBe(500);
        });
    });

    describe('PUT /api/accounts/:id', () => {
        it('should update account holder name', async () => {
            const createRes = await request(app)
                .post('/api/accounts')
                .send({
                    ...testAccount,
                    document: `${Date.now()}`.slice(-11),
                    account_number: `${Date.now()}`.slice(-6)
                });

            const id = createRes.body.data.id;

            const res = await request(app)
                .put(`/api/accounts/${id}`)
                .send({ holder_name: 'Updated Name' });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.holder_name).toBe('Updated Name');
        });
    });

    describe('DELETE /api/accounts/:id', () => {
        it('should deactivate account', async () => {
            const createRes = await request(app)
                .post('/api/accounts')
                .send({
                    ...testAccount,
                    document: `${Date.now()}`.slice(-11),
                    account_number: `${Date.now()}`.slice(-6)
                });

            const id = createRes.body.data.id;

            const res = await request(app)
                .delete(`/api/accounts/${id}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('inactive');
        });
    });
});
