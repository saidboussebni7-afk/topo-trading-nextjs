/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: false,
  async rewrites() {
    return [
      { source: '/',          destination: '/legacy/login.html' },
      { source: '/admin',     destination: '/legacy/admin.html' },
      { source: '/signals',   destination: '/legacy/signals.html' },
      { source: '/test-jsonbin', destination: '/legacy/test-jsonbin.html' }
    ];
  }
};
