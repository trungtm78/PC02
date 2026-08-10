import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

const VERSION_FILE = path.resolve(__dirname, '../VERSION')

function readVersion() {
  return fs.readFileSync(VERSION_FILE, 'utf-8').trim()
}

// Watch ../VERSION and trigger full-reload + update __APP_VERSION__ when it changes.
function versionWatcher(): Plugin {
  return {
    name: 'version-watcher',
    configureServer(server) {
      server.watcher.add(VERSION_FILE)
      server.watcher.on('change', (file) => {
        if (file.replace(/\\/g, '/') === VERSION_FILE.replace(/\\/g, '/')) {
          const newVersion = readVersion()
          // Update the define so new module requests get the fresh value
          if (server.config.define) {
            server.config.define['__APP_VERSION__'] = JSON.stringify(newVersion)
          }
          server.ws.send({ type: 'full-reload' })
          server.config.logger.info(`[version-watcher] VERSION changed → ${newVersion}`)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(readVersion()),
  },
  plugins: [
    react(),
    tailwindcss(),
    versionWatcher(),
    // PWA: makes PC02 installable on mobile devices.
    // - registerType: 'prompt' (auto-decision #12) so users opt in to updates,
    //   preventing form-state loss from silent SW replacement.
    // - Workbox API allowlist: ONLY /api/v1/health is cached. /notifications
    //   contains case/petition/incident metadata (PII exfiltration risk via
    //   CacheStorage); /feature-flags can serve stale role-based menu config.
    //   Both are now NetworkOnly. Single allowlist entry for /health enables
    //   offline degraded-mode detection without exposing user data.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'logo-cong-an.png', 'icons/apple-touch-icon.png'],
      workbox: {
        // Narrow precache: shell (js/css/html) + own icons only. Other PNGs/SVGs
        // are not precached so map tiles, embedded SVGs, and large images don't
        // bloat client storage on slow networks.
        globPatterns: ['**/*.{js,css,html,ico,woff2}', 'icons/*.png'],
        runtimeCaching: [
          {
            // Health check — cache for offline degraded-mode detection.
            // No PII; safe to cache and survive logout.
            urlPattern: ({ url }) => url.pathname === '/api/v1/health',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pc02-health',
              expiration: { maxAgeSeconds: 300, maxEntries: 1 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
            },
          },
          // NetworkOnly for everything else under /api/v1/* — case/incident/
          // petition data, user data, notifications, feature flags, search
          // results, the SSE stream (which carries the auth token in the URL).
          // Codex review caught that /notifications carries case IDs (PII) and
          // /feature-flags can serve stale role/permission config from cache.
        ],
      },
      manifest: {
        name: 'PC02 Quản lý Án',
        short_name: 'PC02',
        description: 'Hệ thống quản lý vụ án, vụ việc, đơn thư PC02 Công An',
        theme_color: '#003973',
        background_color: '#F7F6F2',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'vi-VN',
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        // Don't generate SW in dev — keeps vite hot-reload simple
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // `permission-mapping.test.ts` reads the backend permission seed with
    // `?raw` so the frontend mapping cannot silently drift from it. Vite
    // refuses to serve a file outside the project root unless it is allowed
    // here. `node:fs` would avoid this, but only by adding `node` to the app
    // tsconfig's `types`, which changes global typing for the whole project.
    fs: { allow: ['.', '../backend/prisma'] },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Any *.test.ts(x) under src/, not only those inside a __tests__ folder.
    // The narrower pattern silently skipped src/hooks/useMasterClassOptions.test.ts,
    // so a test file could be added and never run.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Must stay above the Testing Library asyncUtilTimeout set in
    // src/test-setup.ts. At the default 5000 the two are equal, so a slow
    // `findBy*` trips vitest's own timeout first and reports a generic
    // "Test timed out" instead of Testing Library's message naming the query
    // and dumping the DOM.
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/pages/objects/**/*.ts',
        'src/pages/objects/**/*.tsx',
        'src/pages/cases/**/*.ts',
        'src/components/AppSidebar.tsx',
        'src/pages/workflow/**/*.ts',
        'src/pages/workflow/**/*.tsx',
      ],
      exclude: [
        'src/**/__tests__/**',
      ],
    },
  },
})
