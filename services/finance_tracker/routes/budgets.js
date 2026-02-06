const express = require('express');
const Budget = require('../models/budget');

const { body, param, validationResult } = require('express-validator');
const router = express.Router();

function ensureAuth(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'unauthenticated' });
  next();
}

// Create a budget
router.post('/', ensureAuth,
  body('name').isLength({ min: 1 }),
  body('targetAmount').isFloat({ gt: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const payload = req.body || {};
      const b = new Budget(Object.assign({}, payload, { owner: req.session.userId }));
      await b.save();
      // compute remaining (use `currentAmount` as spent)
      const remaining = (b.targetAmount || 0) - (b.currentAmount || 0);
      res.status(201).json({ ok: true, budget: b, remaining });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server error' });
    }
});

// List budgets for current user
router.get('/', ensureAuth, async (req, res) => {
  const list = await Budget.find({ owner: req.session.userId }).sort({ createdAt: -1 });
  res.json({ ok: true, budgets: list });
});

// Stats over user's budgets (demo using wasm mean_pair/stddev_pair)
router.get('/_user_stats', ensureAuth, async (req, res) => {
  const list = await Budget.find({ owner: req.session.userId }).sort({ createdAt: -1 });
  const wasm = req.app.locals.wasm && req.app.locals.wasm.server_stats;
  if (!wasm || !wasm.mean_pair) {
    // fallback JS stats
    const vals = list.map(x => Number(x.targetAmount || 0));
    const mean = vals.reduce((a,b)=>a+b,0)/(vals.length||1);
    return res.json({ ok: true, mean });
  }
  // demo: compute mean_pair and stddev_pair over first two budgets (if present)
  const a = list[0] ? Number(list[0].targetAmount||0) : 0;
  const b = list[1] ? Number(list[1].targetAmount||0) : 0;
  try {
    const mean = wasm.mean_pair(a, b);
    const stddev = wasm.stddev_pair(a, b);
    res.json({ ok: true, mean, stddev, count: list.length });
  } catch (e) {
    console.error('wasm stats error', e);
    res.status(500).json({ error: 'stats failed' });
  }
});

// Get budget
router.get('/:id', ensureAuth,
  param('id').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const b = await Budget.findById(req.params.id);
  if (!b || b.owner.toString() !== req.session.userId.toString()) return res.status(404).json({ error: 'not found' });
  const remaining = (b.targetAmount || 0) - (b.currentAmount || 0);
  res.json({ ok: true, budget: b, remaining });
});

// Update budget
router.put('/:id', ensureAuth,
  param('id').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const b = await Budget.findById(req.params.id);
  if (!b || b.owner.toString() !== req.session.userId.toString()) return res.status(404).json({ error: 'not found' });
  Object.assign(b, req.body);
  await b.save();
  const remaining = (b.targetAmount || 0) - (b.currentAmount || 0);
  res.json({ ok: true, budget: b, remaining });
});

// Delete budget
router.delete('/:id', ensureAuth,
  param('id').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const b = await Budget.findById(req.params.id);
  if (!b || b.owner.toString() !== req.session.userId.toString()) return res.status(404).json({ error: 'not found' });
  await b.remove();
  res.json({ ok: true });
});

// Convert targetAmount to a different currency using wasm (if available)
router.get('/:id/convert', ensureAuth,
  param('id').isMongoId(),
  async (req, res) => {
    const b = await Budget.findById(req.params.id);
    if (!b || b.owner.toString() !== req.session.userId.toString()) return res.status(404).json({ error: 'not found' });
    const to = (req.query.to || 'USD').toUpperCase();
    const codes = { 'USD': 0, 'EUR': 1, 'JPY': 2, 'GBP': 3 };
    const wasm = req.app.locals.wasm && req.app.locals.wasm.server_currency;
    if (!wasm || !wasm.convert_code) return res.status(503).json({ error: 'currency wasm not available' });
    try {
      const from_code = codes[(b.currency || 'USD').toUpperCase()] || 0;
      const to_code = codes[to] || 0;
      const converted = wasm.convert_code(Number(b.targetAmount || 0), from_code, to_code);
      res.json({ ok: true, converted, currency: to });
    } catch (e) {
      console.error('wasm convert error', e);
      res.status(500).json({ error: 'conversion failed' });
    }
  }
);

// Stats over user's budgets (demo using wasm mean_pair/stddev_pair)
router.get('/_user_stats', ensureAuth, async (req, res) => {
  const list = await Budget.find({ owner: req.session.userId }).sort({ createdAt: -1 });
  const wasm = req.app.locals.wasm && req.app.locals.wasm.server_stats;
  if (!wasm || !wasm.mean_pair) {
    // fallback JS stats
    const vals = list.map(x => Number(x.targetAmount || 0));
    const mean = vals.reduce((a,b)=>a+b,0)/(vals.length||1);
    return res.json({ ok: true, mean });
  }
  // demo: compute mean_pair and stddev_pair over first two budgets (if present)
  const a = list[0] ? Number(list[0].targetAmount||0) : 0;
  const b = list[1] ? Number(list[1].targetAmount||0) : 0;
  try {
    const mean = wasm.mean_pair(a, b);
    const stddev = wasm.stddev_pair(a, b);
    res.json({ ok: true, mean, stddev, count: list.length });
  } catch (e) {
    console.error('wasm stats error', e);
    res.status(500).json({ error: 'stats failed' });
  }
});

module.exports = router;
