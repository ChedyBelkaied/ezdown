// routes/account.js — user dashboard, API key CRUD
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');

function generateApiKey() {
  return 'ezd_' + crypto.randomBytes(24).toString('hex');
}

// ── GET /account ──────────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const keys    = db.getApiKeysByUser(req.user.id);
  const isPro   = req.user.plan === 'pro' && req.user.subscriptionStatus === 'active';
  const welcome = req.query.welcome === '1';
  const success = req.query.success === '1';

  res.send(dashboardPage(req.user, keys, isPro, welcome, success));
});

// ── POST /account/keys/create ─────────────────────────────────────────────────
router.post('/keys/create', requireAuth, (req, res) => {
  const isPro = req.user.plan === 'pro' && req.user.subscriptionStatus === 'active';
  const keys  = db.getApiKeysByUser(req.user.id);

  // Free: 1 key, Pro: 5 keys
  const maxKeys = isPro ? 5 : 1;
  if (keys.length >= maxKeys) {
    return res.redirect('/account?error=max_keys');
  }

  const key = generateApiKey();
  db.createApiKey({
    key,
    userId:        req.user.id,
    plan:          req.user.plan,
    label:         req.body.label || 'My API Key',
    createdAt:     new Date().toISOString(),
    lastUsed:      null,
    requestsToday: 0,
    resetDate:     new Date().toISOString().slice(0, 10),
  });

  res.redirect('/account?created=1');
});

// ── POST /account/keys/delete ─────────────────────────────────────────────────
router.post('/keys/delete', requireAuth, (req, res) => {
  const { key } = req.body;
  const record  = db.getApiKey(key);
  if (record && record.userId === req.user.id) {
    db.deleteApiKey(key);
  }
  res.redirect('/account');
});

