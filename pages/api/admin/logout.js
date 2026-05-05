const { clearAdminSession, requireSameOrigin } = require('../../../lib/session');

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!requireSameOrigin(req, res)) return;
  clearAdminSession(res);
  return res.status(200).json({ ok: true });
}
