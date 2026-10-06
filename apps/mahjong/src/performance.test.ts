import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const tableSource = readFileSync(new URL('./table3d/ThreeTable.tsx', import.meta.url), 'utf8')
const audioSource = readFileSync(new URL('./audio.ts', import.meta.url), 'utf8')

test('mobile WebGL uses a bounded render budget instead of full refresh-rate rendering', () => {
  assert.match(tableSource, /MOBILE_MAX_PIXEL_RATIO\s*=\s*1\.35/)
  assert.match(tableSource, /TARGET_FRAME_INTERVAL\s*=\s*1000\s*\/\s*30/)
  assert.match(tableSource, /shadow\.mapSize\.set\(1024,\s*1024\)/)
  assert.match(tableSource, /this\.continuousRendering\s*=\s*game\.phase\s*!==\s*'result'/)
})

test('rendering and audio pause while the page is hidden', () => {
  assert.match(tableSource, /visibilitychange/)
  assert.match(tableSource, /document\.hidden/)
  assert.match(audioSource, /visibilitychange/)
  assert.match(audioSource, /context\.suspend\(\)/)
})
