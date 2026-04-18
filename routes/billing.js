// routes/billing.js — Stripe checkout, webhooks, customer portal
const express = require('express');
const router  = express.Router();
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto  = require('crypto');
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');

const PLANS = {
  pro_monthly: {
    name:       'EZDown Pro — Monthly',
    priceId:    process.env.STRIPE_PRICE_PRO_MONTHLY, // set in .env
    amount:     499,  // $4.99 in cents
    interval:   'month',
    apiLimit:   500,
  },
  pro_yearly: {
    name:       'EZDown Pro — Yearly',
    priceId:    process.env.STRIPE_PRICE_PRO_YEARLY,  // set in .env
    amount:     3999, // $39.99/year (~$3.33/mo)
    interval:   'year',
    apiLimit:   500,
  },
};

// ── POST /billing/checkout — create Stripe checkout session ──────────────────
router.post('/checkout', requireAuth, async (req, res) => {
  const { plan = 'pro_monthly' } = req.body;
  const planConfig = PLANS[plan];
  if (!planConfig || !planConfig.priceId) {
    return res.status(400).json({ error: 'Invalid plan or Stripe not configured' });
  }

  try {
    // Create or retrieve Stripe customer
    let customerId = req.user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    req.user.email,
        metadata: { userId: req.user.id },
      });
      customerId = customer.id;
      db.updateUser(req.user.id, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer:            customerId,
      mode:                'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price:    planConfig.priceId,
        quantity: 1,
      }],
      success_url: `${process.env.SITE_URL}/account?success=1`,
      cancel_url:  `${process.env.SITE_URL}/pricing?cancelled=1`,
      metadata:    { userId: req.user.id, plan },
      subscription_data: {
        metadata: { userId: req.user.id },
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ── POST /billing/portal — customer self-service portal ─────────────────────
router.post('/portal', requireAuth, async (req, res) => {
  if (!req.user.stripeCustomerId) {
    return res.redirect('/pricing');
  }
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   req.user.stripeCustomerId,
      return_url: `${process.env.SITE_URL}/account`,
    });
    res.redirect(session.url);
  } catch (err) {
    console.error('[Stripe] Portal error:', err.message);
    res.status(500).json({ error: 'Failed to open billing portal' });
  }
});

// ── POST /billing/webhook — Stripe events ───────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[Stripe Webhook] Signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe Webhook] ${event.type}`);

  switch (event.type) {

    case 'checkout.session.completed': {
      const session  = event.data.object;
      const userId   = session.metadata?.userId;
      const sub      = await stripe.subscriptions.retrieve(session.subscription);
      if (userId) {
        db.updateUser(userId, {
          plan:                 'pro',
          stripeSubscriptionId: sub.id,
          subscriptionStatus:   'active',
          planExpiresAt:        new Date(sub.current_period_end * 1000).toISOString(),
        });
        // Upgrade all API keys for this user to pro
        db.getApiKeysByUser(userId).forEach(k => db.updateApiKey(k.key, { plan: 'pro' }));
        console.log(`[Billing] User ${userId} upgraded to Pro`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub    = event.data.object;
      const user   = db.getUserByCustomerId(sub.customer);
      if (user) {
        const isActive = sub.status === 'active' || sub.status === 'trialing';
        db.updateUser(user.id, {
          plan:                 isActive ? 'pro' : 'free',
          subscriptionStatus:   sub.status,
          planExpiresAt:        new Date(sub.current_period_end * 1000).toISOString(),
        });
        if (!isActive) {
          db.getApiKeysByUser(user.id).forEach(k => db.updateApiKey(k.key, { plan: 'free' }));
        }
        console.log(`[Billing] User ${user.id} subscription → ${sub.status}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub  = event.data.object;
      const user = db.getUserByCustomerId(sub.customer);
      if (user) {
        db.updateUser(user.id, {
          plan:               'free',
          subscriptionStatus: 'cancelled',
        });
        db.getApiKeysByUser(user.id).forEach(k => db.updateApiKey(k.key, { plan: 'free' }));
        console.log(`[Billing] User ${user.id} downgraded to Free`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const user    = db.getUserByCustomerId(invoice.customer);
      if (user) {
        db.updateUser(user.id, { subscriptionStatus: 'past_due' });
      }
      break;
    }
  }

  res.json({ received: true });
});

module.exports = { router, PLANS };
