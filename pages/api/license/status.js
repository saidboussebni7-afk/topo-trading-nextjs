const { getLicenseSession, requireSameOrigin } = require('../../../lib/session');
const { getLicenses, findLicense, normalizeCode } = require('../../../lib/jsonbin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!requireSameOrigin(req, res)) return;

  const session = getLicenseSession(req);
  if (!session) return res.status(401).json({ ok: false, error: 'no_session' });

  try {
    const requestedCode = normalizeCode(req.body?.code || session.code);
    const requestedDevice = String(req.body?.deviceId || session.deviceId || '');
    if (requestedCode !== normalizeCode(session.code) || requestedDevice !== session.deviceId) return res.status(403).json({ ok: false, error: 'session_mismatch' });

    const licenses = await getLicenses();
    const lic = findLicense(licenses, session.code);
    if (!lic) return res.status(404).json({ ok: false, error: 'not_found' });
    if (!lic.active) return res.status(403).json({ ok: false, error: 'disabled' });
    if (Date.now() > new Date(lic.expiresAt).getTime()) return res.status(403).json({ ok: false, error: 'expired' });
    if (Array.isArray(lic.devices) && lic.devices.length > 0 && !lic.devices.includes(session.deviceId)) return res.status(403).json({ ok: false, error: 'device_removed' });

    return res.status(200).json({ ok: true, expiresAt: lic.expiresAt });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
