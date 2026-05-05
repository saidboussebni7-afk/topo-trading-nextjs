const events = [];

function addSecurityEvent(req, event, meta = {}) {
  events.unshift({
    ts: new Date().toISOString(),
    ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim(),
    ua: String(req.headers['user-agent'] || '').slice(0, 180),
    event,
    meta
  });

  if (events.length > 500) events.length = 500;
}

function getSecurityEvents() {
  return events.slice(0, 200);
}

module.exports = { addSecurityEvent, getSecurityEvents };
