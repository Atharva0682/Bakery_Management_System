/**
 * Crumb & Co. Unified Application Launcher
 * Starts both Backend API (Port 5000) and Frontend Vite PWA (Port 5173) concurrently.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';
const viteBin = path.join(__dirname, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js');

console.log('==============================================================================');
console.log('       CRUMB & CO. ARTISANAL BAKERY MANAGEMENT SYSTEM (BANDRA WEST)');
console.log('==============================================================================\n');

// 1. Start Backend Server
console.log('[Launcher] Starting Backend API Server on Port 5000...');
const backendProcess = spawn(process.execPath, ['src/server.js'], {
  cwd: path.join(__dirname, 'backend'),
  env: { ...process.env, DB_CLIENT: process.env.DB_CLIENT || 'sqlite' },
  stdio: ['ignore', 'pipe', 'pipe']
});

backendProcess.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) console.log(`[Backend]  ${line.trim()}`);
  });
});

backendProcess.stderr.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) console.error(`[Backend ERR] ${line.trim()}`);
  });
});

// 2. Start Frontend Dev Server
console.log('[Launcher] Starting Frontend React PWA Application on Port 5173...\n');
let frontendProcess;
if (fs.existsSync(viteBin)) {
  frontendProcess = spawn(process.execPath, [viteBin], {
    cwd: path.join(__dirname, 'frontend'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
} else {
  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  frontendProcess = spawn(npmCmd, ['run', 'dev'], {
    cwd: path.join(__dirname, 'frontend'),
    env: process.env,
    shell: isWin,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

frontendProcess.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    const clean = line.replace(/\x1Bc/g, '').trim();
    if (clean) console.log(`[Frontend] ${clean}`);
  });
});

frontendProcess.stderr.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) console.error(`[Frontend ERR] ${line.trim()}`);
  });
});

// Summary display
setTimeout(() => {
  console.log('\n==============================================================================');
  console.log('Systems Initialized Successfully!');
  console.log('  Customer Storefront:      http://localhost:5173/');
  console.log('  Staff Floor PWA:          http://localhost:5173/staff/login');
  console.log('  Owner Operations Portal:  http://localhost:5173/owner/login');
  console.log('  Backend REST API:         http://localhost:5000/api/health');
  console.log('');
  console.log('Default Accounts:');
  console.log('  Owner:    owner@crumbco.com     / Password@123');
  console.log('  Baker:    baker@crumbco.com     / Password@123');
  console.log('  Customer: customer@crumbco.com  / Password@123 (or Guest checkout)');
  console.log('==============================================================================\n');
}, 3000);

// Graceful cleanup handler
function shutdown() {
  console.log('\n[Launcher] Stopping servers...');
  try { backendProcess.kill(); } catch (e) {}
  try { frontendProcess.kill(); } catch (e) {}
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

backendProcess.on('exit', (code) => {
  if (code !== null && code !== 0) console.error(`[Backend] Exited with code ${code}`);
});

frontendProcess.on('exit', (code) => {
  if (code !== null && code !== 0) console.error(`[Frontend] Exited with code ${code}`);
});
