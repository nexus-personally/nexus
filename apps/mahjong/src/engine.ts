/** 不依賴畫面或網路的單機規則核心；日後伺服器亦可呼叫同一套函式。 */
export type Suit = 'm' | 'p' | 's'
export type Tile = { id: number; code: string }
export type Meld = { kind: '吃' | '碰' | '明槓' | '暗槓' | '加槓'; tiles: Tile[]; from: number | null }
export type Player = { name: string; hand: Tile[]; melds: Meld[]; flowers: Tile[]; river: Tile[]; score: number; ai: boolean }
export type Claim = { kind: '胡' | '槓' | '碰' | '吃'; tiles: number[] }
export type FanItem = { name: string; fan: number }
export type Result = { winner: number | null; from: number | null; items: FanItem[]; raw: number; fan: number; payments: number[]; message: string; dealerTenpai?: boolean }
export type Phase = 'discard' | 'reaction' | 'result' | 'match-result'
export type Game = {
  version: 1; count: 3 | 4; players: Player[]; wall: Tile[]; wallOrder?: number[]; wallBreak?: number; active: number; dealer: number;
  prevailing: number; dealerCycle: number; repeat: number; handNumber: number; phase: Phase;
  lastDiscard: { tile: Tile; from: number } | null; reaction: Record<number, Claim[]>;
  latestRiverTileId?: number | null;
  pendingKong?: { seat: number; tile: Tile; meldIndex: number } | null;
  result: Result | null; selected: number | null; history: string[];
}

export const WIND = ['東', '南', '西', '北']
export const DRAGON: Record<string, string> = { z5: '中', z6: '發', z7: '白' }
export const MIN_FAN = 3
export const FAN_CAP = 13
const seatWindIndex = (game: Game, seat: number): number => {
  const relativeSeat = (seat - game.dealer + game.count) % game.count
  return game.count === 3 && relativeSeat === 2 ? 3 : relativeSeat
}
export function seatWind(game: Game, seat: number): string { return WIND[seatWindIndex(game, seat)] }

export function label(code: string): string {
  if (code[0] === 'm') return `${code[1]}萬`
  if (code[0] === 'p') return `${code[1]}筒`
  if (code[0] === 's') return `${code[1]}索`
  if (code[0] === 'z') return WIND[Number(code[1]) - 1] || DRAGON[code] || '?'
  if (code[0] === 'f') return `花${code[1]}`
  return `季${code[1]}`
}
export function isFlower(tile: Tile): boolean { return tile.code[0] === 'f' || tile.code[0] === 'j' }
export function sortTiles(tiles: Tile[]): Tile[] { return tiles.sort((a, b) => order(a.code) - order(b.code) || a.id - b.id) }
function order(code: string): number { return 'mpszfj'.indexOf(code[0]) * 10 + Number(code[1]) }

export function buildTiles(count: 3 | 4): Tile[] {
  const tiles: Tile[] = []
  const add = (code: string, copies: number) => { for (let i = 0; i < copies; i++) tiles.push({ id: tiles.length, code }) }
  for (const suit of ['m', 'p', 's']) for (let n = 1; n <= 9; n++) {
    if (count === 3 && suit === 'm' && n > 1 && n < 9) continue
    add(`${suit}${n}`, 4)
  }
  for (let n = 1; n <= 7; n++) add(`z${n}`, 4)
  for (const group of ['f', 'j']) for (let n = 1; n <= 4; n++) add(`${group}${n}`, 1)
  return tiles
}

function shuffle<T>(tiles: T[], seed?: number): T[] {
  let state = seed ?? 0
  const randomIndex = (upper: number): number => {
    if (seed === undefined) {
      const random = new Uint32Array(1); crypto.getRandomValues(random)
      return random[0] % upper
    }
    state = (state + 0x6D2B79F5) | 0
    let value = Math.imul(state ^ state >>> 15, 1 | state)
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value)
    return Math.floor(((value ^ value >>> 14) >>> 0) / 4294967296 * upper)
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles
}

