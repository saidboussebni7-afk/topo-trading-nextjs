/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://api.iconify.design",
      "connect-src 'self'",
      "worker-src 'self' blob:",
    ].join('; '),
  },
];

module.exports = {
  reactStrictMode: false,
  async rewrites() {
    return [
      { source: '/', destination: '/legacy/login.html' },
      { source: '/signals', destination: '/legacy/signals.html' },
      { source: '/vip-admin-6d8f2a', destination: '/vip-admin-6d8f2a/index.html' },
    ];
  },
  async redirects() {
    return [
      { source: '/sojod', destination: '/', permanent: false },
      { source: '/admin', destination: '/', permanent: false },
      { source: '/test-jsonbin', destination: '/', permanent: false },
      { source: '/legacy/admin.html', destination: '/', permanent: false },
      { source: '/legacy/test-jsonbin.html', destination: '/', permanent: false },
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/vip-admin-6d8f2a', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] },
      { source: '/vip-admin-6d8f2a/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] },
    ];
  },
};
