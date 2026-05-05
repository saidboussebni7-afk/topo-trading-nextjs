const { clearLicenseSession } = require('../../../lib/session');

export default function handler(req, res) {
  clearLicenseSession(res);
  return res.status(200).json({ ok: true });
}
