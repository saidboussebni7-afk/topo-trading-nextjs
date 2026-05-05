const crypto = require('crypto');
const { createAdminSession, requireSameOrigin } = require('../../../lib/session');

// Fallback hash for password: kacm@2006!
// Hashed only. Later, replace ADMIN_PASSWORD_HASH in Vercel with a new hash.
const FALLBACK_ADMIN_PASSWORD_HASH = 'pbkdf2$310000$ffd49d37302672aef318bffc134806a0$bb19a8993f998bc8f114eb7a4fd77335112c93a6d2cdb4d216296405edc79eb9';

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

  const keys = ['password', 'adminPassword', 'admin_password', 'pass', 'pwd', 'code', 'value', 'pin'];

  for (const key of keys) {
    if (typeof body[key] === 'string' && body[key].length) return body[key].trim();
  }

  for (const value of Object.values(body)) {
    if (typeof value === 'string' && value.length) return value.trim();
  }

  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  if (!requireSameOrigin(req, res)) return;

  try {
    const password = extractPassword(req.body);
    const envHash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();

    const valid =
      (envHash && verifyPbkdf2(password, envHash)) ||
      verifyPbkdf2(password, FALLBACK_ADMIN_PASSWORD_HASH);

    if (!valid) {
      return res.status(401).json({
        ok: false,
        error: 'invalid_password',
        receivedFieldNames: Object.keys(req.body || {})
      });
    }

    createAdminSession(req, res);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('admin_login_error', e);
    return res.status(500).json({ ok: false, error: 'server_error', message: e.message });
  }
}
