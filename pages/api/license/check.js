const { getIp, rateLimit, setLicenseCookie, requireSameOrigin } = require('../../../lib/session');
const { getLicenses, saveLicenses, findLicense, normalizeCode } = require('../../../lib/jsonbin');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!requireSameOrigin(req, res)) return;

  const ip = getIp(req);
  if (!rateLimit(`license-check:${ip}`, 30, 10 * 60 * 1000)) return res.status(429).json({ ok: false, error: 'too_many_attempts' });

  try {
    const code = req.body?.code;
    const deviceId = String(req.body?.deviceId || '').slice(0, 120);
    if (!normalizeCode(code) || deviceId.length < 8) return res.status(400).json({ ok: false, error: 'invalid_request' });

    const licenses = await getLicenses();
    const lic = findLicense(licenses, code);
    if (!lic) return res.status(404).json({ ok: false, error: 'not_found' });
    if (!lic.active) return res.status(403).json({ ok: false, error: 'disabled' });
    if (Date.now() > new Date(lic.expiresAt).getTime()) return res.status(403).json({ ok: false, error: 'expired' });

    const idx = licenses.indexOf(lic);
    const devices = Array.isArray(lic.devices) ? [...lic.devices] : [];
    const alreadyRegistered = devices.includes(deviceId);
    const maxUsers = Math.max(1, Number(lic.maxUsers || 1));
    if (!alreadyRegistered && devices.length >= maxUsers) return res.status(403).json({ ok: false, error: 'max_devices', maxUsers });

    if (!alreadyRegistered) devices.push(deviceId);
    licenses[idx] = { ...lic, devices, currentUsers: devices.length, lastLogin: new Date().toISOString() };
    await saveLicenses(licenses);

    setLicenseCookie(req, res, { code: normalizeCode(lic.code), deviceId, expiresAt: lic.expiresAt });
    return res.status(200).json({ ok: true, code: normalizeCode(lic.code), expiresAt: lic.expiresAt, maxUsers, currentUsers: devices.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
