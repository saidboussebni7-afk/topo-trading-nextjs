const rateLimitMap = new Map();

function rateLimit(req, limit = 5, windowMs = 60 * 1000) {
  const ip =
    String(req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      .trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const now = Date.now();
  const record = rateLimitMap.get(ip) || {
    count: 0,
    start: now
  };

  if (now - record.start > windowMs) {
    rateLimitMap.set(ip, {
      count: 1,
      start: now
    });

    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  rateLimitMap.set(ip, record);

  return true;
}

module.exports = {
  rateLimit
};
