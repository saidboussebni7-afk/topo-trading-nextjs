const { createLicenseSession, requireSameOrigin } = require('../../../lib/session');
const { getLicenses, saveLicenses } = require('../../../lib/jsonbin');

function normalizeCode(code) {
  return String(code || '').replace(/-/g, '').replace(/\s+/g, '').trim().toUpperCase();
}

function publicLicense(lic) {
  return {
    code: lic.code || lic.id,
    active: lic.active !== false,
    expiresAt: lic.expiresAt || null,
    maxUsers: lic.maxUsers || lic.maxDevices || 1,
    currentUsers: Array.isArray(lic.devices) ? lic.devices.length : 0,
    devices: Array.isArray(lic.devices) ? lic.devices : []
  };
}

function getDeviceId(req) {
  const bodyDevice = req.body?.deviceId || req.body?.device || '';
  if (bodyDevice) return String(bodyDevice).slice(0, 200);

  const ua = String(req.headers['user-agent'] || 'unknown').slice(0, 120);
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
  return Buffer.from(`${ua}|${ip}`).toString('base64url').slice(0, 120);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  if (!requireSameOrigin(req, res)) return;

  try {
    const code = String(
      req.body?.code ||
      req.body?.license ||
      req.body?.licenseCode ||
      req.body?.key ||
      ''
    ).trim();

    if (!code) {
      return res.status(400).json({ ok: false, error: 'missing_code' });
    }

    const licenses = await getLicenses();
    const wanted = normalizeCode(code);

    const idx = licenses.findIndex(l => normalizeCode(l.code || l.id) === wanted);
    if (idx === -1) {
      return res.status(401).json({ ok: false, error: 'invalid_license' });
    }

    const lic = licenses[idx];
    const expires = lic.expiresAt ? new Date(lic.expiresAt).getTime() : 0;

    if (lic.active === false || (expires && expires <= Date.now())) {
      return res.status(403).json({ ok: false, error: 'license_inactive_or_expired' });
    }

    const maxUsers = Math.max(1, Number(lic.maxUsers || lic.maxDevices || 1));
    const deviceId = getDeviceId(req);
    const devices = Array.isArray(lic.devices) ? lic.devices.map(String) : [];

    if (!devices.includes(deviceId)) {
      if (devices.length >= maxUsers) {
        return res.status(403).json({ ok: false, error: 'device_limit_reached' });
      }
      devices.push(deviceId);
    }

    licenses[idx] = {
      ...lic,
      code: lic.code || lic.id,
      active: true,
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
      // Do not block login if saving device fails.
    }

    createLicenseSession(req, res, {
      code: licenses[idx].code,
      deviceId
    });

    return res.status(200).json({
      ok: true,
      valid: true,
      license: publicLicense(licenses[idx])
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
