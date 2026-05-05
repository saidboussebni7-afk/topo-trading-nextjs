const { getAdminSession } = require('../../../lib/session');

export default function handler(req, res) {
  const session = getAdminSession(req);
  return res.status(200).json({
    ok: true,
    admin: Boolean(session),
    expiresAt: session?.exp || null
  });
}
