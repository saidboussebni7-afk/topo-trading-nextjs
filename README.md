# TOPO TRADING VIP — Next.js

تطبيق Next.js يخدم صفحات HTML الأصلية (login / admin / signals) كما هي عبر مجلد `public/legacy/`.

## التشغيل المحلي
```bash
npm install
npm run dev
```
ثم افتح http://localhost:3000

## النشر على Vercel
1. ارفع المجلد إلى مستودع GitHub.
2. ادخل https://vercel.com/new واختر المستودع.
3. اضغط Deploy. لا حاجة لأي إعدادات إضافية.

## الصفحات
- `/`            → صفحة الدخول (license)
- `/admin`       → لوحة الأدمن
- `/signals`     → صفحة الإشارات
- `/test-jsonbin`→ صفحة اختبار JSONBin

ملفات HTML الأصلية موجودة في `public/legacy/` ويمكن تعديلها مباشرة.
