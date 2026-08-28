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
    /**
     * Mã bản dựng — ĐỔI MỖI LẦN DEPLOY.
     *
     * `__APP_VERSION__` đọc tệp `VERSION`, mà tệp ấy chỉ tăng khi PHÁT HÀNH: lần cuối là
     * v0.72.0.0, còn từ đó tới 28/08/2026 đã ship hơn 40 PR mà số không đổi. Dùng nó để dò
     * "app có đang chạy bản cũ không" là dò một thứ đứng yên — cơ chế thành ra vô dụng.
     *
     * CI truyền mã commit qua `BUILD_ID`. Chạy ở máy lập trình viên thì rơi về số phát hành,
     * và lúc ấy hai bên trùng nhau nên không báo nhầm.
     */
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID ?? readVersion()),
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
      // Ten tep service worker - CO Y khong dung `sw.js` mac dinh.
      //
      // Ngay 23/08/2026 `sw.js` duoc phuc vu kem `Cache-Control: immutable, max-age=30d`, nen
      // Cloudflare ghim dung ban ay o bien. Do ngay 29/08: duong ten mien van tra service worker
      // cua 23/08 (`Last-Modified: Sun, 23 Aug 2026`), trong khi may chu goc da la ban moi.
      //
      // Hong o day KHONG tu thoat duoc: service worker cu chan moi dieu huong va tra `index.html`
      // tu kho rieng cua no, nen trinh duyet khong bao gio nap ma moi de dang ky lai. Trinh duyet
      // co do ban moi, nhung no do dung `/sw.js` - va lai nhan ban Cloudflare dang ghim.
      //
      // Doi TEN la cach duy nhat thoat ra tu phia may chu: URL moi thi ban ghim cu khong con dinh
      // dang gi, va bo canh nginx da dat `no-cache` nen ten moi se khong bi ghim lan nua.
      filename: 'sw-v2.js',
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
    // Hạn 5s mặc định của vitest không đủ khi 164 tệp ca kiểm chạy song song: vài ca dựng
    // trang nặng bị cắt giữa chừng, và ca bị cắt còn để lại DOM chưa dọn nên ca kế tiếp
    // báo "Found multiple elements" — một lỗi hoàn toàn không liên quan đến điều nó kiểm.
    // Ca đỏ đổi chỗ mỗi lần chạy, nên đây là nhiễu chứ không phải hồi quy.
    // Nới hạn KHÔNG làm nhẹ bất kỳ khẳng định nào: không ca nào kiểm tốc độ.
    testTimeout: 20000,
    hookTimeout: 20000,
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
