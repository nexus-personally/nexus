import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aiChooseDiscard, buildTiles, currentFanPreview, discard, evaluateWin, newGame, reactionOptions,
  selfKongs, settlementFan, winPayments, type Game, type Meld, type Tile,
} from './engine.ts'
import { getWallState } from './wallState.ts'

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

test('four player set contains 152 tiles including four animals and four flies', () => {
  const set = buildTiles(4)
  assert.equal(set.length, 152)
  assert.equal(set.filter(tile => tile.code[0] === 'a').length, 4)
  assert.equal(set.filter(tile => tile.code === 'x1').length, 4)
  assert.equal(new Set(set.map(tile => tile.id)).size, 152)
})

test('four player wall has nineteen stacks on every side', () => {
  const wall = getWallState(newGame(4, 0, undefined, 0, 0, 0, 1, 75))
  for (const side of ['north', 'east', 'south', 'west'] as const) {
    const sideTiles = wall.filter(tile => tile.side === side)
    assert.equal(sideTiles.length, 38)
    assert.equal(new Set(sideTiles.map(tile => tile.stack)).size, 19)
  }
})

test('ten fan explodes once with no cap in both variants', () => {
  assert.equal(settlementFan(4, 9), 9)
  assert.equal(settlementFan(4, 10), 20)
  assert.equal(settlementFan(4, 18), 36)
  assert.equal(settlementFan(3, 39), 78)
})

test('four player discard win charges shooter double and others single', () => {
  assert.deepEqual(winPayments(4, 2, 1, 7), [-7, -14, 28, -7])
})

test('four player self draw charges every opponent double', () => {
  assert.deepEqual(winPayments(4, 2, null, 7), [-14, -14, 42, -14])
})

test('four player no-flower is ten fan and fly does not break it', () => {
  const game = newGame(4, 0, undefined, 0, 0, 0, 1, 71)
  game.players[0].hand = tiles(['m1','m2','m3', 'm4','m5','m6', 'p1','p2','p3', 's7','s8','x1', 'p5','p5'])
  game.players[0].melds = []
  game.players[0].flowers = []
  const result = evaluateWin(game, 0, undefined, false)
  assert.ok(result?.items.some(item => item.name === '無花' && item.fan === 10))
  assert.ok(result && result.fan === result.raw * 2)
})

test('four player bonus tiles score by seat and complete sets', () => {
  const game = newGame(4, 0, undefined, 0, 0, 0, 1, 72)
  game.players[0].hand = tiles(['m1','m2','m3', 'm4','m5','m6', 'p1','p2','p3', 's1','s2','s3', 'p5','p5'])
  game.players[0].flowers = tiles(['f1','f2','f3','f4','j1','j2','j3','j4','a1','a2','a3','a4'], 3000)
  const result = evaluateWin(game, 0, undefined, false)
  assert.ok(result?.items.some(item => item.name === '正花 花1' && item.fan === 1))
  assert.ok(result?.items.some(item => item.name === '正季 季1' && item.fan === 1))
  assert.equal(result?.items.filter(item => item.name.startsWith('正花')).length, 1)
  assert.equal(result?.items.filter(item => item.name.startsWith('正季')).length, 1)
  assert.ok(result?.items.some(item => item.name === '一臺花' && item.fan === 2))
  assert.ok(result?.items.some(item => item.name === '一臺季' && item.fan === 2))
  assert.ok(result?.items.some(item => item.name === '一臺動物' && item.fan === 2))
  assert.equal(result?.items.filter(item => ['貓','鼠','雞','蜈蚣'].includes(item.name)).length, 4)
})

test('exposed and concealed kongs score separately and concealed kong keeps closed hand', () => {
  const game = newGame(4, 0, undefined, 0, 0, 0, 1, 73)
  game.players[0].hand = tiles(['m1','m2','m3', 'p1','p2','p3', 's5','s5'])
  game.players[0].flowers = tiles(['a1'], 6000)
  game.players[0].melds = [
    { kind: '暗槓', tiles: tiles(['z5','z5','z5','z5'], 4000), from: null },
    { kind: '明槓', tiles: tiles(['z1','z1','z1','z1'], 5000), from: 1 },
  ] as Meld[]
  const result = evaluateWin(game, 0, undefined, false)
  assert.ok(result?.items.some(item => item.name === '暗槓 中' && item.fan === 2))
  assert.ok(result?.items.some(item => item.name === '明槓 東' && item.fan === 1))
  assert.ok(result?.items.some(item => item.name === '紅中' && item.fan === 1))
  assert.ok(result?.items.some(item => item.name === '門風' && item.fan === 1))
  assert.ok(!result?.items.some(item => item.name === '門前清'))
})

test('fly tiles cannot form or upgrade a kong', () => {
  const game = newGame(4, 0, undefined, 0, 0, 0, 1, 74)
  game.players[0].hand = tiles(['x1','x1','x1','x1','z5'])
  game.players[0].melds = [{ kind: '碰', tiles: tiles(['z5','x1','z5'], 7000), represented: ['z5','z5','z5'], from: 1 }]
  assert.deepEqual(selfKongs(game, 0), [])
})
