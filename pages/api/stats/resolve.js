const { getRecord, saveRecord, cleanStat } = require('../../../lib/statsbin');
const { requireSameOrigin } = require('../../../lib/session');

function normalizeSymbol(symbol) {
  const raw = String(symbol || '').replace(/\s+OTC$/i, '').replace(/[^A-Za-z/]/g, '').toUpperCase();
  if (raw.includes('/')) return raw;
  if (raw.length === 6) return raw.slice(0, 3) + '/' + raw.slice(3);
  return raw;
}

async function getPrice(symbol) {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error('TWELVE_DATA_API_KEY_missing');
  const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
  const r = await fetch(url, { cache: 'no-store' });
  const data = await r.json().catch(() => ({}));
  const price = Number(data.price);
  if (!r.ok || !Number.isFinite(price)) {
    const err = new Error(data.message || data.code || 'price_unavailable');
    err.data = data;
    throw err;
  }
  return price;
}

export default async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  try {
    const pair = String(req.body?.pair || '');
    if (/OTC/i.test(pair)) return res.status(400).json({ ok: false, error: 'otc_not_supported_without_real_feed' });

    const symbol = normalizeSymbol(pair);
    const direction = req.body?.direction === 'PUT' ? 'PUT' : 'CALL';
    const entryPrice = Number(req.body?.entryPrice);
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      return res.status(400).json({ ok: false, error: 'missing_entry_price' });
    }

    const closePrice = await getPrice(symbol);
    let result = 'draw';
    if (direction === 'CALL') result = closePrice > entryPrice ? 'win' : closePrice < entryPrice ? 'loss' : 'draw';
    else result = closePrice < entryPrice ? 'win' : closePrice > entryPrice ? 'loss' : 'draw';

    if (result === 'win' || result === 'loss') {
      const record = await getRecord();
      record.statsHistory = Array.isArray(record.statsHistory) ? record.statsHistory : [];
      const stat = cleanStat({
        result,
        pair,
        direction,
        timeframe: req.body?.timeframe,
        createdAt: req.body?.entryTime || Date.now()
      });
      if (stat) {
        stat.entryPrice = entryPrice;
        stat.closePrice = closePrice;
        stat.real = true;
        record.statsHistory.push(stat);
        record.statsHistory = record.statsHistory.slice(-10000);
        await saveRecord(record);
      }
    }

    return res.status(200).json({
      ok: true,
      pair,
      symbol,
      direction,
      entryPrice,
      closePrice,
      result,
      provider: 'twelvedata'
    });
  } catch(e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message || 'server_error' });
  }
}
