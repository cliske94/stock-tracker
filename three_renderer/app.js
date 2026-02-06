const express = require('express');
const path = require('path');
const winston = require('winston');
const client = require('prom-client');
const { convert, convertFromHtmlString, convertFromMermaidText } = require('./convert_mermaid');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 9092;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Prometheus metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'three_renderer_' });
const httpRequestCounter = new client.Counter({ name: 'three_renderer_http_requests_total', help: 'HTTP requests' });

app.use((req,res,next)=>{
  httpRequestCounter.inc();
  logger.info(`${req.method} ${req.url}`);
  next();
});

// generate model at startup
const modelOut = path.join(__dirname, 'public', 'model.obj');
// Prefer local repo's angular_ui dist, inside Docker the repo is copied under /usr/src/app/angular_ui
const mermaidHtmlCandidates = [
  path.join(__dirname, 'angular_ui', 'dist', 'index.html'),
  path.join(__dirname, '..', 'angular_ui', 'dist', 'index.html'),
  path.join('/', 'usr', 'src', 'app', 'angular_ui', 'dist', 'index.html')
];
let mermaidHtml = mermaidHtmlCandidates.find(p=>{
  try{ return require('fs').existsSync(p); }catch(e){return false}
});
mermaidHtml = mermaidHtml || mermaidHtmlCandidates[0];
async function tryGenerate() {
  // First, try local mermaid markdown files in repo
  const mdCandidates = [
    path.join(__dirname, '..', 'mermaid-diagram.md'),
    path.join(__dirname, '..', '..', 'mermaid-diagram.md'),
    path.join('/', 'usr', 'src', 'app', 'mermaid-diagram.md')
  ];
  for (const p of mdCandidates) {
    try {
      if (require('fs').existsSync(p)) {
        logger.info('Found mermaid markdown at ' + p);
        const txt = require('fs').readFileSync(p, 'utf8');
        // Extract fenced ```mermaid blocks if present
        const m = txt.match(/```\s*mermaid\s*([\s\S]*?)```/i);
        const mermaidText = m ? m[1].trim() : txt;
        convertFromMermaidText(mermaidText, modelOut);
        logger.info(`Generated model at ${modelOut} from markdown ${p}`);
        return;
      }
    } catch(e){ /* ignore */ }
  }

  // Next, try local angular html file
  try {
    if (require('fs').existsSync(mermaidHtml)) {
      convert(mermaidHtml, modelOut);
      logger.info(`Generated model at ${modelOut} from ${mermaidHtml}`);
      return;
    }
  } catch(e){}

  // Finally try fetching the page from a running Angular UI (host.docker.internal) or localhost
  const urls = [process.env.MERMAID_URL, 'http://host.docker.internal:4200/', 'http://127.0.0.1:4200/'].filter(Boolean);
  for (const u of urls) {
    try {
      logger.info('Attempting fetch of mermaid HTML from ' + u);
      const res = await fetch(u, {timeout:3000});
      if (!res.ok && res.status !== 0) throw new Error('bad status ' + res.status);
      const html = await res.text();
      convertFromHtmlString(html, modelOut);
      logger.info(`Generated model at ${modelOut} from remote ${u}`);
      return;
    } catch (e) {
      logger.warn('fetch failed: ' + (e && e.message));
    }
  }

  logger.warn('Could not generate model from mermaid: no source available');
}

tryGenerate();

// Dev-only endpoints: allow atomic replacement of model_meta.json during development
if (process.env.ENABLE_DEV_ENDPOINT === '1' || process.env.NODE_ENV !== 'production') {
  app.post('/_dev/model_meta', express.json({ limit: '2mb' }), (req, res) => {
    try {
      const data = req.body;
      if (!data || typeof data !== 'object') return res.status(400).send('invalid JSON');
      const out = path.join(__dirname, 'public', 'model_meta.json');
      require('fs').writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
      logger.info('Dev: wrote ' + out);
      return res.status(200).send('ok');
    } catch (e) {
      logger.error('Dev write failed: ' + (e && e.message));
      return res.status(500).send('write failed');
    }
  });

  // Accept raw text body (helpful when using curl --data-binary)
  app.post('/_dev/model_meta_raw', express.text({ type: '*/*', limit: '2mb' }), (req, res) => {
    try {
      const txt = req.body;
      const out = path.join(__dirname, 'public', 'model_meta.json');
      require('fs').writeFileSync(out, txt, 'utf8');
      logger.info('Dev: wrote raw ' + out);
      return res.status(200).send('ok');
    } catch (e) {
      logger.error('Dev raw write failed: ' + (e && e.message));
      return res.status(500).send('write failed');
    }
  });

  logger.info('Dev endpoints enabled: POST /_dev/model_meta');
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/metrics', async (req,res)=>{
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.listen(PORT, ()=>{
  logger.info(`three-renderer listening on ${PORT}`);
});
