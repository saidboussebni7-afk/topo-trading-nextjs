const buckets = new Map();

function getIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function rateLimit({ keyPrefix = 'global', windowMs = 60000, max = 60 } = {}) {
  return function limiter(req, res) {
    const ip = getIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const bucket = buckets.get(key) || [];
    const fresh = bucket.filter(ts => now - ts < windowMs);
    fresh.push(now);
    buckets.set(key, fresh);

    if (fresh.length > max) {
      res.status(429).json({ ok: false, error: 'too_many_requests' });
      return false;
    }

    return true;
  };
}

module.exports = { rateLimit, getIp };
