const { requireAdmin, requireSameOrigin } = require('../../../lib/session');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;
  if (!requireSameOrigin(req, res)) return;

  const pair = String(req.body?.pair || '').slice(0, 40);
  const dir = req.body?.dir === 'PUT' ? 'PUT' : 'CALL';
  const tf = Math.max(1, Math.min(60, Number(req.body?.tf || 3)));
  const strat = String(req.body?.strat || 'Manual').slice(0, 60);
  const strength = Math.max(1, Math.min(99, Number(req.body?.strength || 85)));
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ ok: false, error: 'telegram_not_configured' });

  const entryTime = new Date(Date.now() + 25000);
  const expireTime = new Date(entryTime.getTime() + tf * 60000);
  const isCall = dir === 'CALL';
  const msg = `${isCall ? '📈' : '📉'} *TOPO TRADING VIP* ${isCall ? '📈' : '📉'}\n━━━━━━━━━━━━━━━━━━\n💹 *الزوج:* \`${pair}\`\n${isCall ? '🟢 شراء (CALL)' : '🔴 بيع (PUT)'}\n📊 *الاستراتيجية:* ${strat}\n⏱ *المدة:* ${tf} دقيقة\n━━━━━━━━━━━━━━━━━━\n🕐 *وقت الدخول:* \`${entryTime.toLocaleTimeString('en-GB',{hour12:false})}\`\n🏁 *وقت الإغلاق:* \`${expireTime.toLocaleTimeString('en-GB',{hour12:false})}\`\n💪 *قوة الإشارة:* ${strength}%\n━━━━━━━━━━━━━━━━━━\n🎯 *سجّل في Pocket Option:*\n[احصل على بونص 50%](https://po-ru1.click/register?utm_campaign=801367&utm_source=affiliate&utm_medium=sr&a=cdMx4feSVrHSxW&ac=topovip&code=50START)\n📢 @TopotradingVIP\n_⚠️ التداول ينطوي على مخاطر_`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown', disable_web_page_preview: false }),
    });
    const data = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || !data.ok) return res.status(500).json({ ok: false, error: 'telegram_error', description: data.description || 'Telegram failed' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
