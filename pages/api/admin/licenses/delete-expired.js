const { requireAdmin, requireSameOrigin } = require('../../../../lib/session');
const { getLicenses, saveLicenses } = require('../../../../lib/jsonbin');

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (!requireSameOrigin(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  try {
    const licenses = await getLicenses();
    const now = Date.now();
    const kept = licenses.filter(l => l.active && new Date(l.expiresAt).getTime() > now);
    const saved = await saveLicenses(kept);
    return res.status(200).json({ ok: true, deleted: licenses.length - kept.length, licenses: saved });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
