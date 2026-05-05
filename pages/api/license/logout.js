export default function handler(req, res) {
  res.setHeader('Set-Cookie', [
    'topo_license=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure',
    'topo_device=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure'
  ]);
  return res.status(200).json({ ok: true });
}
