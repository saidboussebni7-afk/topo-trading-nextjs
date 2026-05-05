function normalizeSymbol(symbol) {
  const raw = String(symbol || '').replace(/[^A-Za-z/]/g, '').toUpperCase();
  if (raw.includes('/')) return raw;
  if (raw.length === 6) return raw.slice(0, 3) + '/' + raw.slice(3);
  return raw;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const provider = process.env.MARKET_DATA_PROVIDER || 'twelvedata';
  const key = process.env.TWELVE_DATA_API_KEY;
  const symbol = normalizeSymbol(req.query?.symbol);

  if (provider !== 'twelvedata') return res.status(400).json({ ok: false, error: 'unsupported_provider' });
  if (!key) return res.status(500).json({ ok: false, error: 'TWELVE_DATA_API_KEY_missing' });
  if (!symbol || symbol.includes('OTC')) return res.status(400).json({ ok: false, error: 'unsupported_symbol' });

  try {
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
    const r = await fetch(url, { cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    const price = Number(data.price);
    if (!r.ok || !Number.isFinite(price)) {
      return res.status(502).json({ ok: false, error: data.message || data.code || 'price_unavailable' });
    }
    return res.status(200).json({ ok: true, symbol, price, provider: 'twelvedata', ts: Date.now() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
