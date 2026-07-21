#!/usr/bin/env node
/**
 * POS QA smoke test against live backend.
 *
 * Usage (PowerShell):
 *   $env:GYM_EMAIL="admin@gym.com"; $env:GYM_PASSWORD="***"; node scripts/pos-qa.mjs
 *
 * Optional platform super-admin:
 *   $env:PLATFORM_EMAIL="..."; $env:PLATFORM_PASSWORD="..."; node scripts/pos-qa.mjs --platform
 */

const API = (process.env.NEXT_PUBLIC_API_URL || 'https://fitnixtrackbackend.vercel.app').replace(/\/$/, '');

const POS_KEYS = [
  'gym.pos.catalog.read',
  'gym.pos.products.manage',
  'gym.pos.inventory.manage',
  'gym.pos.sell',
  'gym.pos.discounts.manage',
  'gym.pos.revenue.read',
];

function log(icon, name, detail = '') {
  console.log(`${icon}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(path, { method = 'GET', token, gymId, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (gymId) headers['X-Gym-Id'] = String(gymId);
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function login(email, password, platform = false) {
  const path = platform ? '/api/platform/auth/login' : '/api/auth/login';
  const { status, json } = await request(path, {
    method: 'POST',
    body: { email, password },
  });
  if (!json.success) {
    throw new Error(`Login failed (${status}): ${json.error?.message || 'unknown'}`);
  }
  return {
    token: json.data.token,
    user: json.data.user,
  };
}

function expandKeys(keys) {
  const set = new Set(keys);
  const imply = (from, ...to) => {
    if (!set.has(from)) return;
    for (const k of to) set.add(k);
  };
  for (let i = 0; i < 3; i++) {
    imply('gym.pos.products.manage', 'gym.pos.catalog.read');
    imply('gym.pos.inventory.manage', 'gym.pos.catalog.read');
    imply('gym.pos.sell', 'gym.pos.catalog.read');
  }
  return set;
}

async function runGymQa() {
  const email = process.env.GYM_EMAIL;
  const password = process.env.GYM_PASSWORD;
  if (!email || !password) {
    log('⚠️', 'Gym login skipped', 'Set GYM_EMAIL and GYM_PASSWORD to run live API tests');
    return;
  }

  console.log('\n── Gym POS QA ──\n');
  const { token, user } = await login(email, password);
  const gymId = user.gymId;
  log('✅', 'Login', `${user.name} (${user.role}) gymId=${gymId}`);

  const keys = expandKeys(user.permissionKeys || []);
  log(keys.size ? '✅' : '⚠️', 'permissionKeys', `${user.permissionKeys?.length ?? 0} raw, ${keys.size} effective`);
  for (const k of POS_KEYS) {
    log(keys.has(k) ? '  ✓' : '  ✗', k);
  }

  // Permissions catalog
  const permRes = await request('/api/gym/permissions', { token, gymId });
  if (permRes.status === 200 && permRes.json.success) {
    const catalog = permRes.json.data?.permissions || permRes.json.data || [];
    const catalogKeys = new Set(catalog.map((p) => p.key));
    const missing = POS_KEYS.filter((k) => !catalogKeys.has(k));
    log(missing.length ? '⚠️' : '✅', 'Permission catalog', missing.length ? `Missing: ${missing.join(', ')}` : 'All POS keys present');
  } else {
    log('❌', 'GET /api/gym/permissions', `${permRes.status} ${permRes.json.error?.message || ''}`);
  }

  const endpoints = [
    ['/api/pos/catalog?includeDisabled=true', 'gym.pos.catalog.read'],
    ['/api/pos/products?productType=NUTRIENT&limit=5', 'gym.pos.catalog.read'],
    ['/api/pos/sales?limit=5', 'gym.pos.catalog.read'],
    ['/api/pos/reports/summary?groupBy=day', 'gym.pos.revenue.read'],
  ];

  for (const [path, requiredKey] of endpoints) {
    const { status, json } = await request(path, { token, gymId });
    const allowed = keys.has(requiredKey) || user.role === 'GYM_ADMIN';
    if (status === 200 && json.success) {
      log('✅', path, allowed ? 'OK' : 'Unexpected 200 without permission');
    } else if (status === 403) {
      log(allowed ? '❌' : '✅', path, `403 (expected=${!allowed}) ${json.error?.message || ''}`);
    } else {
      log('❌', path, `${status} ${json.error?.message || JSON.stringify(json).slice(0, 120)}`);
    }
  }

  // Catalog structure
  const cat = await request('/api/pos/catalog?includeDisabled=true', { token, gymId });
  if (cat.json.success) {
    const categories = cat.json.data?.categories || cat.json.data?.catalog || cat.json.data || [];
    const arr = Array.isArray(categories) ? categories : [];
    let subCount = 0;
    for (const c of arr) subCount += (c.subcategories || []).length;
    log('ℹ️', 'Catalog tree', `${arr.length} categories, ${subCount} subcategories`);
  }

  // Write probe (only if manage permission)
  if (keys.has('gym.pos.products.manage') || user.role === 'GYM_ADMIN') {
    const put = await request('/api/pos/gym-subcategories', {
      method: 'PUT',
      token,
      gymId,
      body: { subcategoryIds: [] },
    });
    log(put.status === 200 || put.status === 204 ? '✅' : '❌', 'PUT /api/pos/gym-subcategories', `${put.status} ${put.json.error?.message || 'saved empty list'}`);
  } else {
    log('⏭️', 'PUT /api/pos/gym-subcategories', 'Skipped — no gym.pos.products.manage');
  }
}

async function runPlatformQa() {
  const email = process.env.PLATFORM_EMAIL;
  const password = process.env.PLATFORM_PASSWORD;
  if (!email || !password) {
    log('⚠️', 'Platform login skipped', 'Set PLATFORM_EMAIL and PLATFORM_PASSWORD');
    return;
  }

  console.log('\n── Platform POS QA ──\n');
  const { token, user } = await login(email, password, true);
  log('✅', 'Platform login', `${user.email} (${user.role})`);

  for (const path of [
    '/api/platform/pos/catalog',
    '/api/platform/pos/analytics?groupBy=day',
  ]) {
    const { status, json } = await request(path, { token });
    log(status === 200 && json.success ? '✅' : '❌', path, `${status} ${json.error?.message || ''}`);
  }
}

async function main() {
  console.log(`Backend: ${API}`);
  const platformOnly = process.argv.includes('--platform');
  if (!platformOnly) await runGymQa();
  if (process.argv.includes('--platform') || process.env.PLATFORM_EMAIL) {
    await runPlatformQa();
  }
  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
