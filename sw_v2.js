const SW_VERSION = 'topo-vip-sw-v3';
const STATE_CACHE = 'topo-vip-bg-state';
const STATE_KEY = '/__topo_bg_state__';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await loadPersistedState();
  })());
});

let BG_STATE = {
  running: false,
  autoMode: false,
  tgToken: '',
  tgChatId: '',
  channelName: '@TopotradingVIP',
  language: 'ar',
  pairs: [],
  timeframe: '1',
  intervalMs: 8000,
  lastTickAt: 0,
  activeSignalId: null,
  activeSignal: null,
  activeUntil: 0,
};

let BG_INTERVAL = null;
let BG_TIMEOUT = null;
let BG_READY = null;

function ensureReady() {
  if (!BG_READY) BG_READY = loadPersistedState();
  return BG_READY;
}

async function getStateCache() {
  return caches.open(STATE_CACHE);
}

async function savePersistedState() {
  try {
    const cache = await getStateCache();
    await cache.put(STATE_KEY, new Response(JSON.stringify(BG_STATE), {
      headers: { 'content-type': 'application/json' },
    }));
  } catch (_) {}
}

async function loadPersistedState() {
  try {
    const cache = await getStateCache();
    const res = await cache.match(STATE_KEY);
    if (!res) return;
    const data = await res.json();
    BG_STATE = { ...BG_STATE, ...data };
  } catch (_) {}
}

function clearRuntimeTimers() {
  if (BG_INTERVAL) {
    clearInterval(BG_INTERVAL);
    BG_INTERVAL = null;
  }
  if (BG_TIMEOUT) {
    clearTimeout(BG_TIMEOUT);
    BG_TIMEOUT = null;
  }
}

async function broadcast(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) client.postMessage(message);
  return clients;
}

function scheduleActiveSignalFinalizer() {
  if (BG_TIMEOUT) clearTimeout(BG_TIMEOUT);
  if (!BG_STATE.activeSignal || !BG_STATE.activeUntil) return;
  const delay = Math.max(1000, BG_STATE.activeUntil - Date.now());
  BG_TIMEOUT = setTimeout(() => {
    Promise.resolve(finalizeBgSignal(BG_STATE.activeSignal)).catch(() => {});
  }, delay);
}

async function startBgLoop() {
  await ensureReady();
  clearRuntimeTimers();
  BG_INTERVAL = setInterval(() => {
    Promise.resolve(bgTick()).catch(() => {});
  }, BG_STATE.intervalMs || 8000);
  scheduleActiveSignalFinalizer();
  await bgTick();
}

async function stopBgLoop() {
  clearRuntimeTimers();
  BG_STATE.running = false;
  BG_STATE.autoMode = false;
  BG_STATE.activeSignalId = null;
  BG_STATE.activeSignal = null;
  BG_STATE.activeUntil = 0;
  await savePersistedState();
}

self.addEventListener('message', (event) => {
  event.waitUntil((async () => {
    await ensureReady();
    const msg = event.data || {};

    if (msg.type === 'BG_SYNC_STATE') {
      BG_STATE = { ...BG_STATE, ...msg.payload };
      await savePersistedState();
      if (BG_STATE.running && !BG_INTERVAL) await startBgLoop();
      if (!BG_STATE.running && BG_INTERVAL) await stopBgLoop();
      return;
    }

    if (msg.type === 'BG_START') {
      BG_STATE = { ...BG_STATE, ...msg.payload, running: true };
      await savePersistedState();
      await startBgLoop();
      return;
    }

    if (msg.type === 'BG_STOP') {
      await stopBgLoop();
      return;
    }

    if (msg.type === 'SHOW_NOTIFICATION') {
      const { title, body, tag } = msg.payload || {};
      await self.registration.showNotification(title || 'TOPO VIP', {
        body: body || '',
        tag: tag || 'topo-' + Date.now(),
        icon: 'https://api.iconify.design/mdi/chart-line.svg?color=%23c9a84c',
        badge: 'https://api.iconify.design/mdi/chart-line.svg?color=%23c9a84c',
        vibrate: [200, 100, 200],
        requireInteraction: false,
      });
      return;
    }

    if (msg.type === 'KEEP_ALIVE' && event.source) {
      event.source.postMessage({ type: 'ALIVE', ts: Date.now() });
    }
  })());
});

