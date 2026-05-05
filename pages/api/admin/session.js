const { getAdminSession } = require('../../../lib/session');

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  return res.status(200).json({ ok: !!getAdminSession(req) });
};