// ── Dashboard HTML ────────────────────────────────────────────────────────────
function dashboardPage(user, keys, isPro, welcome, success) {
  const planBadge = isPro
    ? `<span class="badge pro">⚡ Pro</span>`
    : `<span class="badge free">Free</span>`;

  const upgradeSection = isPro ? `
    <div class="pro-box">
      <div class="pro-box-inner">
        <div>
          <div class="pro-title">⚡ You're on Pro</div>
          <div class="pro-sub">Your subscription is active. Enjoy unlimited downloads and 500 API calls/day.</div>
        </div>
        <form method="POST" action="/billing/portal">
          <button class="btn-outline">Manage Subscription</button>
        </form>
      </div>
      ${user.planExpiresAt ? `<div class="pro-expire">Renews ${new Date(user.planExpiresAt).toLocaleDateString('en-US', {month:'long',day:'numeric',year:'numeric'})}</div>` : ''}
    </div>
  ` : `
    <div class="upgrade-box">
      <div class="upgrade-inner">
        <div>
          <div class="upgrade-title">Upgrade to Pro</div>
          <div class="upgrade-sub">500 API calls/day · No ads · Priority downloads · $4.99/mo</div>
        </div>
        <a href="/pricing" class="btn-primary">Upgrade →</a>
      </div>
    </div>
  `;

  const keyLimit   = isPro ? 5 : 1;
  const canAdd     = keys.length < keyLimit;
  const dailyLimit = isPro ? 500 : 10;

  const keysHtml = keys.length === 0 ? `
    <div class="no-keys">No API keys yet. Create one below.</div>
  ` : keys.map(k => {
    const today = new Date().toISOString().slice(0, 10);
    const used  = k.resetDate === today ? k.requestsToday : 0;
    const pct   = Math.round((used / dailyLimit) * 100);
    return `
    <div class="key-card">
      <div class="key-top">
        <div>
          <div class="key-label">${escHtml(k.label)}</div>
          <div class="key-value">
            <code>${k.key.slice(0, 12)}••••••••••••••••••••••••••••••</code>
            <button class="copy-btn" onclick="copyKey('${k.key}', this)">Copy</button>
          </div>
        </div>
        <form method="POST" action="/account/keys/delete">
          <input type="hidden" name="key" value="${k.key}" />
          <button class="delete-btn" onclick="return confirm('Delete this key?')">Delete</button>
        </form>
      </div>
      <div class="key-stats">
        <div class="key-stat">
          <span>Today's usage</span>
          <strong>${used} / ${dailyLimit}</strong>
        </div>
        <div class="key-stat">
          <span>Last used</span>
          <strong>${k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : 'Never'}</strong>
        </div>
        <div class="key-stat">
          <span>Plan</span>
          <strong>${k.plan === 'pro' ? '⚡ Pro' : 'Free'}</strong>
        </div>
      </div>
      <div class="usage-bar-wrap">
        <div class="usage-bar" style="width:${pct}%;background:${pct > 85 ? '#ff2d55' : '#6c63ff'}"></div>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard — EZDown</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Familjen+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f7f6f2;font-family:'DM Sans',sans-serif;color:#1a1814;min-height:100vh}
nav{background:#0a0a0f;padding:.9rem 2rem;display:flex;align-items:center;justify-content:space-between}
.nav-logo{font-family:'Familjen Grotesk',sans-serif;font-size:1.2rem;font-weight:700;color:#fff;text-decoration:none}
.nav-logo span{color:#6c63ff}
.nav-right{display:flex;align-items:center;gap:1rem}
.nav-email{font-size:.82rem;color:rgba(255,255,255,.45)}
.nav-logout{font-size:.82rem;color:rgba(255,255,255,.45);text-decoration:none;transition:color .2s}
.nav-logout:hover{color:#fff}
.page{max-width:800px;margin:0 auto;padding:2.5rem 1.5rem}
.page-header{display:flex;align-items:center;gap:.85rem;margin-bottom:2rem}
.page-header h1{font-family:'Familjen Grotesk',sans-serif;font-size:1.6rem;font-weight:700;letter-spacing:-.03em}
.badge{padding:.25rem .75rem;border-radius:100px;font-size:.78rem;font-weight:600}
.badge.pro{background:rgba(108,99,255,.15);color:#6c63ff}
.badge.free{background:#f0efe8;color:#7a7870}
.alert{padding:.85rem 1.1rem;border-radius:12px;font-size:.88rem;margin-bottom:1.5rem}
.alert.success{background:#eafaf1;border:1px solid #b7e8c8;color:#1a6e3c}
.section{background:#fff;border:1px solid #e8e6df;border-radius:16px;padding:1.5rem;margin-bottom:1.25rem}
.section-title{font-size:.75rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#7a7870;margin-bottom:1.25rem}
.pro-box{background:linear-gradient(135deg,#0d0d1a,#1a1030);border-radius:14px;padding:1.25rem 1.5rem}
.pro-box-inner{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.pro-title{font-weight:600;color:#fff;margin-bottom:.25rem}
.pro-sub{font-size:.85rem;color:rgba(255,255,255,.55)}
.pro-expire{font-size:.75rem;color:rgba(255,255,255,.35);margin-top:.75rem}
.upgrade-box{background:#fff8f0;border:1px solid #ffd9a8;border-radius:14px;padding:1.25rem 1.5rem}
.upgrade-inner{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.upgrade-title{font-weight:600;margin-bottom:.25rem;color:#a85c00}
.upgrade-sub{font-size:.85rem;color:#c07020}
.btn-primary{background:#6c63ff;color:#fff;border:none;padding:.6rem 1.3rem;border-radius:8px;font-family:'DM Sans',sans-serif;font-weight:600;font-size:.88rem;cursor:pointer;text-decoration:none;display:inline-block;transition:opacity .2s}
.btn-primary:hover{opacity:.88}
.btn-outline{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);padding:.55rem 1.2rem;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:.85rem;cursor:pointer;transition:background .2s}
.btn-outline:hover{background:rgba(255,255,255,.18)}
.key-card{background:#f7f6f2;border:1px solid #e8e6df;border-radius:12px;padding:1.1rem;margin-bottom:.85rem}
.key-top{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:.85rem}
.key-label{font-size:.85rem;font-weight:600;margin-bottom:.35rem}
.key-value{display:flex;align-items:center;gap:.5rem}
code{background:#fff;border:1px solid #e8e6df;padding:.3rem .65rem;border-radius:6px;font-size:.78rem;color:#444;letter-spacing:.04em}
.copy-btn{background:none;border:1px solid #d0cec6;border-radius:6px;padding:.25rem .65rem;font-size:.75rem;cursor:pointer;color:#7a7870;transition:all .2s}
.copy-btn:hover{border-color:#6c63ff;color:#6c63ff}
.delete-btn{background:none;border:1px solid #ffc0cb;border-radius:6px;padding:.25rem .65rem;font-size:.75rem;cursor:pointer;color:#c0293f;transition:all .2s}
.delete-btn:hover{background:#fff0f3}
.key-stats{display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:.75rem}
.key-stat{display:flex;flex-direction:column;gap:.15rem}
.key-stat span{font-size:.72rem;color:#7a7870}
.key-stat strong{font-size:.88rem}
.usage-bar-wrap{height:4px;background:#e8e6df;border-radius:2px;overflow:hidden}
.usage-bar{height:100%;border-radius:2px;transition:width .3s}
.no-keys{text-align:center;padding:1.5rem;color:#7a7870;font-size:.9rem}
.add-key-form{display:flex;gap:.65rem;flex-wrap:wrap;margin-top:1rem}
.add-key-form input{flex:1;min-width:160px;background:#f7f6f2;border:1.5px solid #d0cec6;border-radius:10px;padding:.65rem 1rem;font-family:'DM Sans',sans-serif;font-size:.88rem;outline:none;transition:border-color .2s}
.add-key-form input:focus{border-color:#6c63ff}
.limit-note{font-size:.78rem;color:#7a7870;margin-top:.65rem}
.api-docs{background:#0a0a0f;border-radius:14px;padding:1.25rem 1.5rem}
.api-docs h3{color:#fff;font-size:.95rem;font-weight:600;margin-bottom:1rem}
.code-block{background:#161620;border:1px solid #2a2a3d;border-radius:8px;padding:.85rem 1rem;font-family:monospace;font-size:.8rem;color:#a8a8d0;line-height:1.7;margin-bottom:.75rem;overflow-x:auto}
.code-block .cm{color:#4a4a70}
.code-block .ck{color:#6c63ff}
.code-block .cv{color:#43e97b}
.code-block .cs{color:#ff6584}
@media(max-width:600px){
  nav{padding:.9rem 1.25rem}
  .page{padding:1.5rem 1rem}
  .key-stats{gap:1rem}
  .pro-box-inner,.upgrade-inner{flex-direction:column;align-items:flex-start}
}
</style>
</head>
<body>
<nav>
  <a class="nav-logo" href="/">EZ<span>Down</span></a>
  <div class="nav-right">
    <span class="nav-email">${escHtml(user.email)}</span>
    <a class="nav-logout" href="/logout">Log out</a>
  </div>
</nav>

<div class="page">
  <div class="page-header">
    <h1>Dashboard</h1>
    ${planBadge}
  </div>

  ${welcome ? `<div class="alert success">🎉 Welcome to EZDown! Your free account is ready.</div>` : ''}
  ${success ? `<div class="alert success">⚡ You're now on Pro! All features are unlocked.</div>` : ''}

  <!-- Plan status -->
  <div class="section">
    <div class="section-title">Your Plan</div>
    ${upgradeSection}
  </div>

  <!-- API Keys -->
  <div class="section">
    <div class="section-title">API Keys</div>
    ${keysHtml}
    ${canAdd ? `
      <form method="POST" action="/account/keys/create" class="add-key-form">
        <input type="text" name="label" placeholder="Key label (e.g. My App)" maxlength="40" />
        <button type="submit" class="btn-primary">+ Create Key</button>
      </form>
      <div class="limit-note">${keys.length}/${keyLimit} keys used${!isPro ? ' · <a href="/pricing" style="color:#6c63ff">Upgrade for 5 keys</a>' : ''}</div>
    ` : `<div class="limit-note">Maximum keys reached (${keyLimit}). ${!isPro ? '<a href="/pricing" style="color:#6c63ff">Upgrade for more</a>' : ''}</div>`}
  </div>

  <!-- API Docs -->
  <div class="section">
    <div class="section-title">API Documentation</div>
    <div class="api-docs">
      <h3>How to use your API key</h3>
      <div class="code-block"><span class="cm"># Get video info</span>
<span class="ck">GET</span> <span class="cv">${process.env.SITE_URL || 'https://ezdown.io'}/api/info?url=VIDEO_URL</span>
<span class="ck">Header:</span> <span class="cs">X-Api-Key: YOUR_KEY</span></div>

      <div class="code-block"><span class="cm"># Start a download job</span>
<span class="ck">POST</span> <span class="cv">${process.env.SITE_URL || 'https://ezdown.io'}/api/download</span>
<span class="ck">Header:</span> <span class="cs">X-Api-Key: YOUR_KEY</span>
<span class="ck">Body:</span> <span class="cv">{"url":"...","format":"mp4","quality":"1080"}</span></div>

      <div class="code-block"><span class="cm"># Poll job status</span>
<span class="ck">GET</span> <span class="cv">${process.env.SITE_URL || 'https://ezdown.io'}/api/status/:jobId</span>
<span class="ck">Header:</span> <span class="cs">X-Api-Key: YOUR_KEY</span></div>

      <div class="code-block"><span class="cm"># Download file</span>
<span class="ck">GET</span> <span class="cv">${process.env.SITE_URL || 'https://ezdown.io'}/api/file/:jobId</span>
<span class="ck">Header:</span> <span class="cs">X-Api-Key: YOUR_KEY</span></div>

      <div style="font-size:.78rem;color:rgba(255,255,255,.35);margin-top:.75rem">
        Rate limit: <strong style="color:rgba(255,255,255,.55)">${isPro ? '500' : '10'} requests/day</strong> · 
        Responses: JSON · 
        Errors use standard HTTP status codes
      </div>
    </div>
  </div>
</div>

<script>
function copyKey(key, btn) {
  navigator.clipboard.writeText(key).then(() => {
    btn.textContent = 'Copied!';
    btn.style.color = '#6c63ff';
    setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = ''; }, 2000);
  });
}
</script>
</body></html>`;
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { router };
