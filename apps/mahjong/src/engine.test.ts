import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aiChooseDiscard, currentFanPreview, discard, evaluateWin, newGame, reactionOptions,
  type Game, type Tile,
} from './engine.ts'

const tiles = (codes: string[], start = 1000): Tile[] => codes.map((code, index) => ({ id: start + index, code }))

test('the latest draw is identifiable until the player discards', () => {
  const game = newGame(4, 0, undefined, 0, 0, 0, 1, 42)
  assert.equal(game.lastDraw?.seat, 0)
  assert.ok(game.players[0].hand.some(tile => tile.id === game.lastDraw?.tileId))
  discard(game, 0, aiChooseDiscard(game, 0))
  assert.equal(game.lastDraw, undefined)
})

test('temporary supplement-win fan is separate from stable preview fan', () => {
  const game = newGame(3, 0, undefined, 0, 0, 0, 1, 21)
  game.players[0].flowers = [{ id: 9000, code: 'a1' }]
  game.phase = 'discard'
  game.active = 0
  game.lastDraw = { seat: 0, tileId: game.players[0].hand.at(-1)?.id, reason: 'flower' }
  const preview = currentFanPreview(game, 0)
  assert.ok(preview.items.some(item => item.name === '貓' && item.fan === 1))
  assert.deepEqual(preview.transientItems, [{ name: '花牌補牌自摸', fan: 1 }])
  assert.equal(preview.transientFan, 1)
  game.phase = 'reaction'
  assert.equal(currentFanPreview(game, 0).transientFan, 0)
})

test('two fly tiles may represent a pair when claiming pong', () => {
  const game = newGame(3, 0, undefined, 0, 0, 0, 1, 12)
  game.players[1].hand = tiles(['x1', 'x1', 'p2', 'p3'])
  const options = reactionOptions(game, 1, { id: 9999, code: 'z5' }, 0)
  assert.ok(options.some(option => option.kind === '碰' && option.tiles.length === 2 && option.represented?.every(code => code === 'z5')))
})

test('four concealed triplets is awarded only on self draw', () => {
  const game = newGame(3, 0, undefined, 0, 0, 0, 1, 7) as Game
  game.players[0].hand = tiles([
    'p1','p1','p1', 'p2','p2','p2', 'p3','p3','p3',
    'z5','z5','z5', 'z1','z1',
  ])
  game.players[0].melds = []
  game.players[0].flowers = [{ id: 9990, code: 'a1' }]
  const discardWin = evaluateWin(game, 0, undefined, false)
  const selfDraw = evaluateWin(game, 0, undefined, true)
  assert.ok(discardWin && !discardWin.items.some(item => item.name === '四暗刻'))
  assert.ok(selfDraw?.items.some(item => item.name === '四暗刻' && item.fan === 10))
})

test('recommended discard never chooses a fly tile', () => {
  const game = newGame(3, 0, undefined, 0, 0, 0, 1, 99)
  game.players[0].hand = tiles(['x1', 'p1', 'p2'])
  const selected = aiChooseDiscard(game, 0)
  assert.notEqual(game.players[0].hand.find(tile => tile.id === selected)?.code, 'x1')
})
