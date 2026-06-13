const { VerifierV3 } = require('@pact-foundation/pact');
const path = require('path');
const app = require('../server');

describe('User Service — Pact Provider Verification', () => {
    it('should validate the contract with api-gateway', async () => {
        const verifier = new VerifierV3({
            provider: 'user-service',
            providerBaseUrl: 'http://localhost:3001',
            pactUrls: [
                path.resolve(__dirname, '../../api-gateway/pacts/api-gateway-user-service.json'),
            ],
            logLevel: 'warn',
        });

        await verifier.verifyProvider();
    }, 30000);
});