function log(game: Game, message: string): void { game.history.unshift(message); game.history = game.history.slice(0, 18) }
function takeSupplement(game: Game): Tile {
  const first = game.wallOrder?.indexOf(game.wall[0].id) ?? -1
  const upperIsNext = first >= 0 && first % 2 === 0 && game.wall[1]?.id === game.wallOrder?.[first + 1]
  return game.wall.splice(upperIsNext ? 1 : 0, 1)[0]
}
function take(game: Game, seat: number, supplement = false): boolean {
  const player = game.players[seat]
  while (game.wall.length) {
    const tile = supplement ? takeSupplement(game) : game.wall.pop()!
    if (isFlower(tile)) { player.flowers.push(tile); log(game, `${player.name} 補花：${label(tile.code)}`); supplement = true; continue }
    player.hand.push(tile); sortTiles(player.hand)
    return true
  }
  endDraw(game)
  return false
}

function randomDealer(count: 3 | 4): number {
  const value = new Uint32Array(1)
  crypto.getRandomValues(value)
  return Math.floor(value[0] / 4294967296 * count)
}

export function newGame(count: 3 | 4, dealer = randomDealer(count), scores?: number[], prevailing = 0, dealerCycle = 0, repeat = 0, handNumber = 1, seed?: number): Game {
  const tiles = buildTiles(count)
  // Tile IDs are opaque to clients; sequential code-based IDs would reveal hidden hands.
  const ids = shuffle(tiles.map(tile => tile.id), seed === undefined ? undefined : seed ^ 0x51f15e3)
  tiles.forEach((tile, index) => { tile.id = ids[index] })
  const wall = shuffle(tiles, seed)
  const dice = seed === undefined ? (() => { const values = new Uint32Array(2); crypto.getRandomValues(values); return values })() : new Uint32Array([seed >>> 0, Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0])
  const diceTotal = dice[0] % 6 + dice[1] % 6 + 2
  const stacksPerSide = count === 4 ? [18, 18, 18, 18] : [18, 20, 20]
  const side = (dealer + diceTotal - 1) % count
  const wallBreak = stacksPerSide.slice(0, side).reduce((sum, n) => sum + n, 0) + diceTotal % stacksPerSide[side]
  const game: Game = {
    version: 1, count, wall, wallOrder: wall.map(tile => tile.id), wallBreak, active: dealer, dealer, prevailing, dealerCycle,
    repeat, handNumber, phase: 'discard', lastDiscard: null, latestRiverTileId: null, reaction: {}, pendingKong: null, result: null, selected: null, history: [],
    players: Array.from({ length: count }, (_, seat) => ({
      name: seat === 0 ? '你' : `牌友 ${seat}`, hand: [], melds: [], flowers: [], river: [], score: scores?.[seat] ?? 0, ai: seat !== 0,
    })),
  }
  // Deal three packets of four from the opened wall, starting with the dealer.
  for (let packet = 0; packet < 3; packet++) for (let offset = 0; offset < count; offset++) {
    const seat = (dealer + offset) % count
    for (let tile = 0; tile < 4; tile++) if (!take(game, seat)) return game
  }
  for (let offset = 0; offset < count; offset++) if (!take(game, (dealer + offset) % count)) return game
  take(game, dealer)
  log(game, `第 ${handNumber} 局開始，${game.players[dealer].name} 坐莊`)
  return game
}

