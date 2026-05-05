const crypto = require('crypto');
const readline = require('readline');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

(async () => {
  const password = process.argv[2] || await ask('اكتب باسورد الأدمن الجديد: ');
  if (!password || password.length < 10) {
    console.error('الباسورد يجب أن يكون 10 أحرف على الأقل.');
    process.exit(1);
  }
  const iterations = 310000;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  console.log('\nضع هذه القيم في Vercel Environment Variables أو .env.local:\n');
  console.log(`ADMIN_PASSWORD_HASH=pbkdf2$${iterations}$${salt}$${hash}`);
  console.log(`ADMIN_SESSION_SECRET=${secret}`);
  console.log('\nلا ترفع .env.local إلى GitHub.');
})();
