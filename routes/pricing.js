// routes/pricing.js
const express = require('express');
const router  = express.Router();
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, (req, res) => {
  const isPro = req.user && req.user.plan === 'pro' && req.user.subscriptionStatus === 'active';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pricing — EZDown Pro</title>
<meta name="description" content="Upgrade to EZDown Pro for ad-free downloads, 500 API calls/day, and priority processing. $4.99/month.">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Familjen+Grotesk:wght@700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f7f6f2;font-family:'DM Sans',sans-serif;color:#1a1814;min-height:100vh}
nav{background:#0a0a0f;padding:.9rem 2rem;display:flex;align-items:center;justify-content:space-between}
.nav-logo{font-family:'Familjen Grotesk',sans-serif;font-size:1.2rem;font-weight:700;color:#fff;text-decoration:none}
.nav-logo span{color:#6c63ff}
.nav-links{display:flex;gap:1.25rem;align-items:center}
.nav-links a{color:rgba(255,255,255,.55);font-size:.875rem;text-decoration:none;transition:color .2s}
.nav-links a:hover{color:#fff}
.page{max-width:900px;margin:0 auto;padding:4rem 1.5rem}
.hero{text-align:center;margin-bottom:3.5rem}
.hero h1{font-family:'Familjen Grotesk',sans-serif;font-size:clamp(2rem,5vw,3rem);font-weight:800;letter-spacing:-.04em;margin-bottom:.75rem}
.hero h1 span{color:#6c63ff}
.hero p{color:#7a7870;font-size:1.05rem;max-width:500px;margin:0 auto}
.plans{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;max-width:700px;margin:0 auto}
.plan-card{background:#fff;border:1px solid #e8e6df;border-radius:20px;padding:2rem}
.plan-card.featured{border:2px solid #6c63ff;position:relative}
.popular-badge{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:#6c63ff;color:#fff;font-size:.75rem;font-weight:700;padding:.3rem 1rem;border-radius:100px;white-space:nowrap}
.plan-name{font-size:.8rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#7a7870;margin-bottom:.75rem}
.plan-price{display:flex;align-items:baseline;gap:.35rem;margin-bottom:.25rem}
.plan-price-amount{font-family:'Familjen Grotesk',sans-serif;font-size:2.5rem;font-weight:800;letter-spacing:-.04em}
.plan-price-period{color:#7a7870;font-size:.9rem}
.plan-desc{font-size:.85rem;color:#7a7870;margin-bottom:1.5rem;line-height:1.55}
.plan-features{list-style:none;margin-bottom:1.75rem;display:flex;flex-direction:column;gap:.65rem}
.plan-features li{font-size:.88rem;display:flex;align-items:flex-start;gap:.55rem;line-height:1.45}
.plan-features li::before{content:'✓';color:#6c63ff;font-weight:700;flex-shrink:0;margin-top:.05rem}
.plan-features li.no::before{content:'✗';color:#d0cec6}
.plan-features li.no{color:#b0ada6}
.plan-btn{width:100%;padding:.9rem;border-radius:12px;font-family:'Familjen Grotesk',sans-serif;font-weight:700;font-size:1rem;cursor:pointer;border:none;transition:opacity .2s,transform .15s;text-decoration:none;display:block;text-align:center}
.plan-btn.primary{background:#6c63ff;color:#fff}
.plan-btn.primary:hover{opacity:.88;transform:translateY(-1px)}
.plan-btn.secondary{background:#f7f6f2;color:#1a1814;border:1.5px solid #e8e6df}
.plan-btn.secondary:hover{border-color:#6c63ff}
.yearly-note{text-align:center;font-size:.83rem;color:#7a7870;margin-top:1rem}
.yearly-note a{color:#6c63ff;font-weight:500}
.faq{max-width:600px;margin:4rem auto 0;text-align:center}
.faq h2{font-family:'Familjen Grotesk',sans-serif;font-size:1.5rem;font-weight:700;letter-spacing:-.03em;margin-bottom:1.5rem}
.faq-item{background:#fff;border:1px solid #e8e6df;border-radius:12px;padding:1rem 1.25rem;margin-bottom:.65rem;text-align:left}
.faq-q{font-weight:500;font-size:.9rem;margin-bottom:.4rem}
.faq-a{font-size:.85rem;color:#7a7870;line-height:1.6}
.guarantee{text-align:center;margin-top:2rem;font-size:.85rem;color:#7a7870}
.guarantee strong{color:#1a1814}
@media(max-width:580px){.plans{grid-template-columns:1fr}}
</style>
</head>
<body>
<nav>
  <a class="nav-logo" href="/">EZ<span>Down</span></a>
  <div class="nav-links">
    <a href="/">Home</a>
    ${req.user ? `<a href="/account">Dashboard</a><a href="/logout">Log out</a>` : `<a href="/login">Log in</a><a href="/register" style="background:#6c63ff;color:#fff;padding:.4rem .9rem;border-radius:7px">Sign up</a>`}
  </div>
</nav>

<div class="page">
  <div class="hero">
    <h1>Simple, honest <span>pricing</span></h1>
    <p>Start free. Upgrade when you need more power. Cancel anytime.</p>
  </div>

  <div class="plans">
    <!-- Free plan -->
    <div class="plan-card">
      <div class="plan-name">Free</div>
      <div class="plan-price">
        <div class="plan-price-amount">$0</div>
        <div class="plan-price-period">/ forever</div>
      </div>
      <div class="plan-desc">Everything you need to get started. No credit card required.</div>
      <ul class="plan-features">
        <li>5 downloads / day</li>
        <li>All platforms supported</li>
        <li>MP4, MP3, WebM formats</li>
        <li>1 API key (10 calls/day)</li>
        <li class="no">Ads displayed</li>
        <li class="no">Standard speed</li>
        <li class="no">Email support</li>
      </ul>
      ${req.user ? `<span class="plan-btn secondary" style="cursor:default">Your current plan</span>` : `<a href="/register" class="plan-btn secondary">Get started free</a>`}
    </div>

    <!-- Pro plan -->
    <div class="plan-card featured">
      <div class="popular-badge">Most Popular</div>
      <div class="plan-name">Pro</div>
      <div class="plan-price">
        <div class="plan-price-amount">$4.99</div>
        <div class="plan-price-period">/ month</div>
      </div>
      <div class="plan-desc">For power users who need speed, no ads, and API access.</div>
      <ul class="plan-features">
        <li>200 downloads / day</li>
        <li>All platforms supported</li>
        <li>MP4, MP3, WebM + 4K</li>
        <li>5 API keys (500 calls/day each)</li>
        <li>Zero ads, ever</li>
        <li>Priority processing</li>
        <li>Email support</li>
      </ul>
      ${isPro
        ? `<a href="/account" class="plan-btn secondary">Manage Plan →</a>`
        : `<button class="plan-btn primary" onclick="startCheckout('pro_monthly')">Upgrade to Pro →</button>`
      }
    </div>
  </div>

  <div class="yearly-note">
    Want to save 33%? <a href="#" onclick="startCheckout('pro_yearly');return false">Pay yearly — $39.99/year ($3.33/mo)</a>
  </div>

  <div class="guarantee">
    <strong>30-day money-back guarantee.</strong> Not happy? We'll refund you, no questions asked.
  </div>

  <div class="faq">
    <h2>Common questions</h2>
    <div class="faq-item">
      <div class="faq-q">Can I cancel anytime?</div>
      <div class="faq-a">Yes. Cancel from your dashboard at any time. You keep Pro access until the end of your billing period.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">What payment methods are accepted?</div>
      <div class="faq-a">All major credit/debit cards via Stripe. Secure, encrypted, no card data stored on our servers.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">What is the API?</div>
      <div class="faq-a">The EZDown API lets you integrate video downloading into your own apps. POST a URL, get back a download link. Full docs in your dashboard.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">Do I need to create an account for the free plan?</div>
      <div class="faq-a">No account needed to use the website. An account is required only to get an API key or to subscribe to Pro.</div>
    </div>
  </div>
</div>

<script>
async function startCheckout(plan) {
  ${req.user ? `
  const res  = await fetch('/billing/checkout', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ plan })
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else alert('Error: ' + (data.error || 'Something went wrong'));
  ` : `window.location.href = '/register?next=/pricing';`}
}
</script>
</body></html>`);
});

module.exports = { router };
