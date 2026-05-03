import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
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
  plugins: [react(), tailwindcss(), versionWatcher()],
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
