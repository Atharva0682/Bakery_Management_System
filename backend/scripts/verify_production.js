process.env.DB_CLIENT = 'sqlite';
process.env.NODE_ENV = 'production';
process.env.SERVE_FRONTEND = 'true';
process.env.PORT = '5502';
process.env.SQLITE_DB_PATH = require('node:path').join(__dirname, '..', 'bakery.browser-verification.sqlite');
process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
require('../src/server');
(async () => {
  const health = await fetch('http://127.0.0.1:5502/api/health');
  const html = await fetch('http://127.0.0.1:5502/owner/dashboard');
  const sw = await fetch('http://127.0.0.1:5502/sw.js');
  const manifest = await fetch('http://127.0.0.1:5502/manifest.json');
  require('node:assert/strict').equal(health.status, 200);
  require('node:assert/strict').ok((await html.text()).includes('<div id="root">'));
  const worker = await sw.text(); require('node:assert/strict').ok(worker.includes('/assets/index-'));
  require('node:assert/strict').equal((await manifest.json()).icons[0].type, 'image/png');
  console.log('PASS production backend startup, database health, SPA route fallback, built service-worker asset list and PNG manifest');
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
