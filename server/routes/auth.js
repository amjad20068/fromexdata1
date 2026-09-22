const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// Get all 3 authorized users (for user switcher / quick login)
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, username, email, name, role, avatar, token FROM users').all();
  res.json({ success: true, users });
});

// Login
router.post('/login', (req, res) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) {
    return res.status(400).json({ success: false, message: 'Username/Email and password are required' });
  }

  const user = db.prepare(`
    SELECT id, username, email, name, role, avatar, token, password
    FROM users
    WHERE username = ? OR email = ?
  `).get(usernameOrEmail.trim(), usernameOrEmail.trim());

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: 'Invalid credentials. Password is fromex123' });
  }

  const { password: _, ...safeUser } = user;
  res.json({
    success: true,
    message: `Welcome back, ${user.name}`,
    user: safeUser,
    token: user.token
  });
});

// Get current active user
router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