async function bgTick() {
  await ensureReady();
  if (!BG_STATE.running) return;

  BG_STATE.lastTickAt = Date.now();
  await savePersistedState();

  if (BG_STATE.activeSignal && Date.now() >= BG_STATE.activeUntil) {
    await finalizeBgSignal(BG_STATE.activeSignal);
    return;
  }

  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const visibleClient = clients.find((client) => client.visibilityState === 'visible');
  if (visibleClient) {
    visibleClient.postMessage({ type: 'SW_TICK', ts: Date.now() });
    return;
  }

  if (!BG_STATE.autoMode) return;
  if (BG_STATE.activeSignalId && Date.now() < BG_STATE.activeUntil) return;

  const sig = generateBgSignal();
  if (!sig) return;

  BG_STATE.activeSignalId = sig.id;
  BG_STATE.activeSignal = sig;
  BG_STATE.activeUntil = sig.expireTime;
  await savePersistedState();
  scheduleActiveSignalFinalizer();

  await self.registration.showNotification('📡 إشارة جديدة — ' + sig.pair, {
    body: (sig.direction === 'CALL' ? '🟢 شراء' : '🔴 بيع') + ' • ' + sig.timeframe + 'm • ' + sig.strength + '%',
    tag: 'bg-sig-' + sig.id,
    icon: 'https://api.iconify.design/mdi/chart-line.svg?color=%23c9a84c',
    vibrate: [200, 100, 200],
  });

  if (BG_STATE.tgToken && BG_STATE.tgChatId) {
    await sendBgTelegram(sig);
  }

  for (const client of clients) {
    client.postMessage({ type: 'SW_NEW_SIGNAL', signal: sig });
  }
}

function generateBgSignal() {
  if (!BG_STATE.pairs || !BG_STATE.pairs.length) return null;

  const pair = BG_STATE.pairs[Math.floor(Math.random() * BG_STATE.pairs.length)];
  const direction = Math.random() > 0.5 ? 'CALL' : 'PUT';
  const strength = 95 + Math.floor(Math.random() * 2);
  const createdAt = Date.now();
  const leadMs = 15000;
  const timeframeMin = Number(String(BG_STATE.timeframe || '1').replace(/[^\d]/g, '')) || 1;
  const entryTime = createdAt + leadMs;
  const expireTime = entryTime + timeframeMin * 60 * 1000;

  return {
    id: 'bg_' + createdAt + '_' + Math.random().toString(36).slice(2, 6),
    pair: pair.symbol || pair,
    direction,
    dir: direction,
    timeframe: timeframeMin,
    strength,
    confidence: strength,
    createdAt,
    entryTime,
    expireTime,
    predeterminedResult: Math.random() < 0.82 ? 'win' : 'loss',
    strategy: 'Background Auto',
    strengthClass: 'high',
  };
}

async function sendTelegramText(text) {
  await fetch(`https://api.telegram.org/bot${BG_STATE.tgToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: BG_STATE.tgChatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    }),
  });
}

async function sendBgTelegram(sig) {
  try {
    const arrow = sig.direction === 'CALL' ? '🟢 CALL ⬆️' : '🔴 PUT ⬇️';
    const entry = new Date(sig.entryTime).toLocaleTimeString('en-GB', { hour12: false });
    const close = new Date(sig.expireTime).toLocaleTimeString('en-GB', { hour12: false });
    const text = `📡 *TOPO TRADING VIP*\n━━━━━━━━━━━━━━━━━━\n💹 *الزوج:* \`${sig.pair}\`\n${arrow}\n⏱ *المدة:* ${sig.timeframe} دقيقة\n🕐 *الدخول:* \`${entry}\`\n🏁 *الإغلاق:* \`${close}\`\n💪 *القوة:* ${sig.strength}%\n━━━━━━━━━━━━━━━━━━\n📢 ${BG_STATE.channelName || '@TopotradingVIP'}`;
    await sendTelegramText(text);
  } catch (_) {}
}

async function sendBgTelegramResult(sig, result) {
  try {
    const text = `${result === 'win' ? '✅' : '❌'} *نتيجة الإشارة — TOPO TRADING VIP*\n━━━━━━━━━━━━━━━━━━\n💹 *الزوج:* \`${sig.pair}\`\n${sig.direction === 'CALL' ? '📈 CALL (شراء)' : '📉 PUT (بيع)'}\n⏱ *المدة:* ${sig.timeframe} دقيقة\n━━━━━━━━━━━━━━━━━━\n${result === 'win' ? '🏆 *النتيجة: ربح ✅*' : '📉 *النتيجة: خسارة ❌*'}\n━━━━━━━━━━━━━━━━━━\n📢 ${BG_STATE.channelName || '@TopotradingVIP'}`;
    await sendTelegramText(text);
  } catch (_) {}
}

async function finalizeBgSignal(sig) {
  await ensureReady();
  if (!sig) return;
  if (BG_STATE.activeSignalId !== sig.id) return;

  const result = sig.predeterminedResult || 'win';
  if (BG_STATE.autoMode && BG_STATE.tgToken && BG_STATE.tgChatId) {
    await sendBgTelegramResult(sig, result);
  }

  await broadcast({ type: 'SW_SIGNAL_RESULT', signal: sig, result });

  BG_STATE.activeSignalId = null;
  BG_STATE.activeSignal = null;
  BG_STATE.activeUntil = 0;
  BG_TIMEOUT = null;
  await savePersistedState();
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow('/');
  })());
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'topo-signals-tick') {
    event.waitUntil(bgTick());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'topo-signals-resume') {
    event.waitUntil(bgTick());
  }
});
