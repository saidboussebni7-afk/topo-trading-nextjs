const { requireAdmin, requireSameOrigin } = require('../../../../lib/session');
const { getLicenses, saveLicenses, normalizeCode } = require('../../../../lib/jsonbin');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!requireSameOrigin(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  try {
    const codes = Array.isArray(req.body?.codes) ? req.body.codes.map(normalizeCode) : [];
    const set = new Set(codes);
    const licenses = await getLicenses();
    const kept = licenses.filter(l => !set.has(normalizeCode(l.code || l.id)));
    const saved = await saveLicenses(kept);
    return res.status(200).json({ ok: true, deleted: licenses.length - kept.length, licenses: saved });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
