// routes/auth.js — simple email/password auth (no external deps)
const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const db       = require('../db');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + process.env.SECRET_KEY).digest('hex');
}

function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

// ── GET /login ────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/account');
  res.send(authPage('Login', `
    <h1>Login to EZDown</h1>
    <p class="sub">Access your Pro dashboard and API keys.</p>
    <form method="POST" action="/login">
      <div class="field"><label>Email</label><input type="email" name="email" required autocomplete="email" /></div>
      <div class="field"><label>Password</label><input type="password" name="password" required autocomplete="current-password" /></div>
      <button type="submit" class="btn-primary">Log In</button>
    </form>
    <p class="switch">Don't have an account? <a href="/register">Sign up free</a></p>
  `, req.query.error));
});

// ── POST /login ───────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.redirect('/login?error=missing');

  const user = db.getUserByEmail(email.toLowerCase().trim());
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.redirect('/login?error=invalid');
  }

  req.session.userId = user.id;
  const next = req.query.next || '/account';
  res.redirect(next);
});

// ── GET /register ─────────────────────────────────────────────────────────────
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/account');
  res.send(authPage('Create Account', `
    <h1>Create your EZDown account</h1>
    <p class="sub">Free plan · No credit card required</p>
    <form method="POST" action="/register">
      <div class="field"><label>Email</label><input type="email" name="email" required autocomplete="email" /></div>
      <div class="field"><label>Password</label><input type="password" name="password" required autocomplete="new-password" minlength="8" /></div>
      <button type="submit" class="btn-primary">Create Free Account</button>
    </form>
    <p class="switch">Already have an account? <a href="/login">Log in</a></p>
  `, req.query.error));
});

// ── POST /register ────────────────────────────────────────────────────────────
router.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.redirect('/register?error=invalid');
  }

  const existing = db.getUserByEmail(email.toLowerCase().trim());
  if (existing) return res.redirect('/register?error=exists');

  const user = db.createUser({
    id:                   generateId(),
    email:                email.toLowerCase().trim(),
    passwordHash:         hashPassword(password),
    plan:                 'free',
    stripeCustomerId:     null,
    stripeSubscriptionId: null,
    subscriptionStatus:   null,
    planExpiresAt:        null,
    createdAt:            new Date().toISOString(),
  });

  req.session.userId = user.id;
  res.redirect('/account?welcome=1');
});

// ── GET /logout ───────────────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ── Shared auth page HTML ─────────────────────────────────────────────────────
function authPage(title, formHtml, error) {
  const errors = {
    missing: 'Please fill in all fields.',
    invalid: 'Invalid email or password.',
    exists:  'An account with this email already exists.',
  };
  const errorHtml = error ? `<div class="error-msg">${errors[error] || 'An error occurred.'}</div>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — EZDown</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Familjen+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f7f6f2;font-family:'DM Sans',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem}
.card{background:#fff;border:1px solid #e8e6df;border-radius:20px;padding:2.5rem;width:100%;max-width:400px;box-shadow:0 4px 32px rgba(0,0,0,.06)}
h1{font-family:'Familjen Grotesk',sans-serif;font-size:1.6rem;font-weight:700;margin-bottom:.35rem;letter-spacing:-.03em}
.sub{color:#7a7870;font-size:.9rem;margin-bottom:1.75rem}
.field{margin-bottom:1rem}
label{display:block;font-size:.78rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:#7a7870;margin-bottom:.4rem}
input{width:100%;background:#f7f6f2;border:1.5px solid #d0cec6;border-radius:10px;padding:.8rem 1rem;font-family:'DM Sans',sans-serif;font-size:.95rem;outline:none;transition:border-color .2s}
input:focus{border-color:#6c63ff}
.btn-primary{width:100%;background:#6c63ff;color:#fff;border:none;padding:.9rem;border-radius:10px;font-family:'Familjen Grotesk',sans-serif;font-weight:700;font-size:1rem;cursor:pointer;margin-top:.5rem;transition:opacity .2s}
.btn-primary:hover{opacity:.88}
.switch{text-align:center;margin-top:1.25rem;font-size:.88rem;color:#7a7870}
.switch a{color:#6c63ff;font-weight:500}
.error-msg{background:#fff0f3;border:1px solid #ffc0cb;border-radius:8px;padding:.7rem 1rem;font-size:.85rem;color:#c0293f;margin-bottom:1rem}
.logo{font-family:'Familjen Grotesk',sans-serif;font-size:1.2rem;font-weight:700;color:#1a1814;margin-bottom:2rem;text-decoration:none}
.logo span{color:#6c63ff}
</style>
</head>
<body>
<a class="logo" href="/">EZ<span>Down</span></a>
<div class="card">
  ${errorHtml}
  ${formHtml}
</div>
</body></html>`;
}

module.exports = { router, hashPassword };
