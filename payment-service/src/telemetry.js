const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [register],
});

const httpRequestTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

const sdk = new NodeSDK({
    serviceName: process.env.SERVICE_NAME || 'unknown-service',
    traceExporter: new OTLPTraceExporter({
        url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4318'}/v1/traces`,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
process.on('SIGTERM', () => sdk.shutdown());

const metricsMiddleware = (req, res, next) => {
    if (req.path === '/metrics') return next();
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
        const labels = { method: req.method, route: req.route?.path || req.path, status_code: res.statusCode };
        end(labels);
        httpRequestTotal.inc(labels);
    });
    next();
};

const metricsEndpoint = async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
};

module.exports = { metricsMiddleware, metricsEndpoint, register };
