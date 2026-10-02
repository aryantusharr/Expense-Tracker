import process from 'node:process'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const LIVE_PROJECT_ID = 'splitease-7bb6c'

// App version (package.json), build number (commit count) and release date — shown in the app
// and written to /version.json so an open app can tell which version it's updating to.
const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version
const BUILD = (() => { try { return execSync('git rev-list --count HEAD').toString().trim() } catch { return '0' } })()
const DATE = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
const BUILD_ID = `${VERSION}-${BUILD}-${Date.now().toString(36)}`
const versionFile = () => ({
  name: 'splitease-version-json',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION, build: BUILD, date: DATE, id: BUILD_ID }) })
  },
  // public/sw.js is copied as-is; stamp its cache name so every build ships a "new" service worker.
  writeBundle(opts) {
    const sw = join(opts.dir || 'dist', 'sw.js')
    if (existsSync(sw)) writeFileSync(sw, readFileSync(sw, 'utf8').replace('__BUILD_ID__', BUILD_ID))
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Safety guard: only a production build may talk to the live Firebase project.
  // `npm run dev` (development) and `npm run build:test` (test) must use the test project.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (mode !== 'production' && env.VITE_FIREBASE_PROJECT_ID === LIVE_PROJECT_ID) {
    throw new Error(
      `[SplitEase] "${mode}" mode is pointed at the LIVE Firebase project (${LIVE_PROJECT_ID}). ` +
      `Put the test project's settings in .env.${mode}.local.`
    )
  }

  return {
    plugins: [react(), versionFile()],
    define: {
      __APP_VERSION__: JSON.stringify(VERSION),
      __APP_BUILD__: JSON.stringify(BUILD),
      __APP_DATE__: JSON.stringify(DATE),
      __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
    },
    // launch tooling hands out a free port through PORT; plain `npm run dev` stays on 5173
    server: process.env.PORT ? { port: Number(process.env.PORT) } : {},
  }
})