function counts(tiles: Tile[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const tile of tiles) m.set(tile.code, (m.get(tile.code) || 0) + 1)
  return m
}
function validStandard(tiles: Tile[], meldCount: number): boolean {
  if (tiles.length !== (4 - meldCount) * 3 + 2) return false
  const map = counts(tiles)
  const codes = [...map.keys()].sort((a, b) => order(a) - order(b))
  const meldsNeeded = 4 - meldCount
  const canMeld = (remaining: number): boolean => {
    if (remaining === 0) return [...map.values()].every(n => n === 0)
    const code = codes.find(c => (map.get(c) || 0) > 0)
    if (!code) return false
    const n = map.get(code)!
    if (n >= 3) { map.set(code, n - 3); if (canMeld(remaining - 1)) return true; map.set(code, n) }
    if ('mps'.includes(code[0]) && Number(code[1]) <= 7) {
      const a = `${code[0]}${Number(code[1]) + 1}`, b = `${code[0]}${Number(code[1]) + 2}`
      if ((map.get(a) || 0) && (map.get(b) || 0)) {
        map.set(code, n - 1); map.set(a, map.get(a)! - 1); map.set(b, map.get(b)! - 1)
        if (canMeld(remaining - 1)) return true
        map.set(code, n); map.set(a, map.get(a)! + 1); map.set(b, map.get(b)! + 1)
      }
    }
    return false
  }
  for (const pair of codes) if ((map.get(pair) || 0) >= 2) {
    map.set(pair, map.get(pair)! - 2)
    if (canMeld(meldsNeeded)) return true
    map.set(pair, map.get(pair)! + 2)
  }
  return false
}
function thirteenOrphans(tiles: Tile[], count: number): boolean {
  if (tiles.length !== 14) return false
  const required = ['m1', 'm9', 'p1', 'p9', 's1', 's9', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7']
  const map = counts(tiles)
  return required.every(c => (map.get(c) || 0) >= 1) && [...map.entries()].every(([c, n]) => required.includes(c) && n <= 2) && [...map.values()].some(n => n === 2) && (count === 3 || count === 4)
}

function allTriplets(tiles: Tile[], melds: Meld[]): boolean {
  if (melds.some(m => m.kind === '吃')) return false
  const map = counts(tiles)
  if (tiles.length !== (4 - melds.length) * 3 + 2) return false
  for (const [pair, n] of map) if (n >= 2) {
    const rest = new Map(map); rest.set(pair, n - 2)
    if ([...rest.values()].every(v => v === 0 || v === 3)) return true
  }
  return false
}
function fanBreakdown(game: Game, seat: number, tiles: Tile[], selfDraw: boolean): FanItem[] | null {
  const player = game.players[seat]
  const special = player.melds.length === 0 && thirteenOrphans(tiles, game.count)
  if (!special && !validStandard(tiles, player.melds.length)) return null
  if (special) return [{ name: '十三么', fan: 13 }]
  const all = [...tiles, ...player.melds.flatMap(m => m.tiles)]
  const items: FanItem[] = []
  const add = (name: string, fan: number) => items.push({ name, fan })
  if (selfDraw) add('自摸', 1)
  if (selfDraw && player.melds.every(m => m.kind === '暗槓')) add('門前清自摸', 1)
  if (player.flowers.length === 0) add('無花', 1)
  for (const flower of player.flowers) {
    const rank = Number(flower.code[1]) - 1
    if (flower.code[0] === 'f' && rank === seatWindIndex(game, seat)) add(`正花 ${label(flower.code)}`, 1)
    if (flower.code[0] === 'j' && rank === game.prevailing) add(`正季 ${label(flower.code)}`, 1)
  }
  const suits = new Set(all.filter(t => 'mps'.includes(t.code[0])).map(t => t.code[0]))
  const honors = all.some(t => t.code[0] === 'z')
  if (suits.size === 1) add(honors ? '混一色' : '清一色', honors ? 3 : 7)
  const fourKongs = player.melds.filter(m => m.kind.includes('槓')).length === 4
  if (fourKongs) add('四槓', 13)
  else if (allTriplets(tiles, player.melds)) add('對對胡', 3)
  const map = counts(all)
  const dragons = ['z5', 'z6', 'z7'].map(c => map.get(c) || 0)
  if (dragons.every(n => n >= 3)) add('大三元', 13)
  else if (dragons.filter(n => n >= 3).length === 2 && dragons.includes(2)) add('小三元', 5)
  const winds = ['z1', 'z2', 'z3', 'z4'].map(c => map.get(c) || 0)
  if (winds.every(n => n >= 3)) add('大四喜', 13)
  else if (winds.filter(n => n >= 3).length === 3 && winds.includes(2)) add('小四喜', 13)
  if (all.every(t => t.code[0] === 'z')) add('字一色', 13)
  if (all.every(t => 'mps'.includes(t.code[0]) && (t.code[1] === '1' || t.code[1] === '9'))) add('清么九', 13)
  if (!items.some(item => item.name === '大三元' || item.name === '小三元')) {
    for (const [code, name] of [['z5', '紅中'], ['z6', '發財'], ['z7', '白板']] as const) if ((map.get(code) || 0) >= 3) add(name, 1)
  }
  if (!items.some(item => item.name === '大四喜' || item.name === '小四喜')) {
    if ((map.get(`z${seatWindIndex(game, seat) + 1}`) || 0) >= 3) add('門風', 1)
    if ((map.get(`z${game.prevailing + 1}`) || 0) >= 3) add('圈風', 1)
  }
  return items
}

export function evaluateWin(game: Game, seat: number, incoming?: Tile, selfDraw = false): { items: FanItem[]; raw: number; fan: number } | null {
  const tiles = incoming ? [...game.players[seat].hand, incoming] : [...game.players[seat].hand]
  const items = fanBreakdown(game, seat, tiles, selfDraw)
  if (!items) return null
  const raw = items.reduce((sum, item) => sum + item.fan, 0)
  return raw >= MIN_FAN ? { items, raw, fan: Math.min(raw, FAN_CAP) } : null
}

// A private, provisional readout for the player's current tiles. Winning-only
// bonuses are awarded by evaluateWin once the complete hand is checked.
export function currentFanPreview(game: Game, seat: number): { items: FanItem[]; raw: number; fan: number } {
  const player = game.players[seat]
  if (!player.melds.length && thirteenOrphans(player.hand, game.count)) return { items: [{ name: '十三么', fan: 13 }], raw: 13, fan: 13 }
  const all = [...player.hand, ...player.melds.flatMap(m => m.tiles)]
  const map = counts(all)
  const items: FanItem[] = []
  const add = (name: string, fan: number) => items.push({ name, fan })
  if (!player.flowers.length) add('無花', 1)
  for (const flower of player.flowers) {
    const rank = Number(flower.code[1]) - 1
    if (flower.code[0] === 'f' && rank === seatWindIndex(game, seat)) add('正花', 1)
    if (flower.code[0] === 'j' && rank === game.prevailing) add('正季', 1)
  }
  const suits = new Set(all.filter(t => 'mps'.includes(t.code[0])).map(t => t.code[0]))
  if (suits.size === 1) add(all.some(t => t.code[0] === 'z') ? '混一色' : '清一色', all.some(t => t.code[0] === 'z') ? 3 : 7)
  if (player.melds.filter(m => m.kind.includes('槓')).length === 4) add('四槓', 13)
  else if (allTriplets(player.hand, player.melds)) add('對對胡', 3)
  const dragons = ['z5', 'z6', 'z7'].map(code => map.get(code) || 0)
  if (dragons.every(n => n >= 3)) add('大三元', 13)
  else if (dragons.filter(n => n >= 3).length === 2 && dragons.includes(2)) add('小三元', 5)
  else for (const [code, name] of [['z5', '紅中'], ['z6', '發財'], ['z7', '白板']] as const) if ((map.get(code) || 0) >= 3) add(name, 1)
  const winds = ['z1', 'z2', 'z3', 'z4'].map(code => map.get(code) || 0)
  if (winds.every(n => n >= 3)) add('大四喜', 13)
  else if (winds.filter(n => n >= 3).length === 3 && winds.includes(2)) add('小四喜', 13)
  else {
    if ((map.get(`z${seatWindIndex(game, seat) + 1}`) || 0) >= 3) add('門風', 1)
    if ((map.get(`z${game.prevailing + 1}`) || 0) >= 3) add('圈風', 1)
  }
  if (all.length && all.every(t => t.code[0] === 'z')) add('字一色', 13)
  if (all.length && all.every(t => 'mps'.includes(t.code[0]) && (t.code[1] === '1' || t.code[1] === '9'))) add('清么九', 13)
  const raw = items.reduce((sum, item) => sum + item.fan, 0)
  return { items, raw, fan: Math.min(raw, FAN_CAP) }
}

export function selfKongs(game: Game, seat: number): Claim[] {
  const player = game.players[seat], map = counts(player.hand), claims: Claim[] = []
  for (const [code, n] of map) if (n === 4) claims.push({ kind: '槓', tiles: player.hand.filter(t => t.code === code).map(t => t.id) })
  for (const meld of player.melds) if (meld.kind === '碰') {
    const tile = player.hand.find(t => t.code === meld.tiles[0].code)
    if (tile) claims.push({ kind: '槓', tiles: [tile.id] })
  }
  return claims
}

function chowChoices(hand: Tile[], tile: Tile): Claim[] {
  if (!'mps'.includes(tile.code[0])) return []
  const rank = Number(tile.code[1]), suit = tile.code[0], claims: Claim[] = []
  for (let start = rank - 2; start <= rank; start++) {
    if (start < 1 || start > 7) continue
    const needed = [start, start + 1, start + 2].filter(n => n !== rank)
    const found = needed.map(n => hand.find(t => t.code === `${suit}${n}`))
    if (found.every(Boolean)) claims.push({ kind: '吃', tiles: found.map(t => t!.id) })
  }
  return claims
}
export function reactionOptions(game: Game, seat: number, tile: Tile, from: number): Claim[] {
  if (seat === from) return []
  const player = game.players[seat], same = player.hand.filter(t => t.code === tile.code)
  const options: Claim[] = []
  if (evaluateWin(game, seat, tile, false)) options.push({ kind: '胡', tiles: [] })
  if (same.length >= 3) options.push({ kind: '槓', tiles: same.slice(0, 3).map(t => t.id) })
  if (same.length >= 2) options.push({ kind: '碰', tiles: same.slice(0, 2).map(t => t.id) })
  if ((from + 1) % game.count === seat) options.push(...chowChoices(player.hand, tile))
  return options
}

function settleWin(game: Game, winner: number, from: number | null): void {
  const info = evaluateWin(game, winner, from === null ? undefined : game.lastDiscard!.tile, from === null)!
  const payments = Array(game.count).fill(0)
  if (from === null) {
    for (let i = 0; i < game.count; i++) if (i !== winner) { payments[i] -= info.fan; payments[winner] += info.fan }
  } else { payments[from] -= info.fan; payments[winner] += info.fan }
  for (let i = 0; i < game.count; i++) game.players[i].score += payments[i]
  game.result = { winner, from, ...info, payments, message: from === null ? `${game.players[winner].name} 自摸！` : `${game.players[winner].name} 胡 ${game.players[from].name} 的牌！` }
  game.phase = 'result'; log(game, `${game.result.message} ${info.fan} 番`)
}
function endDraw(game: Game): void {
  const dealer = game.dealer
  const hand = game.players[dealer].hand
  const owned = counts([...hand, ...game.players[dealer].melds.flatMap(meld => meld.tiles)])
  const dealerTenpai = [...new Set(buildTiles(game.count).map(tile => tile.code))]
    .some(code => (owned.get(code) || 0) < 4 && Boolean(evaluateWin(game, dealer, { id: -1, code }, false) || evaluateWin(game, dealer, { id: -1, code }, true)))
  game.phase = 'result'
  game.result = { winner: null, from: null, items: [], raw: 0, fan: 0, payments: Array(game.count).fill(0), dealerTenpai, message: dealerTenpai ? '流局：莊家聽牌，繼續坐莊' : '流局：莊家未聽牌，南家接莊' }
  log(game, game.result.message)
}

export function discard(game: Game, seat: number, tileId: number): void {
  if (game.phase !== 'discard' || game.active !== seat) throw Error('目前不能出牌')
  const player = game.players[seat], index = player.hand.findIndex(t => t.id === tileId)
  if (index < 0) throw Error('這張牌不在手中')
  const [tile] = player.hand.splice(index, 1)
  player.river.push(tile); game.lastDiscard = { tile, from: seat }; game.latestRiverTileId = tile.id; game.selected = null
  game.reaction = {}
  for (let i = 0; i < game.count; i++) if (i !== seat) game.reaction[i] = reactionOptions(game, i, tile, seat)
  game.phase = 'reaction'; log(game, `${player.name} 打出 ${label(tile.code)}`)
}

function removeIds(player: Player, ids: number[]): Tile[] {
  const removed: Tile[] = []
  for (const id of ids) {
    const index = player.hand.findIndex(t => t.id === id)
    if (index < 0) throw Error('副露所需牌不在手中')
    removed.push(...player.hand.splice(index, 1))
  }
  return removed
}

export function resolveReaction(game: Game, choices: Record<number, Claim | null>): void {
  if (game.phase !== 'reaction') throw Error('沒有待處理的應牌')
  if (game.pendingKong) {
    const { seat: kongSeat, tile, meldIndex } = game.pendingKong
    const winners = Object.entries(choices).flatMap(([key, claim]) => {
      const seat = Number(key)
      return claim?.kind === '胡' && game.reaction[seat]?.some(option => option.kind === '胡') ? [seat] : []
    }).sort((a, b) => ((a - kongSeat + game.count) % game.count) - ((b - kongSeat + game.count) % game.count))
    game.pendingKong = null; game.reaction = {}
    if (winners.length) {
      removeIds(game.players[kongSeat], [tile.id])
      game.lastDiscard = { tile, from: kongSeat }
      settleWin(game, winners[0], kongSeat)
      log(game, `${game.players[winners[0]].name} 搶槓胡`)
    } else {
      const player = game.players[kongSeat]
      const [fourth] = removeIds(player, [tile.id])
      player.melds[meldIndex].kind = '加槓'; player.melds[meldIndex].tiles.push(fourth)
      log(game, `${player.name} 加槓成功`)
      if (take(game, kongSeat, true)) game.phase = 'discard'
    }
    return
  }
  if (!game.lastDiscard) throw Error('沒有待處理的出牌')
  const { tile, from } = game.lastDiscard
  const ranking: Record<Claim['kind'], number> = { 胡: 3, 槓: 2, 碰: 2, 吃: 1 }
  const candidates = Object.entries(choices).flatMap(([s, claim]) => {
    const seat = Number(s)
    const legal = game.reaction[seat]?.some(c => c.kind === claim?.kind && JSON.stringify(c.tiles) === JSON.stringify(claim?.tiles))
    return claim && legal ? [{ seat, claim }] : []
  }).sort((a, b) => ranking[b.claim.kind] - ranking[a.claim.kind] || ((a.seat - from + game.count) % game.count) - ((b.seat - from + game.count) % game.count))
  game.reaction = {}
  if (!candidates.length) {
    game.active = (from + 1) % game.count; game.lastDiscard = null
    if (take(game, game.active)) game.phase = 'discard'
    return
  }
  const { seat, claim } = candidates[0]
  game.players[from].river.pop()
  game.latestRiverTileId = null
  if (claim.kind === '胡') { settleWin(game, seat, from); return }
  const player = game.players[seat]
  const consumed = removeIds(player, claim.tiles)
  const kind = claim.kind === '槓' ? '明槓' : claim.kind
  player.melds.push({ kind, tiles: sortTiles([...consumed, tile]), from })
  game.active = seat; game.lastDiscard = null
  log(game, `${player.name} ${claim.kind} ${label(tile.code)}`)
  if (claim.kind === '槓') { if (take(game, seat, true)) game.phase = 'discard' }
  else game.phase = 'discard'
}

export function declareSelfWin(game: Game, seat: number): void {
  if (game.phase !== 'discard' || game.active !== seat || !evaluateWin(game, seat, undefined, true)) throw Error('現在不能胡牌')
  settleWin(game, seat, null)
}
export function declareSelfKong(game: Game, seat: number, claim: Claim): void {
  if (game.phase !== 'discard' || game.active !== seat || !selfKongs(game, seat).some(c => JSON.stringify(c.tiles) === JSON.stringify(claim.tiles))) throw Error('現在不能槓')
  const player = game.players[seat]
  if (claim.tiles.length === 4) player.melds.push({ kind: '暗槓', tiles: removeIds(player, claim.tiles), from: null })
  else {
    const tile = player.hand.find(t => t.id === claim.tiles[0])!
    const meldIndex = player.melds.findIndex(m => m.kind === '碰' && m.tiles[0].code === tile.code)
    game.pendingKong = { seat, tile, meldIndex }
    game.reaction = {}
    for (let i = 0; i < game.count; i++) if (i !== seat) game.reaction[i] = evaluateWin(game, i, tile, false) ? [{ kind: '胡', tiles: [] }] : []
    game.phase = 'reaction'
    log(game, `${player.name} 宣告加槓，等待搶槓應牌`)
    return
  }
  log(game, `${player.name} 宣告暗槓`)
  take(game, seat, true)
}

export function nextHand(game: Game, seed?: number): Game {
  if (game.phase !== 'result') throw Error('本局尚未結束')
  let dealer = game.dealer, cycle = game.dealerCycle, prevailing = game.prevailing, repeat = game.repeat
  if (game.result?.winner === dealer || (game.result?.winner === null && game.result.dealerTenpai)) repeat++
  else {
    dealer = (dealer + 1) % game.count; cycle++; repeat = 0
    if (cycle >= game.count) { cycle = 0; prevailing++ }
  }
  if (prevailing >= 2) { game.phase = 'match-result'; log(game, '東南圈完成，牌局結束'); return game }
  return newGame(game.count, dealer, game.players.map(p => p.score), prevailing, cycle, repeat, game.handNumber + 1, seed)
}

export function aiChooseDiscard(game: Game, seat: number): number {
  const player = game.players[seat]
  const visible = game.players.flatMap(p => [...p.river, ...p.melds.flatMap(m => m.tiles)])
  const score = (tile: Tile): number => {
    const same = player.hand.filter(t => t.code === tile.code).length
    const rank = Number(tile.code[1]), suit = tile.code[0]
    const neighbors = 'mps'.includes(suit) ? player.hand.filter(t => t.code[0] === suit && Math.abs(Number(t.code[1]) - rank) <= 2 && t.id !== tile.id).length : 0
    const seen = visible.filter(t => t.code === tile.code).length
    return (same - 1) * 2 + neighbors - seen * .4 + (suit === 'z' && rank >= 5 ? .3 : 0)
  }
  return [...player.hand].sort((a, b) => score(a) - score(b) || a.id - b.id)[0].id
}

export function aiClaim(game: Game, seat: number): Claim | null {
  const options = game.reaction[seat] || []
  const immediate = options.find(c => c.kind === '胡') || options.find(c => c.kind === '槓') || options.find(c => c.kind === '碰')
  if (immediate) return immediate
  if (game.wall.length <= 8) return null
  const player = game.players[seat]
  return options.find(c => c.kind === '吃' && c.tiles.every(id => {
    const tile = player.hand.find(t => t.id === id)!
    return player.hand.filter(t => t.code === tile.code).length === 1
  })) || null
}
