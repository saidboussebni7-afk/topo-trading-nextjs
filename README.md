# TOPO TRADING VIP — نسخة محمية

هذه النسخة تغلق سبب الاختراق الموجود في النسخة القديمة: لم يعد هناك باسورد أدمن أو `JSONBIN_KEY` أو Telegram Bot Token داخل ملفات HTML/JavaScript العامة.

## الملفات المهمة

- `public/legacy/admin.html` — لوحة الأدمن الجديدة، بدون أسرار داخل المتصفح.
- `public/legacy/login.html` — صفحة الدخول أصبحت تتحقق عبر `/api/license/check`.
- `public/legacy/signals.html` — صفحة الإشارات أصبحت تتحقق عبر `/api/license/status`.
- `pages/api/admin/*` — عمليات الأدمن المحمية.
- `pages/api/license/*` — تحقق الترخيص من السيرفر.
- `lib/*` — التحقق من الجلسة، JSONBin، rate limit.
- `scripts/hash-password.js` — توليد هاش باسورد الأدمن وسر الجلسة.
- `.env.example` — قالب متغيرات البيئة.

## التشغيل المحلي

```bash
npm install
cp .env.example .env.local
npm run secure:hash
```

انسخ القيم التي يعطيها السكربت إلى `.env.local`:

```bash
ADMIN_PASSWORD_HASH=...
ADMIN_SESSION_SECRET=...
```

ثم ضع بيانات JSONBin الخاصة بك داخل `.env.local`:

```bash
JSONBIN_ID=...
JSONBIN_KEY=...
```

ثم شغّل:

```bash
npm run dev
```

افتح:

- `/` صفحة دخول المستخدمين.
- `/signals` صفحة الإشارات.
- `/sojod` أو `/admin` لوحة الأدمن.

## النشر على Vercel

1. ارفع هذا المجلد إلى GitHub.
2. افتح مشروعك على Vercel.
3. من Settings > Environment Variables أضف:

```bash
JSONBIN_ID
JSONBIN_KEY
ADMIN_PASSWORD_HASH
ADMIN_SESSION_SECRET
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
ALLOW_LICENSE_TELEGRAM_SEND
```

`TELEGRAM_BOT_TOKEN` و `TELEGRAM_CHAT_ID` اختياريان. يحتاجهما زر إرسال الإشارة من الأدمن، وأيضاً إرسال تيليجرام من صفحة الإشارات إذا تركت `ALLOW_LICENSE_TELEGRAM_SEND=true`.

4. أعد النشر Deploy.

## مهم جداً بعد الاختراق

غيّر مفتاح JSONBin القديم فوراً أو أنشئ Bin جديداً. المفتاح القديم كان مكشوفاً في النسخة السابقة.

غيّر Telegram Bot Token من BotFather إذا كنت قد استخدمته داخل المتصفح سابقاً.

احذف أي نشر قديم يحتوي على:

- `public/legacy/test-jsonbin.html`
- باسورد أدمن داخل JavaScript
- `JSONBIN_KEY` داخل HTML/JS
- Telegram Bot Token داخل HTML/JS

## ملاحظات أمنية

- رابط الأدمن يمكن أن يعرفه أي شخص، لذلك الحماية ليست بإخفاء الرابط. الحماية الحقيقية الآن في API + جلسة HttpOnly.
- لا يوجد نظام “لا يمكن اختراقه 100%”، لكن هذه النسخة تزيل سبب الاختراق الأساسي في ملفاتك القديمة.
- لا ترفع `.env.local` إلى GitHub.
- غيّر باسورد الأدمن بتوليد `ADMIN_PASSWORD_HASH` جديد ثم تحديثه في Vercel.
