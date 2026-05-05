const { verifyPasswordHash, createAdminSession, requireSameOrigin } = require('../../../lib/session');
const { rateLimit, getIp } = require('../../../lib/ratelimit');
const { requireNotBlocked, blockIp } = require('../../../lib/firewall');
const { addSecurityEvent } = require('../../../lib/security-log');

const loginLimiter = rateLimit({ keyPrefix: 'admin-login', windowMs: 15 * 60 * 1000, max: 8 });
const failures = new Map();

function addFailure(req) {
  const ip = getIp(req);
  const item = failures.get(ip) || { count: 0, reset: Date.now() + 15 * 60 * 1000 };
  if (Date.now() > item.reset) {
    item.count = 0;
    item.reset = Date.now() + 15 * 60 * 1000;
  }
  item.count += 1;
  failures.set(ip, item);

  if (item.count >= 8) {
    blockIp(ip, 60 * 60 * 1000);
    addSecurityEvent(req, 'admin_ip_blocked', { count: item.count });
  }
}

function clearFailure(req) {
  failures.delete(getIp(req));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!requireNotBlocked(req, res)) return;
  if (!loginLimiter(req, res)) return;
  if (!requireSameOrigin(req, res)) return;

  const password = String(req.body?.password || '');
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash || !verifyPasswordHash(password, hash)) {
    addFailure(req);
    addSecurityEvent(req, 'admin_login_failed');
    return res.status(401).json({ ok: false, error: 'invalid_password' });
  }

  clearFailure(req);
  createAdminSession(req, res);
  addSecurityEvent(req, 'admin_login_success');
  return res.status(200).json({ ok: true });
}
