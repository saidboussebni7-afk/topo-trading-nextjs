const crypto = require('crypto');
const { createAdminSession, requireSameOrigin } = require('../../../lib/session');

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  if (!requireSameOrigin(req, res)) return;

  try {
    const password = String(req.body?.password || '');
    const hash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();

    if (!hash || !verifyPbkdf2(password, hash)) {
      return res.status(401).json({ ok: false, error: 'invalid_password' });
    }

    createAdminSession(req, res);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('admin_login_error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
