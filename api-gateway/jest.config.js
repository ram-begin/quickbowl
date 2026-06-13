module.exports = {
    testEnvironment: 'node',
    testTimeout: 30000,
    transformIgnorePatterns: [
        'node_modules/(?!(@pact-foundation)/)'
    ],
    transform: {}
};