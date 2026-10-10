import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * GitHub Pages 的项目站点在 https://<用户>.github.io/<仓库名>/ 下，
 * 所以站点根不是 '/' 而是 '/<仓库名>/'。改仓库名就得改这里。
 *
 * dev 和 build 用同一个 base —— 不在开发时用 '/' 而在构建时换掉。
 * 两边不一致的话，路径 bug 只在发布后才暴露，那时候最难查。
 */
const BASE = '/fitness-app/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '动作库 · 健身助手',
        short_name: '动作库',
        description: '1324 个健身动作的中文检索与训练记录',
        lang: 'zh-CN',
        theme_color: '#0d0f12',
        background_color: '#0d0f12',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 只预缓存应用外壳和动作数据（约 1.2 MB）。
        // media/ 有 2648 个文件 130 MB，预缓存会直接把安装拖死。
        globPatterns: ['**/*.{js,css,html}', 'data/*.json'],
        globIgnores: ['**/media/**', '**/icons/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // 图片和 GIF 看过就缓存，健身房弱网时还能翻已看过的动作。
            // 设上限，否则 130 MB 全进缓存会占满手机存储。
            urlPattern: /\/media\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-media',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true, // 手机连同一 WiFi 就能打开
  },
});
