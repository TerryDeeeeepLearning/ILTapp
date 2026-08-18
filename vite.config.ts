import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  base: './',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'IELTS Listening Trainer',
        short_name: 'ILT',
        description: '離線雅思聽力訓練器',
        start_url: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#171614',
        theme_color: '#171614',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/audio\/.*\.(mp3|m4a)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ilt-audio',
              expiration: { maxEntries: 4000 },
              rangeRequests: true
            }
          },
          {
            urlPattern: /\/timings\/.*\.json$/,
            handler: 'CacheFirst',
            options: { cacheName: 'ilt-timings', expiration: { maxEntries: 4000 } }
          }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom'
  }
} as never);
