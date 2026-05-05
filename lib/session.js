const crypto = require('crypto');

const ADMIN_COOKIE = 'topo_admin_session';
const LICENSE_COOKIE = 'topo_license_session';
const SESSION_VERSION = 4;

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(';')
      .map(v => v.trim())
      .filter(Boolean)
      .map(v => {
        const i = v.indexOf('=');
        if (i === -1) return [decodeURIComponent(v), ''];
        return [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))];
      })
  );
}

function requireSameOrigin(req, res) {
  const method = String(req.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    try {
      if (new URL(origin).host === host) return true;
    } catch (_) {}
  }

  if (referer) {
    try {
      if (new URL(referer).host === host) return true;
    } catch (_) {}
  }

  res.status(403).json({ ok: false, error: 'forbidden_origin' });
  return false;
}

function getSecret() {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || 'temporary-dev-secret-change-in-vercel-32chars';
  return s;
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromB64url(input) {
  return Buffer.from(String(input || ''), 'base64url').toString('utf8');
}

function signPayload(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function verifySignedToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;

  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return null;

  let payload = null;
  try { payload = JSON.parse(fromB64url(body)); } catch (_) { return null; }

  if (!payload || payload.v !== SESSION_VERSION) return null;
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

function cookieString(name, value, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Strict${secure}`;
}

function clearCookieString(name) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`;
}

function verifyPasswordHash(password, stored) {
  const parts = String(stored || '').trim().split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = Number(parts[1]);
  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  if (!Number.isFinite(iterations) || !salt.length || !expected.length) return false;

  const actual = crypto.pbkdf2Sync(String(password || ''), salt, iterations, expected.length, 'sha256');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function createAdminSession(req, res) {
  const now = Date.now();
  const maxAge = Number(process.env.ADMIN_SESSION_MAX_AGE || 60 * 60);
  const payload = {
    v: SESSION_VERSION,
    typ: 'admin',
    iat: now,
    exp: now + maxAge * 1000
  };
  res.setHeader('Set-Cookie', cookieString(ADMIN_COOKIE, signPayload(payload), maxAge));
}

function clearAdminSession(res) {
  res.setHeader('Set-Cookie', clearCookieString(ADMIN_COOKIE));
}

function getAdminSession(req) {
  const cookies = parseCookies(req);
  const payload = verifySignedToken(cookies[ADMIN_COOKIE]);
  if (!payload || payload.typ !== 'admin') return null;
  return payload;
}

function requireAdmin(req, res) {
  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'admin_required' });
    return false;
  }
  return true;
}

function createLicenseSession(req, res, data = {}) {
  const now = Date.now();
  const maxAge = Number(process.env.LICENSE_SESSION_MAX_AGE || 12 * 60 * 60);
  const payload = {
    v: SESSION_VERSION,
    typ: 'license',
    code: String(data.code || data.license || data.licenseCode || ''),
    deviceId: String(data.deviceId || data.device || ''),
    iat: now,
    exp: now + maxAge * 1000
  };
  res.setHeader('Set-Cookie', cookieString(LICENSE_COOKIE, signPayload(payload), maxAge));
  return payload;
}

function getLicenseSession(req) {
  const cookies = parseCookies(req);
  const payload = verifySignedToken(cookies[LICENSE_COOKIE]);
  if (!payload || payload.typ !== 'license') return null;
  return payload;
}

function clearLicenseSession(res) {
  res.setHeader('Set-Cookie', clearCookieString(LICENSE_COOKIE));
}

function requireLicense(req, res) {
  const session = getLicenseSession(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'license_required' });
    return false;
  }
  return true;
}

// Backward-compatible aliases for older files.
const setLicenseSession = createLicenseSession;
const createUserSession = createLicenseSession;
const setUserSession = createLicenseSession;
const createAuthSession = createLicenseSession;
const setAuthSession = createLicenseSession;
const clearUserSession = clearLicenseSession;
const clearAuthSession = clearLicenseSession;
const getUserSession = getLicenseSession;
const getAuthSession = getLicenseSession;
const requireUser = requireLicense;
const requireAuth = requireLicense;

module.exports = {
  ADMIN_COOKIE,
  LICENSE_COOKIE,
  parseCookies,
  requireSameOrigin,

  verifyPasswordHash,

  createAdminSession,
  clearAdminSession,
  getAdminSession,
  requireAdmin,

  createLicenseSession,
  getLicenseSession,
  clearLicenseSession,
  requireLicense,

  setLicenseSession,
  createUserSession,
  setUserSession,
  createAuthSession,
  setAuthSession,
  clearUserSession,
  clearAuthSession,
  getUserSession,
  getAuthSession,
  requireUser,
  requireAuth
};
