const express = require('express');
const path = require('path');
const morgan = require('morgan');
const winston = require('winston');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.PORT || 8088;

// Winston logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

// Forward logs to log-collector (optional)
const LOG_COLLECTOR_URL = process.env.LOG_COLLECTOR_URL || 'http://log-collector:5000/ingest';
const http = require('http');

function forwardLog(level, msg) {
  try {
    const payload = JSON.stringify({ level, message: msg, app: 'k8s_ui' });
    const u = new URL(LOG_COLLECTOR_URL);
    const options = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 2000
    };
    const req = http.request(options, res => {
      // consume response
      res.on('data', () => {});
    });
    req.on('error', () => {});
    req.write(payload);
    req.end();
  } catch (e) {}
}

// augment logger to also forward
const originalInfo = logger.info.bind(logger);
logger.info = (msg, ...meta) => {
  originalInfo(msg, ...meta);
  forwardLog('info', msg);
};

// HTTP request logging
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Prometheus metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });
const httpRequestDurationMs = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [50, 100, 200, 300, 500, 1000]
});

// simple middleware to record latency
app.use((req, res, next) => {
  const end = httpRequestDurationMs.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.path, code: res.statusCode });
  });
  next();
});

// serve static mermaid HTML
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (ex) {
    logger.error('Error collecting metrics', ex);
    res.status(500).end();
  }
});

// fallback route: serve index if exists
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'k8s_architecture.html'));
});

// start server
app.listen(PORT, () => {
  logger.info(`k8s-architecture-ui listening on port ${PORT}`);
});
