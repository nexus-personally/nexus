import assert from 'node:assert/strict'
import test from 'node:test'
import { ROOM_RECONNECT_DELAY_MS, sendSocketMessage } from './room-network.ts'

test('room reconnect feedback does not leave controls inert for several seconds', () => {
  assert.ok(ROOM_RECONNECT_DELAY_MS <= 1000)
})

test('room actions report failure instead of disappearing while the socket is reconnecting', () => {
  let sent = ''
  const socket = { readyState: 0, send: (value: string) => { sent = value } }
  assert.equal(sendSocketMessage(socket, { type: 'create', count: 4 }), false)
  assert.equal(sent, '')
})

test('room actions report success only after writing to an open socket', () => {
  let sent = ''
  const socket = { readyState: 1, send: (value: string) => { sent = value } }
  assert.equal(sendSocketMessage(socket, { type: 'leave' }), true)
  assert.equal(sent, JSON.stringify({ type: 'leave' }))
})

test('room actions remain retryable when an open socket throws during send', () => {
  const socket = { readyState: 1, send: () => { throw Error('socket closed between checks') } }
  assert.equal(sendSocketMessage(socket, { type: 'create', count: 3 }), false)
})
