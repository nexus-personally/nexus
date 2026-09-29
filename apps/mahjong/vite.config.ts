import { defineConfig } from 'vite'

export default defineConfig({
  base: '/mahjong/',
  server: { proxy: { '/mahjong/api': 'http://127.0.0.1:3000', '/mahjong/ws': { target: 'ws://127.0.0.1:3000', ws: true } } },
  build: { rollupOptions: { input: { game: 'index.html', tileStudy: 'tile-study.html' } } },
})
