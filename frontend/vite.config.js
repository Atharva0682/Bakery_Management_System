import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
function productionOfflineShell() {
  let outDir
  return {
    name: 'crumbco-offline-shell',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir) },
    closeBundle() {
      const assetsDir = path.join(outDir, 'assets')
      const assets = fs.readdirSync(assetsDir).filter(file => /\.(js|css)$/.test(file)).map(file => '/assets/' + file)
      const shell = ['/', '/index.html', '/favicon.svg', '/manifest.json', '/assets/logos/icon-180.png', '/assets/logos/icon-192.png', '/assets/logos/icon-512.png', ...assets]
      const hash = createHash('sha256').update(fs.readFileSync(path.join(outDir, 'index.html'))).digest('hex').slice(0, 12)
      const swPath = path.join(outDir, 'sw.js')
      const sw = fs.readFileSync(swPath, 'utf8').replace(/const CACHE_NAME = .*?;/, `const CACHE_NAME = 'crumbco-${hash}';`).replace(/const STATIC_ASSETS = .*?;/, `const STATIC_ASSETS = ${JSON.stringify(shell)};`)
      fs.writeFileSync(swPath, sw)
    },
  }
}
export default defineConfig({
  plugins: [react(), productionOfflineShell()],
  server: { host: true, port: 5173, proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } } },
})
