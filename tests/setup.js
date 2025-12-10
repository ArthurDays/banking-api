// Test setup file
const { initDatabase } = require('../src/database');

beforeAll(async () => {
    // Initialize test database
    await initDatabase();
});

afterAll(async () => {
    // Cleanup if needed
});
