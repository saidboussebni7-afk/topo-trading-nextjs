const crypto = require('crypto');
const { getIp, rateLimit, secureCompare, setAdminCookie, requireSameOrigin } = require('../../../lib/session');

function verifyAdminPassword(password) {
  const storedHash = process.env.ADMIN_PASSWORD_HASH;
  if (storedHash && storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    const salt = parts[2];
    const expected = parts[3];
    if (!iterations || !salt || !expected) return false;
    const derived = crypto.pbkdf2Sync(String(password || ''), salt, iterations, 32, 'sha256').toString('hex');
    const a = Buffer.from(derived, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  const plain = process.env.ADMIN_PASSWORD;
  if (plain && plain.length >= 10) return secureCompare(password, plain);
  throw new Error('admin_password_not_configured');
}

module.exports = function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!requireSameOrigin(req, res)) return;

  const ip = getIp(req);
  if (!rateLimit(`admin-login:${ip}`, 8, 10 * 60 * 1000)) return res.status(429).json({ ok: false, error: 'too_many_attempts' });

  try {
    const password = req.body && req.body.password;
    if (!verifyAdminPassword(password)) return res.status(401).json({ ok: false, error: 'bad_password' });
    setAdminCookie(req, res);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'admin_password_not_configured' });
  }
};
