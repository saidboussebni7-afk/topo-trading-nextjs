const { rateLimit } = require('../../../lib/security');
const { createLicenseSession, requireSameOrigin } = require('../../../lib/session');
const { getLicenses, saveLicenses } = require('../../../lib/jsonbin');

const EXPIRATION_GRACE_MS = 2 * 60 * 1000;

function normalizeCode(code) {
  return String(code || '')
    .replace(/-/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase();
}

function validIsoDate(value, fallbackMs) {
  const t = new Date(value || 0).getTime();

  if (Number.isFinite(t) && t > 0) {
    return new Date(t).toISOString();
  }

  return new Date(Date.now() + fallbackMs).toISOString();
}

function getDeviceId(req) {
  const bodyDevice = req.body?.deviceId || req.body?.device || '';

  if (bodyDevice) {
    return String(bodyDevice).slice(0, 200);
  }

  const ua = String(req.headers['user-agent'] || 'unknown').slice(0, 120);

  const ip = String(
    req.headers['x-forwarded-for'] ||
    req.socket?.remoteAddress ||
    'unknown'
  )
    .split(',')[0]
    .trim();

  return Buffer.from(`${ua}|${ip}`)
    .toString('base64url')
    .slice(0, 120);
}

function publicLicense(lic) {
  const days = Math.max(1, Number(lic.days || 30));

  const expiresAt = validIsoDate(
    lic.expiresAt,
    days * 24 * 60 * 60 * 1000
  );

  const expiresMs = new Date(expiresAt).getTime();

  return {
    code: lic.code || lic.id,
    active: lic.active !== false,
    expiresAt,
    expiresIn: Math.max(0, expiresMs - Date.now()),
    serverTime: new Date().toISOString(),
    graceSeconds: Math.floor(EXPIRATION_GRACE_MS / 1000),
    maxUsers: Number(lic.maxUsers || lic.maxDevices || 1),
    currentUsers: Array.isArray(lic.devices)
      ? lic.devices.length
      : 0,
    devices: Array.isArray(lic.devices)
      ? lic.devices
      : []
  };
}

export default async function handler(req, res) {
  if (!rateLimit(req, 5, 60 * 1000)) {
    return res.status(429).json({
      ok: false,
      error: 'too_many_attempts',
      message: 'Too many attempts. Try again later.'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'method_not_allowed'
    });
  }

  if (!requireSameOrigin(req, res)) {
    return;
  }

  try {
    const code = String(
      req.body?.code ||
      req.body?.license ||
      req.body?.licenseCode ||
      req.body?.key ||
      ''
    ).trim();

    if (!code) {
      return res.status(400).json({
        ok: false,
        error: 'missing_code'
      });
    }

    const licenses = await getLicenses();

    const wanted = normalizeCode(code);

    const idx = licenses.findIndex(
      (l) => normalizeCode(l.code || l.id) === wanted
    );

    if (idx === -1) {
      return res.status(401).json({
        ok: false,
        error: 'invalid_license'
      });
    }

    const lic = licenses[idx];

    const days = Math.max(
      1,
      Number(lic.days || 30)
    );

    const expiresAt = validIsoDate(
      lic.expiresAt,
      days * 24 * 60 * 60 * 1000
    );

    const expiresMs = new Date(expiresAt).getTime();

    if (
      lic.active === false ||
      expiresMs + EXPIRATION_GRACE_MS <= Date.now()
    ) {
      return res.status(403).json({
        ok: false,
        error: 'license_inactive_or_expired',
        expiresAt,
        serverTime: new Date().toISOString()
      });
    }

    const maxUsers = Math.max(
      1,
      Number(lic.maxUsers || lic.maxDevices || 1)
    );

    const deviceId = getDeviceId(req);

    const devices = Array.isArray(lic.devices)
      ? lic.devices.map(String)
      : [];

    if (!devices.includes(deviceId)) {
      if (devices.length >= maxUsers) {
        return res.status(403).json({
          ok: false,
          error: 'device_limit_reached'
        });
      }

      devices.push(deviceId);
    }

    licenses[idx] = {
      ...lic,
      code: lic.code || lic.id,
      active: true,
      expiresAt,
      devices,
      currentUsers: devices.length,
      lastLogin: new Date().toISOString()
    };

    try {
      if (typeof saveLicenses === 'function') {
        await saveLicenses(licenses);
      }
    } catch (e) {
      console.error('license_save_warning', e);
    }

    createLicenseSession(req, res, {
      code: licenses[idx].code,
      deviceId
    });

    const publicLic = publicLicense(licenses[idx]);

    return res.status(200).json({
      ok: true,
      valid: true,
      license: publicLic,
      code: publicLic.code,
      expiresAt: publicLic.expiresAt,
      expiresIn: publicLic.expiresIn,
      serverTime: publicLic.serverTime,
      graceSeconds: publicLic.graceSeconds,
      maxUsers: publicLic.maxUsers,
      currentUsers: publicLic.currentUsers
    });
  } catch (e) {
    console.error('license_login_error', e);

    return res.status(500).json({
      ok: false,
      error: 'server_error',
      message: e.message
    });
  }
}
