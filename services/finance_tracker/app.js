require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const client = require('prom-client');

const authRoutes = require('./routes/auth');
const budgetRoutes = require('./routes/budgets');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/finance';

async function main() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB', MONGO_URI);
  // initialize wasm modules (optional)
  const wasmLoader = require('./wasm/loader');
  const wasmModules = await wasmLoader.init();

  const app = express();
  // Disable default Content-Security-Policy and other restrictive cross-origin
  // policies so the SPA can load external UMD scripts (React from unpkg)
  // during local development / CI. In production, configure strict policies.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: false, crossOriginResourcePolicy: false }));
  // trust proxy for secure cookies when behind a proxy (set in production)
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

  // CORS: allow configurable frontend origin. If FRONTEND_ORIGIN is '*',
  // do not allow credentials because browsers disallow credentials with wildcard origin.
  const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:4000';
  const corsOptions = {
    origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN,
    credentials: FRONTEND_ORIGIN === '*' ? false : true,
  };
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(express.json());
  // JSON parse error handler: respond with JSON instead of HTML on malformed JSON bodies
  app.use((err, req, res, next) => {
    try {
      if (!err) return next();
      if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON' });
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) return res.status(400).json({ error: 'invalid JSON' });
    } catch (e) {
      // fall through to next error handler
    }
    return next(err);
  });
  app.use(morgan('dev'));

  // Set a relaxed Content-Security-Policy to allow loading React UMD from unpkg
  // (suitable for local development / CI). In production, replace with a strict policy.
  app.use((req, res, next) => {
    const csp = "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https:;";
    res.setHeader('Content-Security-Policy', csp);
    return next();
  });

  app.use(session({
    name: 'finance.sid',
    secret: process.env.SESSION_SECRET || 'replace_me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24
    },
    store: MongoStore.create({ mongoUrl: MONGO_URI, collectionName: 'sessions' })
  }));

  // If an Authorization: Bearer <token> header is present, map it to the session
  // so GUI clients that use bearer tokens authenticate the same as cookie sessions.
  app.use(async (req, res, next) => {
    try {
      const auth = req.headers['authorization'] || req.headers['Authorization'];
      if (auth && auth.startsWith && auth.startsWith('Bearer ')) {
        const token = auth.slice(7).trim();
        if (token && !req.session.userId) {
          const User = require('./models/user');
          const user = await User.findOne({ token });
          if (user) req.session.userId = user._id;
        }
      }
    } catch (e) { console.error('auth header middleware error', e); }
    return next();
  });

  // serve OpenAPI docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  app.use('/api/auth', authRoutes);
  app.use('/api/budgets', budgetRoutes);

  // expose loaded wasm modules to routes via app.locals
  app.locals.wasm = wasmModules;

  // serve wasm assets with correct MIME type and the rest of the static frontend
  app.use('/wasm', express.static('public/wasm', {
    setHeaders: (res, path) => {
      if (path.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
      // mirror CORS setting for wasm fetches
      if (FRONTEND_ORIGIN) res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
    }
  }));

  // simple static frontend for quick testing (optional)
  app.use(express.static('public'));

  // Prometheus metrics: simple request counter and uptime gauge
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });
  const httpRequests = new client.Counter({ name: 'http_requests_total', help: 'Total HTTP requests', labelNames: ['method','route','status'] });
  const uptimeGauge = new client.Gauge({ name: 'process_uptime_seconds', help: 'Process uptime in seconds' });
  register.registerMetric(httpRequests);
  register.registerMetric(uptimeGauge);

  // middleware to count requests
  app.use((req, res, next) => {
    const end = res.end;
    res.end = function(chunk, encoding) {
      try { httpRequests.inc({ method: req.method, route: req.route ? req.route.path : req.path, status: res.statusCode }, 1); } catch(e) {}
      return end.call(this, chunk, encoding);
    };
    return next();
  });

  // health and readiness probes
  app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/readyz', (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    if (ready) return res.status(200).json({ ready: true });
    return res.status(503).json({ ready: false });
  });

  app.get('/metrics', async (req, res) => {
    try {
      uptimeGauge.set(process.uptime());
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (e) {
      res.status(500).end(e.message);
    }
  });

  // Serve SPA index.html for non-API routes
  app.get('/', (req, res) => {
    // prefer HTML
    if (req.accepts && req.accepts('html')) return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    return res.json({ ok: true, message: 'Finance Tracker API' });
  });

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/wasm') || req.path === '/metrics' || req.path.startsWith('/api/docs')) return res.status(404).json({ error: 'not found' });
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, () => console.log(`Finance tracker listening on ${PORT}`));
}

main().catch(err => {
  console.error('Failed to start app', err);
  process.exit(1);
});
