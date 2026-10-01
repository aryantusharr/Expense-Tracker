import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const LIVE_PROJECT_ID = 'splitease-7bb6c'

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
    plugins: [react()],
  }
})
