const { getIp, rateLimit, getAdminSession, getLicenseSession, requireSameOrigin } = require('../../../lib/session');

async function sendTelegram(text, parseMode) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Telegram environment variables are missing.');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode || 'Markdown', disable_web_page_preview: false }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.description || `Telegram failed: ${res.status}`);
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!requireSameOrigin(req, res)) return;

  const admin = getAdminSession(req);
  const license = getLicenseSession(req);
  const allowLicenseSend = process.env.ALLOW_LICENSE_TELEGRAM_SEND !== 'false';
  if (!admin && !(allowLicenseSend && license)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const ip = getIp(req);
  const limitKey = admin ? `telegram-admin:${ip}` : `telegram-license:${license.code}:${ip}`;
  if (!rateLimit(limitKey, admin ? 120 : 30, 60 * 60 * 1000)) return res.status(429).json({ ok: false, error: 'too_many_messages' });

  const text = String(req.body?.text || '').slice(0, 3900);
  const parseMode = req.body?.parse_mode === 'HTML' ? 'HTML' : 'Markdown';
  if (!text.trim()) return res.status(400).json({ ok: false, error: 'empty_message' });

  try {
    const data = await sendTelegram(text, parseMode);
    return res.status(200).json({ ok: true, result: data.result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'telegram_error', description: e.message });
  }
};
