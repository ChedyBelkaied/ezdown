// db.js — simple JSON file database (no native modules, works everywhere)
const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// ── Default structure ─────────────────────────────────────────────────────────
const DEFAULT = { users: {}, api_keys: {}, sessions: {} };

function load() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { ...DEFAULT };
  }
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ── Users ─────────────────────────────────────────────────────────────────────
// user = { id, email, plan:'free'|'pro', stripeCustomerId, stripeSubscriptionId,
//           subscriptionStatus, createdAt, planExpiresAt }

function getUser(id) {
  return load().users[id] || null;
}

function getUserByEmail(email) {
  const db = load();
  return Object.values(db.users).find(u => u.email === email) || null;
}

function getUserByCustomerId(stripeCustomerId) {
  const db = load();
  return Object.values(db.users).find(u => u.stripeCustomerId === stripeCustomerId) || null;
}

function createUser(user) {
  const db = load();
  db.users[user.id] = user;
  save(db);
  return user;
}

function updateUser(id, fields) {
  const db = load();
  if (!db.users[id]) return null;
  db.users[id] = { ...db.users[id], ...fields };
  save(db);
  return db.users[id];
}

// ── API Keys ──────────────────────────────────────────────────────────────────
// key record = { key, userId, plan, createdAt, lastUsed, requestsToday, resetDate }

function getApiKey(key) {
  return load().api_keys[key] || null;
}

function getApiKeysByUser(userId) {
  const db = load();
  return Object.values(db.api_keys).filter(k => k.userId === userId);
}

function createApiKey(record) {
  const db = load();
  db.api_keys[record.key] = record;
  save(db);
  return record;
}

function updateApiKey(key, fields) {
  const db = load();
  if (!db.api_keys[key]) return null;
  db.api_keys[key] = { ...db.api_keys[key], ...fields };
  save(db);
  return db.api_keys[key];
}

function deleteApiKey(key) {
  const db = load();
  delete db.api_keys[key];
  save(db);
}

// ── Rate limiting helper ──────────────────────────────────────────────────────
const DAILY_LIMITS = { free: 5, pro: 200, api_free: 10, api_pro: 500 };

function checkAndIncrementApiUsage(key) {
  const db    = load();
  const rec   = db.api_keys[key];
  if (!rec) return { allowed: false, reason: 'Invalid API key' };

  const today = new Date().toISOString().slice(0, 10);
  if (rec.resetDate !== today) {
    rec.requestsToday = 0;
    rec.resetDate = today;
  }

  const limit = rec.plan === 'pro' ? DAILY_LIMITS.api_pro : DAILY_LIMITS.api_free;
  if (rec.requestsToday >= limit) {
    return { allowed: false, reason: `Daily limit reached (${limit} requests/day). Upgrade to Pro for ${DAILY_LIMITS.api_pro}/day.` };
  }

  rec.requestsToday += 1;
  rec.lastUsed = new Date().toISOString();
  db.api_keys[key] = rec;
  save(db);

  return { allowed: true, remaining: limit - rec.requestsToday, limit };
}

module.exports = {
  getUser, getUserByEmail, getUserByCustomerId,
  createUser, updateUser,
  getApiKey, getApiKeysByUser, createApiKey, updateApiKey, deleteApiKey,
  checkAndIncrementApiUsage,
  DAILY_LIMITS,
};
