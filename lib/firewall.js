const blocked = new Map();

function getIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function blockIp(ip, ttlMs = 60 * 60 * 1000) {
  blocked.set(ip, Date.now() + ttlMs);
}

function isBlockedIp(ip) {
  const until = blocked.get(ip);
  if (!until) return false;
  if (Date.now() > until) {
    blocked.delete(ip);
    return false;
  }
  return true;
}

function requireNotBlocked(req, res) {
  const ip = getIp(req);
  if (isBlockedIp(ip)) {
    res.status(403).json({ ok: false, error: 'blocked' });
    return false;
  }
  return true;
}

module.exports = { getIp, blockIp, isBlockedIp, requireNotBlocked };
