const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/user');

const { body, validationResult } = require('express-validator');
const router = express.Router();

router.post('/register', 
  body('username').isLength({ min: 3 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'username,email,password required' });
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(409).json({ error: 'username or email already exists' });
    const hash = await bcrypt.hash(password, 12);
    const token = crypto.randomBytes(24).toString('hex');
    const u = new User({ username, email, passwordHash: hash, token });
    await u.save();
    // regenerate session to prevent fixation
    req.session.regenerate(err => {
      if (err) console.error('session regenerate error', err);
      req.session.userId = u._id;
      res.status(201).json({ ok: true, id: u._id, username: u.username, token: u.token });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.post('/login', 
  body('username').isLength({ min: 1 }),
  body('password').isLength({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username,password required' });
    // allow login with either username or email for compatibility with other GUIs
    const u = await User.findOne({ $or: [{ username }, { email: username }] });
    if (!u) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    // rotate token on each login for single-use style tokens
    const token = crypto.randomBytes(24).toString('hex');
    u.token = token;
    await u.save();
    req.session.regenerate(err => {
      if (err) console.error('session regenerate error', err);
      req.session.userId = u._id;
      res.json({ ok: true, id: u._id, username: u.username, token: u.token });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.post('/logout', (req, res) => {
  // clear any token associated with the session's user
  const clearAndRespond = () => {
    req.session.destroy(err => {
      if (err) return res.status(500).json({ error: 'failed to destroy session' });
      res.clearCookie('finance.sid');
      res.json({ ok: true });
    });
  };
  if (req.session && req.session.userId) {
    User.findById(req.session.userId).then(u => {
      if (u) { u.token = undefined; return u.save(); }
    }).catch(()=>{}).finally(clearAndRespond);
  } else {
    clearAndRespond();
  }
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'not authenticated' });
  const u = await User.findById(req.session.userId).select('-passwordHash');
  res.json({ ok: true, user: u });
});

module.exports = router;
