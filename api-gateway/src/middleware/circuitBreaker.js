const CircuitBreaker = require('opossum');

const defaultOptions = {
    timeout: 5000,           // Request must complete within 5s
    errorThresholdPercentage: 50,  // Open circuit if 50% of requests fail
    resetTimeout: 10000,     // Try again after 10s
    volumeThreshold: 3,      // Minimum requests before tripping
};

const breakers = {};

const getBreaker = (name, fn) => {
    if (!breakers[name]) {
        const breaker = new CircuitBreaker(fn, defaultOptions);

        breaker.on('open',     () => console.log(`🔴 Circuit OPEN:     ${name} — service unavailable`));
        breaker.on('halfOpen', () => console.log(`🟡 Circuit HALF-OPEN: ${name} — testing recovery`));
        breaker.on('close',    () => console.log(`🟢 Circuit CLOSED:   ${name} — service recovered`));
        breaker.on('fallback', () => console.log(`⚡ Circuit FALLBACK:  ${name}`));

        breakers[name] = breaker;
    }
    return breakers[name];
};

// Returns Express middleware that wraps a proxy call with a circuit breaker
const withCircuitBreaker = (serviceName, proxyFn) => {
    return (req, res, next) => {
        const breaker = getBreaker(serviceName, proxyFn);

        breaker.fallback(() => {
            if (!res.headersSent) {
                res.status(503).json({
                    success: false,
                    message: `${serviceName} is currently unavailable. Please try again shortly.`,
                    circuit: 'open',
                });
            }
        });

        breaker.fire(req, res, next).catch((err) => {
            if (!res.headersSent) {
                res.status(503).json({
                    success: false,
                    message: `${serviceName} is currently unavailable.`,
                    error: err.message,
                });
            }
        });
    };
};

// Health status of all breakers — useful for a /health endpoint
const getCircuitStatus = () => {
    return Object.entries(breakers).map(([name, breaker]) => ({
        service: name,
        state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
        stats: breaker.stats,
    }));
};

module.exports = { withCircuitBreaker, getCircuitStatus };