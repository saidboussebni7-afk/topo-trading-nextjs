const crypto = require('crypto');

const ADMIN_COOKIE = 'topo_admin_session';
const LICENSE_COOKIE = 'topo_license_session';

function getSecret() {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET/ADMIN_SESSION_SECRET is missing or too short. Use at least 32 random characters.');
  }
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payload) {
  const data = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); }
  catch (_) { return null; }
  if (!payload || typeof payload !== 'object') return null;
  if (payload.exp && Date.now() > Number(payload.exp)) return null;
  return payload;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  });
  return out;
}

function isSecureRequest(req) {
  const proto = req.headers['x-forwarded-proto'];
  const host = req.headers.host || '';
  return proto === 'https' || (!host.startsWith('localhost') && !host.startsWith('127.0.0.1'));
}

function cookieHeader(name, value, options = {}, req) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (options.maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (isSecureRequest(req)) parts.push('Secure');
  return parts.join('; ');
}

function setAdminCookie(req, res) {
  const token = signPayload({ type: 'admin', exp: Date.now() + 8 * 60 * 60 * 1000 });
  res.setHeader('Set-Cookie', cookieHeader(ADMIN_COOKIE, token, { maxAge: 8 * 60 * 60 }, req));
}

function setLicenseCookie(req, res, { code, deviceId, expiresAt }) {
  const expMs = Math.min(new Date(expiresAt).getTime(), Date.now() + 7 * 24 * 60 * 60 * 1000);
  const maxAge = Math.max(60, Math.floor((expMs - Date.now()) / 1000));
  const token = signPayload({ type: 'license', code, deviceId, exp: expMs });
  res.setHeader('Set-Cookie', cookieHeader(LICENSE_COOKIE, token, { maxAge }, req));
}

function clearCookie(req, res, name) {
  res.setHeader('Set-Cookie', cookieHeader(name, '', { maxAge: 0 }, req));
}

function getAdminSession(req) {
  try {
    const token = parseCookies(req)[ADMIN_COOKIE];
    const payload = verifyToken(token);
    return payload && payload.type === 'admin' ? payload : null;
  } catch (_) { return null; }
}

function getLicenseSession(req) {
  try {
    const token = parseCookies(req)[LICENSE_COOKIE];
    const payload = verifyToken(token);
    return payload && payload.type === 'license' ? payload : null;
  } catch (_) { return null; }
}

function requireAdmin(req, res) {
  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return null;
  }
  return session;
}

function sameOrigin(req) {
  const method = req.method || 'GET';
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = req.headers.host;
    return new URL(origin).host === host;
  } catch (_) {
    return false;
  }
}

function requireSameOrigin(req, res) {
  if (!sameOrigin(req)) {
    res.status(403).json({ ok: false, error: 'bad_origin' });
    return false;
  }
  return true;
}

function getIp(req) {
  const raw = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  return String(raw).split(',')[0].trim();
}

const buckets = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const rec = buckets.get(key) || { count: 0, reset: now + windowMs };
  if (now > rec.reset) {
    rec.count = 0;
    rec.reset = now + windowMs;
  }
  rec.count += 1;
  buckets.set(key, rec);
  return rec.count <= limit;
}

function secureCompare(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

module.exports = {
  ADMIN_COOKIE,
  LICENSE_COOKIE,
  getIp,
  rateLimit,
  secureCompare,
  setAdminCookie,
  setLicenseCookie,
  clearCookie,
  getAdminSession,
  getLicenseSession,
  requireAdmin,
  requireSameOrigin,
};
