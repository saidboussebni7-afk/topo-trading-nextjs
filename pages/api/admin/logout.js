const { ADMIN_COOKIE, clearCookie, requireSameOrigin } = require('../../../lib/session');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!requireSameOrigin(req, res)) return;
  clearCookie(req, res, ADMIN_COOKIE);
  return res.status(200).json({ ok: true });
};
