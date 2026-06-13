const { PactV3, MatchersV3 } = require('@pact-foundation/pact');
const { like, string } = MatchersV3;
const axios = require('axios');
const path = require('path');

const provider = new PactV3({
    consumer: 'api-gateway',
    provider: 'user-service',
    dir: path.resolve(__dirname, '../pacts'),
    port: 1234,
});

describe('API Gateway → User Service Contract', () => {

    // Test 1: Register a new user
    it('should register a new user', async () => {
        await provider
            .uponReceiving('a request to register a user')
            .withRequest({
                method: 'POST',
                path: '/api/auth/register',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123',
                    phone: '9999999999',
                },
            })
            .willRespondWith({
                status: 201,
                headers: { 'Content-Type': like('application/json') },
                body: {
                    success: true,
                    message: like('User registered successfully'),
                    data: {
                        token: string('jwt-token'),
                        user: {
                            id: like(1),
                            name: like('Test User'),
                            email: like('test@example.com'),
                        },
                    },
                },
            })
            .executeTest(async (mockServer) => {
                const response = await axios.post(`${mockServer.url}/api/auth/register`, {
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123',
                    phone: '9999999999',
                });
                expect(response.status).toBe(201);
                expect(response.data.success).toBe(true);
                expect(response.data.data.token).toBeDefined();
            });
    });

    // Test 2: Login
    it('should login a user', async () => {
        const loginProvider = new PactV3({
            consumer: 'api-gateway',
            provider: 'user-service',
            dir: path.resolve(__dirname, '../pacts'),
            port: 1235,
        });

        await loginProvider
            .uponReceiving('a request to login')
            .withRequest({
                method: 'POST',
                path: '/api/auth/login',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    email: 'test@example.com',
                    password: 'password123',
                },
            })
            .willRespondWith({
                status: 200,
                headers: { 'Content-Type': like('application/json') },
                body: {
                    success: true,
                    data: {
                        token: string('jwt-token'),
                        user: {
                            id: like(1),
                            email: like('test@example.com'),
                        },
                    },
                },
            })
            .executeTest(async (mockServer) => {
                const response = await axios.post(`${mockServer.url}/api/auth/login`, {
                    email: 'test@example.com',
                    password: 'password123',
                });
                expect(response.status).toBe(200);
                expect(response.data.success).toBe(true);
                expect(response.data.data.token).toBeDefined();
            });
    });

    // Test 3: Get user profile
    it('should get user profile with valid token', async () => {
        await provider
            .uponReceiving('a request to get user profile')
            .withRequest({
                method: 'GET',
                path: '/api/auth/profile',
                headers: { Authorization: like('Bearer jwt-token') },
            })
            .willRespondWith({
                status: 200,
                headers: { 'Content-Type': like('application/json') },
                body: {
                    success: true,
                    data: {
                        id: like(1),
                        name: like('Test User'),
                        email: like('test@example.com'),
                    },
                },
            })
            .executeTest(async (mockServer) => {
                const response = await axios.get(`${mockServer.url}/api/auth/profile`, {
                    headers: { Authorization: 'Bearer jwt-token' },
                });
                expect(response.status).toBe(200);
                expect(response.data.success).toBe(true);
            });
    });
});