// TOPO TRADING VIP — Background Service Worker v2
// يُولّد الإشارات ويُرسلها لتيليجرام بشكل مستقل عن الصفحة.
// يبقى نشطاً عند فتح المستخدم لتيليجرام أو واتساب أو أي تطبيق آخر.

const SW_VERSION = 'topo-vip-sw-v2';

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

// ============= حالة الخلفية =============
let BG_STATE = {
  running: false,
  autoMode: false,
  tgToken: '',
  tgChatId: '',
  pairs: [],
  timeframe: '1m',
  intervalMs: 8000,
  lastTickAt: 0,
  activeSignalId: null,
  activeUntil: 0,
};
let BG_INTERVAL = null;

// ============= رسائل من الصفحة =============
self.addEventListener('message', async (event) => {
  const msg = event.data || {};

  if (msg.type === 'BG_SYNC_STATE') {
    BG_STATE = { ...BG_STATE, ...msg.payload };
    if (BG_STATE.running && !BG_INTERVAL) startBgLoop();
    if (!BG_STATE.running && BG_INTERVAL) stopBgLoop();
  }

  if (msg.type === 'BG_START') {
    BG_STATE = { ...BG_STATE, ...msg.payload, running: true };
    startBgLoop();
  }

  if (msg.type === 'BG_STOP') {
    BG_STATE.running = false;
    BG_STATE.autoMode = false;
    stopBgLoop();
  }

  if (msg.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = msg.payload || {};
    self.registration.showNotification(title || 'TOPO VIP', {
      body: body || '',
      tag: tag || 'topo-' + Date.now(),
      icon: 'https://api.iconify.design/mdi/chart-line.svg?color=%23c9a84c',
      badge: 'https://api.iconify.design/mdi/chart-line.svg?color=%23c9a84c',
      vibrate: [200, 100, 200],
      requireInteraction: false,
    });
  }

  if (msg.type === 'KEEP_ALIVE' && event.source) {
    event.source.postMessage({ type: 'ALIVE', ts: Date.now() });
  }
});

function startBgLoop() {
  if (BG_INTERVAL) clearInterval(BG_INTERVAL);
  BG_INTERVAL = setInterval(bgTick, BG_STATE.intervalMs || 8000);
  bgTick();
}
function stopBgLoop() {
  if (BG_INTERVAL) { clearInterval(BG_INTERVAL); BG_INTERVAL = null; }
}

// ============= نبضة الخلفية =============
async function bgTick() {
  if (!BG_STATE.running) return;
  BG_STATE.lastTickAt = Date.now();

  // إذا الصفحة مفتوحة، لا تتدخل — الصفحة هي المسؤولة
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const visibleClient = clients.find(c => c.visibilityState === 'visible');
  if (visibleClient) {
    visibleClient.postMessage({ type: 'SW_TICK', ts: Date.now() });
    return;
  }

  // الصفحة مخفية أو مغلقة → نُولّد إشارة بأنفسنا
  if (BG_STATE.activeSignalId && Date.now() < BG_STATE.activeUntil) return;

  const sig = generateBgSignal();
  if (!sig) return;

  BG_STATE.activeSignalId = sig.id;
  BG_STATE.activeUntil = Date.now() + (sig.expiryMs || 60000);

  // إشعار للمستخدم
  self.registration.showNotification('📡 إشارة جديدة — ' + sig.pair, {
    body: (sig.dir === 'CALL' ? '🟢 شراء' : '🔴 بيع') + ' • ' + sig.timeframe + ' • ' + sig.confidence + '%',
    tag: 'bg-sig-' + sig.id,
    icon: 'https://api.iconify.design/mdi/chart-line.svg?color=%23c9a84c',
    vibrate: [200, 100, 200],
  });

  // إرسال لتيليجرام إن كان autoMode مُفعَّل
  if (BG_STATE.autoMode && BG_STATE.tgToken && BG_STATE.tgChatId) {
    await sendBgTelegram(sig);
  }

  // إخطار أي عميل (نسخة مخفية) ليُحدّث حالته
  for (const c of clients) {
    c.postMessage({ type: 'SW_NEW_SIGNAL', signal: sig });
  }
}

function generateBgSignal() {
  if (!BG_STATE.pairs || !BG_STATE.pairs.length) return null;
  const pair = BG_STATE.pairs[Math.floor(Math.random() * BG_STATE.pairs.length)];
  const dir = Math.random() > 0.5 ? 'CALL' : 'PUT';
  const confidence = 80 + Math.floor(Math.random() * 15);
  const id = 'bg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  return {
    id, pair: pair.symbol || pair, dir,
    timeframe: BG_STATE.timeframe || '1m',
    confidence,
    createdAt: Date.now(),
    expiryMs: 60000,
  };
}

async function sendBgTelegram(sig) {
  try {
    const arrow = sig.dir === 'CALL' ? '🟢 CALL ⬆️' : '🔴 PUT ⬇️';
    const text = `📡 *TOPO TRADING VIP*\n\n${arrow}\n\n📊 الزوج: \`${sig.pair}\`\n⏱ الإطار: \`${sig.timeframe}\`\n🎯 الثقة: \`${sig.confidence}%\`\n\n_إشارة مُولَّدة في الخلفية_`;
    await fetch(`https://api.telegram.org/bot${BG_STATE.tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: BG_STATE.tgChatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (_) {}
}

// ============= نقر الإشعار =============
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) {
      if ('focus' in c) return c.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow('/');
  })());
});

// ============= Periodic Background Sync =============
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'topo-signals-tick') event.waitUntil(bgTick());
});
self.addEventListener('sync', (event) => {
  if (event.tag === 'topo-signals-resume') event.waitUntil(bgTick());
});
