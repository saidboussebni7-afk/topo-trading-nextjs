const crypto = require('crypto');

const DAY_MS = 24 * 60 * 60 * 1000;

function requireJsonBinConfig() {
  const id = process.env.JSONBIN_ID;
  const key = process.env.JSONBIN_KEY;
  if (!id || !key) throw new Error('JSONBIN_ID or JSONBIN_KEY is missing');
  return { id, key, url: `https://api.jsonbin.io/v3/b/${id}` };
}

function normalizeCode(code) {
  return String(code || '').replace(/-/g, '').replace(/\s+/g, '').trim().toUpperCase();
}

function formatCode(code) {
  const raw = normalizeCode(code);
  if (raw.length === 12) return raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8, 12);
  return String(code || '').trim().toUpperCase();
}

function cleanText(value, max = 300) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function toIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function normalizeLicense(license) {
  const lic = { ...(license || {}) };
  if (!lic.code && lic.id) lic.code = lic.id;
  lic.code = formatCode(lic.code);
  lic.devices = Array.isArray(lic.devices) ? lic.devices.filter(Boolean).map(String).slice(0, 1000) : [];
  lic.currentUsers = lic.devices.length;
  lic.maxUsers = Math.max(1, Math.min(1000, Number(lic.maxUsers || lic.maxDevices || 1)));
  lic.days = Math.max(0, Number(lic.days || 0));
  lic.active = lic.active !== false;
  lic.createdAt = toIso(lic.createdAt) || new Date().toISOString();
  lic.expiresAt = toIso(lic.expiresAt) || new Date(Date.now() + Math.max(1, lic.days || 30) * DAY_MS).toISOString();
  lic.lastLogin = toIso(lic.lastLogin);
  lic.note = cleanText(lic.note || '');

  const expiresMs = new Date(lic.expiresAt).getTime();
  if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) {
    lic.active = false;
    lic.expiredAt = lic.expiredAt || new Date(expiresMs).toISOString();
    lic.forceLogoutAt = lic.forceLogoutAt || Date.now();
  }
  return lic;
}

async function requestJsonBin(path = '/latest', options = {}) {
  const cfg = requireJsonBinConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(cfg.url + path, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': cfg.key,
        'X-Bin-Versioning': 'false',
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) {}
    if (!res.ok) {
      const err = new Error('jsonbin_request_failed');
      err.status = res.status;
      err.data = data || text;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function getLicenses() {
  const data = await requestJsonBin('/latest', { method: 'GET' });
  const record = data && data.record ? data.record : {};
  const licenses = Array.isArray(record.licenses) ? record.licenses : [];
  return licenses.map(normalizeLicense).filter(l => l.code);
}

async function saveLicenses(licenses) {
  const payload = { licenses: (licenses || []).map(normalizeLicense).filter(l => l.code) };
  await requestJsonBin('', { method: 'PUT', body: JSON.stringify(payload) });
  return payload.licenses;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let raw = '';
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i += 1) raw += chars[bytes[i] % chars.length];
  return raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8, 12);
}

function makeLicense({ days = 30, maxUsers = 1, note = '' } = {}) {
  const d = Math.max(1, Math.min(3650, Number(days || 30)));
  const m = Math.max(1, Math.min(1000, Number(maxUsers || 1)));
  const now = Date.now();
  return normalizeLicense({
    code: generateCode(),
    active: true,
    days: d,
    maxUsers: m,
    currentUsers: 0,
    devices: [],
    note: cleanText(note),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + d * DAY_MS).toISOString(),
    lastLogin: null,
  });
}

function findLicense(licenses, code) {
  const normalized = normalizeCode(code);
  return (licenses || []).find(l => normalizeCode(l.code || l.id) === normalized) || null;
}

function publicLicense(lic) {
  return {
    code: lic.code,
    active: lic.active,
    days: lic.days,
    maxUsers: lic.maxUsers,
    currentUsers: Array.isArray(lic.devices) ? lic.devices.length : 0,
    devices: Array.isArray(lic.devices) ? lic.devices : [],
    note: lic.note || '',
    expiresAt: lic.expiresAt,
    createdAt: lic.createdAt,
    lastLogin: lic.lastLogin || null,
    forceLogoutAt: lic.forceLogoutAt || null
  };
}

module.exports = {
  DAY_MS,
  normalizeCode,
  normalizeLicense,
  getLicenses,
  saveLicenses,
  generateCode,
  makeLicense,
  findLicense,
  publicLicense
};
