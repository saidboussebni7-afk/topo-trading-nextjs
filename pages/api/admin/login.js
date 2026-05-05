const crypto = require('crypto');
const { createAdminSession, requireSameOrigin } = require('../../../lib/session');

// RESET HASH for password: topo2026admin
const RESET_ADMIN_HASH = 'pbkdf2$310000$c35092654fbe82a0fac84d448bcc0c77$4527b1e8d6d24e8e5666d98dbd7eeb14e308f1228945fb19cced3d25ace80edb';

function verifyPbkdf2(password, stored) {
  const parts = String(stored || '').trim().split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = Number(parts[1]);
  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  if (!Number.isFinite(iterations) || !salt.length || !expected.length) return false;

  const actual = crypto.pbkdf2Sync(String(password || ''), salt, iterations, expected.length, 'sha256');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function extractPassword(body) {
  if (!body || typeof body !== 'object') return '';
  for (const key of ['password','adminPassword','admin_password','pass','pwd','code','value','pin']) {
    if (typeof body[key] === 'string' && body[key].length) return body[key].trim();
  }
  for (const value of Object.values(body)) {
    if (typeof value === 'string' && value.length) return value.trim();
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!requireSameOrigin(req, res)) return;

  try {
    const password = extractPassword(req.body);
    const envHash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();

    const valid =
      (envHash && verifyPbkdf2(password, envHash)) ||
      verifyPbkdf2(password, RESET_ADMIN_HASH);

    if (!valid) {
      return res.status(401).json({
        ok: false,
        error: 'invalid_password',
        receivedFieldNames: Object.keys(req.body || {}),
        receivedPasswordLength: password.length
      });
    }

    createAdminSession(req, res);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('admin_login_error', e);
    return res.status(500).json({ ok: false, error: 'server_error', message: e.message });
  }
}
