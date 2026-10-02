import process from 'node:process'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const LIVE_PROJECT_ID = 'splitease-7bb6c'

// App version (package.json), build number (commit count) and release date — shown in the app
// and written to /version.json so an open app can tell which version it's updating to.
const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version
const BUILD = (() => { try { return execSync('git rev-list --count HEAD').toString().trim() } catch { return '0' } })()
const DATE = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
const versionFile = () => ({
  name: 'splitease-version-json',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION, build: BUILD, date: DATE }) })
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
    },
    // launch tooling hands out a free port through PORT; plain `npm run dev` stays on 5173
    server: process.env.PORT ? { port: Number(process.env.PORT) } : {},
  }
})
