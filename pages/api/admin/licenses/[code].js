const { requireAdmin, requireSameOrigin } = require('../../../../lib/session');
const { getLicenses, saveLicenses, findLicense } = require('../../../../lib/jsonbin');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!requireSameOrigin(req, res)) return;
  const code = req.query.code;
  try {
    const licenses = await getLicenses();
    const lic = findLicense(licenses, code);
    if (!lic) return res.status(404).json({ ok: false, error: 'license_not_found' });
    const idx = licenses.indexOf(lic);

    if (req.method === 'DELETE') {
      licenses.splice(idx, 1);
      const saved = await saveLicenses(licenses);
      return res.status(200).json({ ok: true, licenses: saved });
    }

    if (req.method !== 'PATCH' && req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    const action = req.body?.action;
    if (action === 'disable') licenses[idx] = { ...lic, active: false, forceLogoutAt: Date.now() };
    else if (action === 'enable') licenses[idx] = { ...lic, active: true, forceLogoutAt: null };
    else if (action === 'resetDevices' || action === 'reset_devices') licenses[idx] = { ...lic, devices: [], currentUsers: 0, forceLogoutAt: Date.now() };
    else if (action === 'extend') {
      const days = Math.max(1, Math.min(3650, Number(req.body?.days || 30)));
      const base = Math.max(new Date(lic.expiresAt).getTime(), Date.now());
      licenses[idx] = { ...lic, active: true, forceLogoutAt: null, expiresAt: new Date(base + days * 24 * 60 * 60 * 1000).toISOString() };
    } else {
      return res.status(400).json({ ok: false, error: 'unknown_action' });
    }
    const saved = await saveLicenses(licenses);
    return res.status(200).json({ ok: true, licenses: saved });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
