// middleware/auth.js
const db = require('../db');

// Require a logged-in session
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required. Please log in at /account' });
    }
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  const user = db.getUser(req.session.userId);
  if (!user) {
    req.session.destroy();
    return res.redirect('/login');
  }
  req.user = user;
  next();
}

// Require Pro plan
function requirePro(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.plan !== 'pro' || req.user.subscriptionStatus !== 'active') {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Pro plan required. Upgrade at /pricing' });
      }
      return res.redirect('/pricing?reason=pro_required');
    }
    next();
  });
}

// API key middleware — for external API access
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) {
    return res.status(401).json({
      error: 'API key required. Pass it as X-Api-Key header or ?api_key= query param.',
      docs: '/api-docs'
    });
  }

  const result = db.checkAndIncrementApiUsage(key);
  if (!result.allowed) {
    return res.status(429).json({ error: result.reason, upgrade: '/pricing' });
  }

  const record = db.getApiKey(key);
  req.apiKey  = record;
  req.apiPlan = record.plan;
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Limit', result.limit);
  next();
}

// Optional auth — attach user if logged in, don't block
function optionalAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.user = db.getUser(req.session.userId) || null;
  }
  next();
}

module.exports = { requireAuth, requirePro, requireApiKey, optionalAuth };
