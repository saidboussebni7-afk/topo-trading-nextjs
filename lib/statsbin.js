const MAX_STATS = 10000;

function requireJsonBinConfig() {
  const id = process.env.JSONBIN_ID;
  const key = process.env.JSONBIN_KEY;
  if (!id || !key) throw new Error('JSONBIN_ID or JSONBIN_KEY is missing');
  return { id, key, url: `https://api.jsonbin.io/v3/b/${id}` };
}

async function requestJsonBin(path = '/latest', options = {}) {
  const cfg = requireJsonBinConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(cfg.url + path, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': cfg.key,
        'X-Bin-Versioning': 'false',
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) {}
    if (!res.ok) {
      const err = new Error('jsonbin_request_failed');
      err.status = res.status;
      err.data = data || text;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function getRecord() {
  const data = await requestJsonBin('/latest', { method: 'GET' });
  const record = data && data.record && typeof data.record === 'object' ? data.record : {};
  if (!Array.isArray(record.licenses)) record.licenses = [];
  if (!Array.isArray(record.statsHistory)) record.statsHistory = [];
  return record;
}

async function saveRecord(record) {
  const safe = {
    ...(record || {}),
    licenses: Array.isArray(record?.licenses) ? record.licenses : [],
    statsHistory: Array.isArray(record?.statsHistory) ? record.statsHistory.slice(-MAX_STATS) : []
  };
  await requestJsonBin('', { method: 'PUT', body: JSON.stringify(safe) });
  return safe;
}

function cleanStat(input) {
  const result = input?.result === 'loss' ? 'loss' : input?.result === 'win' ? 'win' : null;
  if (!result) return null;
  return {
    result,
    pair: String(input?.pair || '').replace(/[<>]/g, '').slice(0, 40),
    direction: input?.direction === 'PUT' ? 'PUT' : 'CALL',
    timeframe: Math.max(1, Math.min(60, Number(input?.timeframe || 3))),
    ts: Date.now(),
    createdAt: Number(input?.createdAt || Date.now())
  };
}

function summarizeStats(statsHistory, hours) {
  const h = Number(hours || 24);
  const cutoff = h > 0 ? Date.now() - h * 3600 * 1000 : 0;
  const filtered = (statsHistory || []).filter(s => Number(s.ts || 0) >= cutoff);
  const win = filtered.filter(s => s.result === 'win').length;
  const loss = filtered.filter(s => s.result === 'loss').length;
  const total = win + loss;
  return {
    win,
    loss,
    total,
    rate: total ? Math.round((win / total) * 100) : null,
    hours: h,
    updatedAt: new Date().toISOString()
  };
}

module.exports = { getRecord, saveRecord, cleanStat, summarizeStats };
