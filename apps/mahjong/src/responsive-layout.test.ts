import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const lobbyCss = readFileSync(new URL('./lobby-reference.css', import.meta.url), 'utf8')
const appCss = readFileSync(new URL('./app3d.css', import.meta.url), 'utf8')

test('phone and tablet widths do not activate large desktop lobby chrome', () => {
  assert.match(lobbyCss, /@media \(min-width:1200px\) and \(min-height:700px\)/)
  assert.doesNotMatch(lobbyCss, /@media \(min-width:901px\)/)
})

test('tablet rooms use a smaller dedicated scale instead of the desktop canvas scale', () => {
  assert.match(lobbyCss, /@media \(min-width:760px\) and \(max-width:1199px\) and \(min-height:651px\)/)
  assert.match(lobbyCss, /--room-u:min\(\.68px,\.0664vw,\.088dvh\)/)
})

test('low-height landscape devices receive a compact profile dialog', () => {
  assert.match(appCss, /@media\(orientation:landscape\) and \(max-height:500px\)/)
  assert.match(appCss, /max-height:calc\(100dvh - 20px\)!important/)
  assert.match(appCss, /\.account-profile-form\{z-index:1200!important\}/)
})

test('guide dialog stays above the portaled account bar', () => {
  assert.match(appCss, /\.modal-shade:has\(\.guide-panel\)\{position:fixed;z-index:1100\}/)
})

test('seat action splash has a compact landscape size and reduced-motion fallback', () => {
  assert.match(appCss, /\.action-splash-seat-0\{[^}]*left:50%;top:59%/)
  assert.match(appCss, /\.action-splash-seat-1\{[^}]*left:88%;top:36%/)
  assert.match(appCss, /\.action-splash-seat-2\{[^}]*left:50%;top:17%/)
  assert.match(appCss, /@media\(max-width:1100px\) and \(orientation:landscape\)\{\.action-splash\{width:clamp\(115px,18cqw,220px\)/)
  assert.match(appCss, /@media\(prefers-reduced-motion:reduce\)\{\.action-splash/)
})
