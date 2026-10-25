import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser, __APP_VERSION__: 'readonly', __APP_BUILD__: 'readonly', __APP_DATE__: 'readonly', __APP_BUILD_ID__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Guardrail: keep files small enough to read in one go (see ARCHITECTURE.md). Warns, never blocks.
    files: ['src/**/*.{js,jsx}'],
    ignores: ['**/*.test.js'],
    rules: { 'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }] },
  },
])
