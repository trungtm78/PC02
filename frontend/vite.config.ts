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
    // - Workbox API allowlist (auto-decision #15): only non-PII endpoints
    //   (/health, /notifications, /feature-flags) are cached. Case/incident/petition
    //   data is NEVER cached to avoid CacheStorage exfiltration risk.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'logo-cong-an.png', 'icons/apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Health check — cache for offline degraded-mode detection
            urlPattern: ({ url }) => url.pathname === '/api/v1/health',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pc02-health',
              expiration: { maxAgeSeconds: 300, maxEntries: 1 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Notifications listing — read-only, no PII beyond user's own notifs
            urlPattern: ({ url }) => url.pathname.startsWith('/api/v1/notifications'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pc02-notifications',
              expiration: { maxAgeSeconds: 300, maxEntries: 20 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Feature flags — defines which modules user can see
            urlPattern: ({ url }) => url.pathname === '/api/v1/feature-flags',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pc02-feature-flags',
              expiration: { maxAgeSeconds: 600, maxEntries: 1 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
            },
          },
          // All other /api/* requests are NOT cached. Case/incident/petition data,
          // user data, search results, etc. always hit the network. No silent fallback
          // to stale data that could mislead investigators in the field.
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
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
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
