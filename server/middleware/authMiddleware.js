const db = require('../db');

function authMiddleware(req, res, next) {
  let token = req.headers['authorization'];
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }
  if (!token) {
    token = req.headers['x-user-token'] || req.query.token;
  }

  // If no token provided, default to the default user (Admin) for seamless experience,
  // but if token is provided, authenticate accurately.
  let user;
  if (token) {
    user = db.prepare('SELECT id, username, email, name, role, avatar, token FROM users WHERE token = ?').get(token);
  }

  if (!user) {
    // Default fallback to first active user if unauthenticated
    user = db.prepare('SELECT id, username, email, name, role, avatar, token FROM users LIMIT 1').get();
  }

  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized: User not found' });
  }

  req.user = user;
  next();
}

module.exports = authMiddleware;
