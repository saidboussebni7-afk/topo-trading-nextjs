const { requireAdmin, requireSameOrigin } = require('../../../lib/session');
const { getLicenses, saveLicenses, makeLicense, findLicense, normalizeCode } = require('../../../lib/jsonbin');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!requireSameOrigin(req, res)) return;

  try {
    if (req.method === 'GET') {
      const licenses = await getLicenses();
      return res.status(200).json({ ok: true, licenses });
    }

    if (req.method === 'PUT') {
      const incoming = Array.isArray(req.body?.licenses) ? req.body.licenses : [];
      const licenses = await saveLicenses(incoming);
      return res.status(200).json({ ok: true, licenses });
    }

    if (req.method === 'POST') {
      const action = req.body?.action || 'generate';
      const licenses = await getLicenses();

      if (action === 'generate') {
        const count = Math.max(1, Math.min(50, Number(req.body.count || 1)));
        const generated = [];
        const used = new Set(licenses.map(l => normalizeCode(l.code || l.id)));
        for (let i = 0; i < count; i += 1) {
          let lic = makeLicense({ days: req.body.days, maxUsers: req.body.maxUsers, note: req.body.note });
          while (used.has(normalizeCode(lic.code))) lic = makeLicense({ days: req.body.days, maxUsers: req.body.maxUsers, note: req.body.note });
          used.add(normalizeCode(lic.code));
          generated.push(lic);
        }
        const saved = await saveLicenses([...generated, ...licenses]);
        return res.status(200).json({ ok: true, generated, created: generated, licenses: saved });
      }

      const code = req.body?.code;
      const lic = findLicense(licenses, code);
      if (!lic) return res.status(404).json({ ok: false, error: 'license_not_found' });
      const idx = licenses.indexOf(lic);

      if (action === 'disable') licenses[idx] = { ...lic, active: false, forceLogoutAt: Date.now() };
      else if (action === 'enable') licenses[idx] = { ...lic, active: true, forceLogoutAt: null };
      else if (action === 'reset_devices') licenses[idx] = { ...lic, devices: [], currentUsers: 0, forceLogoutAt: Date.now() };
      else if (action === 'extend') {
        const days = Math.max(1, Math.min(3650, Number(req.body.days || 30)));
        const base = Math.max(new Date(lic.expiresAt).getTime(), Date.now());
        licenses[idx] = { ...lic, active: true, forceLogoutAt: null, expiresAt: new Date(base + days * 24 * 60 * 60 * 1000).toISOString() };
      }
      else if (action === 'delete') licenses.splice(idx, 1);
      else return res.status(400).json({ ok: false, error: 'unknown_action' });

      const saved = await saveLicenses(licenses);
      return res.status(200).json({ ok: true, licenses: saved });
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
