import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

function offlineAssets() {
  return {
    name: 'gangque-offline-assets',
    closeBundle() {
      const root = join(import.meta.dirname, 'dist')
      const files: string[] = []
      const visit = (directory: string) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name)
          if (entry.isDirectory()) visit(path)
          else {
            const name = relative(root, path).replaceAll('\\', '/')
            if (name === 'sw.js' || name === 'design-compare.html' || name === 'qa-reference-current.png' || /(?:reference|license)\./.test(name) || name.includes('tile-study') || name.includes('tileStudy-') || name.includes('wall-stack-') || name.includes('wall-row-')) continue
            files.push(name)
          }
        }
      }
      visit(root)
      files.sort()
      const digest = createHash('sha256')
      for (const file of files) digest.update(file).update(readFileSync(join(root, file)))
      const source = readFileSync(join(import.meta.dirname, 'public/sw.js'), 'utf8')
      writeFileSync(join(root, 'sw.js'), source
        .replace('__CACHE_VERSION__', digest.digest('hex').slice(0, 12))
        .replace('globalThis.__GANGQUE_PRECACHE__ ?? []', JSON.stringify(['/mahjong/', ...files.filter(file => file !== 'index.html').map(file => `/mahjong/${file}`)])))
    },
  }
}

export default defineConfig({
  base: '/mahjong/',
  plugins: [offlineAssets()],
  server: { proxy: { '/mahjong/api': 'http://127.0.0.1:3000', '/mahjong/ws': { target: 'ws://127.0.0.1:3000', ws: true } } },
  build: { rollupOptions: { input: { game: 'index.html', tileStudy: 'tile-study.html' } } },
})
