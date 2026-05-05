const { createLicenseSession, requireSameOrigin } = require('../../../lib/session');
const { getLicenses, findLicense, normalizeCode } = require('../../../lib/jsonbin');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false });
  }

  if (!requireSameOrigin(req, res)) return;

  try {
    const code = String(
      req.body?.code ||
      req.body?.license ||
      req.body?.licenseCode ||
      ''
    ).trim();

    if (!code) {
      return res.status(400).json({ ok: false, error: 'missing_code' });
    }

    const licenses = await getLicenses();
    const lic = findLicense(licenses, code);

    if (!lic || !lic.active) {
      return res.status(401).json({ ok: false, error: 'invalid_license' });
    }

    // create session
    createLicenseSession(req, res, {
      code: lic.code,
      deviceId: req.headers['user-agent']
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('license_login_error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
