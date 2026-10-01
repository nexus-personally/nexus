/** 不依賴畫面或網路的單機規則核心；日後伺服器亦可呼叫同一套函式。 */
export type Suit = 'm' | 'p' | 's'
export type Tile = { id: number; code: string }
export type Meld = { kind: '吃' | '碰' | '明槓' | '暗槓' | '加槓'; tiles: Tile[]; from: number | null; represented?: string[] }
export type Player = { name: string; hand: Tile[]; melds: Meld[]; flowers: Tile[]; river: Tile[]; score: number; ai: boolean }
export type Claim = { kind: '胡' | '槓' | '碰' | '吃'; tiles: number[]; represented?: string[] }
export type FanItem = { name: string; fan: number }
export type Result = { winner: number | null; from: number | null; items: FanItem[]; raw: number; fan: number; payments: number[]; mamoneyDeltas?: number[]; message: string; dealerTenpai?: boolean }
export type Phase = 'discard' | 'reaction' | 'result' | 'match-result'
export type Game = {
  version: 2; handId: string; count: 3 | 4; players: Player[]; wall: Tile[]; wallOrder?: number[]; wallBreak?: number; active: number; dealer: number;
  prevailing: number; dealerCycle: number; repeat: number; handNumber: number; phase: Phase;
  lastDiscard: { tile: Tile; from: number } | null; reaction: Record<number, Claim[]>;
  latestRiverTileId?: number | null;
  lastDraw?: { seat: number; tileId?: number; reason: 'wall' | 'flower' | 'kong' };
  consecutiveKongs?: number;
  winContext?: 'rob-kong' | null;
  pendingKong?: { seat: number; tile: Tile; meldIndex: number } | null;
  result: Result | null; selected: number | null; history: string[];
}

export const WIND = ['東', '南', '西', '北']
export const DRAGON: Record<string, string> = { z5: '中', z6: '發', z7: '白' }
export const MIN_FAN = 3
export const minFan = (count: 3 | 4) => count === 3 ? 5 : MIN_FAN
export const fanCap = (_count: 3 | 4) => Number.POSITIVE_INFINITY
export const settlementFan = (_count: 3 | 4, raw: number) => raw >= 10 ? raw * 2 : raw
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
  if (code[0] === 'j') return `季${code[1]}`
  if (code[0] === 'a') return ['貓', '鼠', '雞', '蜈蚣'][Number(code[1]) - 1] || '動物'
  if (code[0] === 'h') return `人頭${code[1]}`
  if (code === 'x1') return '飛'
  return '?'
}
export function isFlower(tile: Tile): boolean { return 'fjah'.includes(tile.code[0]) }
export function sortTiles(tiles: Tile[]): Tile[] { return tiles.sort((a, b) => order(a.code) - order(b.code) || a.id - b.id) }
function order(code: string): number { return 'mpszxfjah'.indexOf(code[0]) * 10 + Number(code[1]) }

export function buildTiles(count: 3 | 4): Tile[] {
  const tiles: Tile[] = []
  const add = (code: string, copies: number) => { for (let i = 0; i < copies; i++) tiles.push({ id: tiles.length, code }) }
  for (const suit of count === 3 ? ['p'] : ['m', 'p', 's']) for (let n = 1; n <= 9; n++) {
    add(`${suit}${n}`, 4)
  }
  for (let n = 1; n <= 7; n++) add(`z${n}`, 4)
  for (const group of ['f', 'j']) for (let n = 1; n <= 4; n++) add(`${group}${n}`, 1)
  for (let n = 1; n <= 4; n++) add(`a${n}`, 1)
  if (count === 3) for (let n = 1; n <= 4; n++) add(`h${n}`, 1)
  add('x1', 4)
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
export function canRedeemPongFly(game: Game, seat: number): boolean {
  if (game.phase !== 'discard' || game.active !== seat) return false
  const player = game.players[seat]
  return player.hand.some(handTile => handTile.code !== 'x1' && player.melds.some(meld =>
    meld.kind === '碰' && meld.tiles.some((tile, index) => tile.code === 'x1' && meld.represented?.[index] === handTile.code),
  ))
}

export function redeemPongFly(game: Game, seat: number): void {
  if (!canRedeemPongFly(game, seat)) throw Error('現在不能起飛')
  const player = game.players[seat]
  const eligible = player.hand.filter(handTile => handTile.code !== 'x1' && player.melds.some(meld =>
    meld.kind === '碰' && meld.tiles.some((tile, index) => tile.code === 'x1' && meld.represented?.[index] === handTile.code),
  ))
  const replacement = eligible.find(tile => tile.id === game.lastDraw?.tileId) ?? eligible[0]
  const handIndex = player.hand.findIndex(tile => tile.id === replacement.id)
  const meld = player.melds.find(candidate => candidate.kind === '碰' && candidate.tiles.some((tile, index) => tile.code === 'x1' && candidate.represented?.[index] === replacement.code))!
  const flyIndex = meld.tiles.findIndex((tile, index) => tile.code === 'x1' && meld.represented?.[index] === replacement.code)
  const fly = meld.tiles[flyIndex]
  meld.tiles[flyIndex] = replacement
  player.hand[handIndex] = fly
  sortTiles(player.hand)
  if (game.lastDraw?.tileId === replacement.id) game.lastDraw = { ...game.lastDraw, tileId: fly.id }
  log(game, `${player.name} 起飛：以 ${label(replacement.code)} 換回飛`)
}
function take(game: Game, seat: number, supplement = false, reason: 'wall' | 'flower' | 'kong' = 'wall'): boolean {
  const player = game.players[seat]
  while (game.wall.length) {
    const tile = supplement ? takeSupplement(game) : game.wall.pop()!
    if (isFlower(tile)) { player.flowers.push(tile); log(game, `${player.name} 補花：${label(tile.code)}`); supplement = true; reason = 'flower'; continue }
    player.hand.push(tile); sortTiles(player.hand)
    game.lastDraw = { seat, tileId: tile.id, reason }
    game.winContext = null
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
  const stacksPerSide = count === 4 ? [19, 19, 19, 19] : [14, 14, 14]
  const side = (dealer + diceTotal - 1) % count
  const wallBreak = stacksPerSide.slice(0, side).reduce((sum, n) => sum + n, 0) + diceTotal % stacksPerSide[side]
  const game: Game = {
    version: 2, handId: crypto.randomUUID(), count, wall, wallOrder: wall.map(tile => tile.id), wallBreak, active: dealer, dealer, prevailing, dealerCycle,
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
type ResolvedHand = { tiles: Tile[]; allTriplets: boolean; allChows: boolean; pair: string }
function resolvedStandards(tiles: Tile[], meldCount: number, count: 3 | 4): ResolvedHand[] {
  if (tiles.length !== (4 - meldCount) * 3 + 2) return []
  const real = counts(tiles.filter(tile => tile.code !== 'x1'))
  const wild = tiles.filter(tile => tile.code === 'x1').length
  const available = [...new Set(buildTiles(count).filter(tile => 'mpsz'.includes(tile.code[0])).map(tile => tile.code))]
  const results: ResolvedHand[] = []
  const seen = new Set<string>()
  const use = (map: Map<string, number>, shape: string[], wilds: number): { map: Map<string, number>; wilds: number } | null => {
    const next = new Map(map)
    let missing = 0
    for (const code of shape) {
      const n = next.get(code) || 0
      if (n) next.set(code, n - 1)
      else missing++
    }
    return missing <= wilds ? { map: next, wilds: wilds - missing } : null
  }
  const meld = (map: Map<string, number>, wilds: number, remaining: number, shapes: string[][], triplets: boolean, chows: boolean, pair: string) => {
    if (results.length >= 1024) return
    if (remaining === 0) {
      if (wilds || [...map.values()].some(Boolean)) return
      const codes = shapes.flat()
      const key = `${codes.slice().sort().join(',')}:${triplets}:${chows}:${pair}`
      if (!seen.has(key)) { seen.add(key); results.push({ tiles: codes.map((code, id) => ({ id: -id - 1, code })), allTriplets: triplets, allChows: chows, pair }) }
      return
    }
    const first = [...map].find(([, n]) => n > 0)?.[0]
    if (!first) {
      // Three flying tiles cannot form a pong by themselves under this basic rule set.
      return
    }
    const triplet = [first, first, first]
    const taken = use(map, triplet, wilds)
    if (taken) meld(taken.map, taken.wilds, remaining - 1, [...shapes, triplet], triplets, false, pair)
    if ('mps'.includes(first[0])) for (let start = Number(first[1]) - 2; start <= Number(first[1]); start++) {
      if (start < 1 || start > 7) continue
      const shape = [start, start + 1, start + 2].map(n => `${first[0]}${n}`)
      const next = use(map, shape, wilds)
      if (next) meld(next.map, next.wilds, remaining - 1, [...shapes, shape], false, chows, pair)
    }
  }
  for (const pair of available) {
    const next = use(real, [pair, pair], wild)
    if (next) meld(next.map, next.wilds, 4 - meldCount, [[pair, pair]], true, true, pair)
  }
  return results
}
function isSevenPairs(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false
  const map = counts(tiles.filter(tile => tile.code !== 'x1'))
  let wild = tiles.filter(tile => tile.code === 'x1').length
  for (const [code, amount] of map) if (amount % 2) { if (!wild) return false; map.set(code, amount - 1); wild-- }
  return wild % 2 === 0
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
  const solutions = resolvedStandards(tiles, player.melds.length, game.count)
  if (game.count === 3 && player.melds.length === 0 && isSevenPairs(tiles)) {
    const existing = tiles.find(tile => tile.code !== 'x1')?.code || 'p1'
    const wildcardTarget = existing[0] === 'z' ? 'z1' : 'p1'
    solutions.push({ tiles: tiles.map(tile => tile.code === 'x1' ? { ...tile, code: wildcardTarget } : tile), allTriplets: false, allChows: false, pair: wildcardTarget })
  }
  if (!solutions.length) return null
  let best: FanItem[] = []
  for (const solution of solutions) {
    const items = scoreResolved(game, seat, solution, selfDraw)
    if (items.reduce((sum, item) => sum + item.fan, 0) > best.reduce((sum, item) => sum + item.fan, 0)) best = items
  }
  return best
}

function scoreResolved(game: Game, seat: number, solution: ResolvedHand, selfDraw: boolean): FanItem[] {
  const player = game.players[seat]
  const tiles = solution.tiles
  const meldTiles = player.melds.flatMap(meld => meld.tiles.map((tile, index) => ({ ...tile, code: meld.represented?.[index] || tile.code })))
  const all = [...tiles, ...meldTiles]
  const items: FanItem[] = []
  const add = (name: string, fan: number) => items.push({ name, fan })
  if (game.count === 3) {
    if (selfDraw && game.lastDraw?.seat === seat && game.lastDraw.reason === 'flower') add('花牌補牌自摸', 1)
    if (selfDraw && game.lastDraw?.seat === seat && game.lastDraw.reason === 'kong') add('槓後補牌自摸', 1)
    if (!selfDraw && game.winContext === 'rob-kong') add('搶槓胡', 1)
    if (!player.flowers.length) add('無花', 10)
    for (const flower of player.flowers) {
      const rank = Number(flower.code[1]) - 1
      if ('ah'.includes(flower.code[0])) add(`${label(flower.code)}`, 1)
      else if (rank === seatWindIndex(game, seat) || rank === 3) add(`${label(flower.code)}`, 1)
    }
    for (const group of ['f', 'j', 'a', 'h']) if (player.flowers.filter(tile => tile.code[0] === group).length === 4) add(`一臺${group === 'f' ? '花' : group === 'j' ? '季' : group === 'a' ? '動物' : '人頭'}`, 1)
    const honors = all.some(tile => tile.code[0] === 'z')
    if (!honors) add('清一色', 3)
    else if (all.some(tile => tile.code[0] === 'p')) add('混一色', 1)
    if (solution.allTriplets && player.melds.every(meld => meld.kind !== '吃')) add('對對胡', 2)
    if (solution.allChows && solution.pair[0] === 'p' && player.melds.every(meld => meld.kind === '吃')) add('平胡（筒眼）', 1)
    const map = counts(all)
    const dragons = ['z5', 'z6', 'z7'].map(code => map.get(code) || 0)
    if (dragons.every(n => n >= 3)) add('大三元', 10)
    else if (dragons.filter(n => n >= 3).length === 2 && dragons.includes(2)) add('小三元', 3)
    else for (const code of ['z5', 'z6', 'z7']) if ((map.get(code) || 0) >= 3) add(`${label(code)}刻`, 1)
    const winds = ['z1', 'z2', 'z3', 'z4'].map(code => map.get(code) || 0)
    if (winds.every(n => n >= 3) || (winds.filter(n => n >= 3).length === 3 && winds.includes(2))) add('風牌大牌', 10)
    else {
      if ((map.get('z1') || 0) >= 3) add('東風刻', 1)
      if ((map.get('z4') || 0) >= 3) add('北風刻', 1)
      const own = `z${seatWindIndex(game, seat) + 1}`
      if (own !== 'z1' && own !== 'z4' && (map.get(own) || 0) >= 3) add('門風刻', 1)
      if ((map.get('z1') || 0) >= 3 && own === 'z1') add('東位加番', 1)
    }
    if (all.every(tile => tile.code[0] === 'z')) add('字一色', 10)
    if (player.melds.filter(meld => meld.kind.includes('槓')).length === 4) add('四槓', 10)
    if (isSevenPairs(tiles)) add('七對', 1)
    const dotCounts = counts(all)
    const nineGates = all.length === 14 && all.every(tile => tile.code[0] === 'p') &&
      [...Array(9)].every((_, index) => (dotCounts.get(`p${index + 1}`) || 0) >= (index === 0 || index === 8 ? 3 : 1)) &&
      [...dotCounts.values()].reduce((sum, amount) => sum + amount, 0) === 14 && selfDraw
    if (nineGates) add('九蓮寶燈', 10)
    if (player.flowers.length === 16) add('十六花', 10)
    if (selfDraw && solution.allTriplets && player.melds.every(meld => meld.kind === '暗槓')) add('四暗刻', 10)
    if (game.consecutiveKongs !== undefined && game.consecutiveKongs >= 2 && selfDraw && game.lastDraw?.seat === seat && game.lastDraw.reason === 'kong') add('連續兩槓補牌胡', 10)
    const windPungs = ['z1', 'z2', 'z3', 'z4'].filter(code => (dotCounts.get(code) || 0) >= 3).length
    if (windPungs >= 3 && ['z1', 'z2', 'z3', 'z4'].some(code => (dotCounts.get(code) || 0) >= 2)) add('三風刻', 10)
    if (game.wall.length === 0) add('海底／河底', 10)
    return items
  }
  if (selfDraw) add('自摸', 1)
  if (player.melds.every(m => m.kind === '暗槓')) add('門前清', 1)
  if (selfDraw && game.lastDraw?.seat === seat && game.lastDraw.reason === 'kong') add('槓上開花', 1)
  if (!selfDraw && game.winContext === 'rob-kong') add('搶槓胡', 1)
  if (game.wall.length === 0) add('海底／河底', 1)
  if (player.flowers.length === 0) add('無花', 10)
  for (const flower of player.flowers) {
    const rank = Number(flower.code[1]) - 1
    if (flower.code[0] === 'f' && rank === seatWindIndex(game, seat)) add(`正花 ${label(flower.code)}`, 1)
    if (flower.code[0] === 'j' && rank === seatWindIndex(game, seat)) add(`正季 ${label(flower.code)}`, 1)
    if (flower.code[0] === 'a') add(label(flower.code), 1)
  }
  for (const [group, name] of [['f', '一臺花'], ['j', '一臺季'], ['a', '一臺動物']] as const) {
    if (player.flowers.filter(tile => tile.code[0] === group).length === 4) add(name, 2)
  }
  const suits = new Set(all.filter(t => 'mps'.includes(t.code[0])).map(t => t.code[0]))
  const honors = all.some(t => t.code[0] === 'z')
  if (suits.size === 2) add('缺一門', 2)
  if (suits.size === 1) add(honors ? '混一色' : '清一色', honors ? 3 : 7)
  if (solution.allTriplets && player.melds.every(meld => meld.kind !== '吃')) add('對對胡', 3)
  if (solution.allChows && player.melds.every(meld => meld.kind === '吃')) add('平胡', 1)
  for (const meld of player.melds) {
    if (meld.kind === '暗槓') add(`暗槓 ${label(meld.represented?.[0] || meld.tiles[0].code)}`, 2)
    if (meld.kind === '明槓' || meld.kind === '加槓') add(`明槓 ${label(meld.represented?.[0] || meld.tiles[0].code)}`, 1)
  }
  const map = counts(all)
  const dragons = ['z5', 'z6', 'z7'].map(c => map.get(c) || 0)
  if (dragons.every(n => n >= 3)) add('大三元', 8)
  else if (dragons.filter(n => n >= 3).length === 2 && dragons.includes(2)) add('小三元', 5)
  const winds = ['z1', 'z2', 'z3', 'z4'].map(c => map.get(c) || 0)
  if (winds.every(n => n >= 3)) add('大四喜', 10)
  else if (winds.filter(n => n >= 3).length === 3 && winds.includes(2)) add('小四喜', 8)
  if (all.every(t => t.code[0] === 'z')) add('字一色', 10)
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
  return raw >= minFan(game.count) ? { items, raw, fan: settlementFan(game.count, raw) } : null
}

// A private, provisional readout for the player's current tiles. Winning-only
// bonuses are awarded by evaluateWin once the complete hand is checked.
export function currentFanPreview(game: Game, seat: number): { items: FanItem[]; raw: number; fan: number; transientItems: FanItem[]; transientFan: number } {
  const player = game.players[seat]
  const transientItems: FanItem[] = []
  if (game.phase === 'discard' && game.active === seat && game.lastDraw?.seat === seat) {
    if (game.lastDraw.reason === 'flower') transientItems.push({ name: '花牌補牌自摸', fan: 1 })
    if (game.lastDraw.reason === 'kong') transientItems.push({ name: '槓後補牌自摸', fan: 1 })
  }
  const transientFan = transientItems.reduce((sum, item) => sum + item.fan, 0)
  if (game.count === 3) {
    const items: FanItem[] = []
    for (const flower of player.flowers) {
      const rank = Number(flower.code[1]) - 1
      if ('ah'.includes(flower.code[0]) || rank === seatWindIndex(game, seat) || rank === 3) items.push({ name: label(flower.code), fan: 1 })
    }
    const all = [...player.hand, ...player.melds.flatMap(meld => meld.tiles.map((tile, index) => ({ ...tile, code: meld.represented?.[index] || tile.code })))]
    if (all.length && all.every(tile => tile.code[0] === 'p' || tile.code === 'x1')) items.push({ name: '清一色參考', fan: 3 })
    for (const code of ['z1', 'z4', 'z5', 'z6', 'z7']) if (all.filter(tile => tile.code === code).length >= 3) items.push({ name: `${label(code)}刻`, fan: 1 })
    const raw = items.reduce((sum, item) => sum + item.fan, 0)
    return { items, raw, fan: settlementFan(3, raw), transientItems, transientFan }
  }
  const all = [...player.hand, ...player.melds.flatMap(meld => meld.tiles.map((tile, index) => ({ ...tile, code: meld.represented?.[index] || tile.code })))]
  const map = counts(all)
  const items: FanItem[] = []
  const add = (name: string, fan: number) => items.push({ name, fan })
  if (player.melds.every(meld => meld.kind === '暗槓')) add('門前清', 1)
  if (!player.flowers.length) add('無花', 10)
  for (const flower of player.flowers) {
    const rank = Number(flower.code[1]) - 1
    if (flower.code[0] === 'f' && rank === seatWindIndex(game, seat)) add('正花', 1)
    if (flower.code[0] === 'j' && rank === seatWindIndex(game, seat)) add('正季', 1)
    if (flower.code[0] === 'a') add(label(flower.code), 1)
  }
  for (const [group, name] of [['f', '一臺花'], ['j', '一臺季'], ['a', '一臺動物']] as const) if (player.flowers.filter(tile => tile.code[0] === group).length === 4) add(name, 2)
  const suits = new Set(all.filter(t => 'mps'.includes(t.code[0])).map(t => t.code[0]))
  if (suits.size === 2) add('缺一門', 2)
  if (suits.size === 1) add(all.some(t => t.code[0] === 'z') ? '混一色' : '清一色', all.some(t => t.code[0] === 'z') ? 3 : 7)
  if (allTriplets(player.hand, player.melds)) add('對對胡', 3)
  for (const meld of player.melds) {
    if (meld.kind === '暗槓') add(`暗槓 ${label(meld.represented?.[0] || meld.tiles[0].code)}`, 2)
    if (meld.kind === '明槓' || meld.kind === '加槓') add(`明槓 ${label(meld.represented?.[0] || meld.tiles[0].code)}`, 1)
  }
  const dragons = ['z5', 'z6', 'z7'].map(code => map.get(code) || 0)
  if (dragons.every(n => n >= 3)) add('大三元', 8)
  else if (dragons.filter(n => n >= 3).length === 2 && dragons.includes(2)) add('小三元', 5)
  else for (const [code, name] of [['z5', '紅中'], ['z6', '發財'], ['z7', '白板']] as const) if ((map.get(code) || 0) >= 3) add(name, 1)
  const winds = ['z1', 'z2', 'z3', 'z4'].map(code => map.get(code) || 0)
  if (winds.every(n => n >= 3)) add('大四喜', 10)
  else if (winds.filter(n => n >= 3).length === 3 && winds.includes(2)) add('小四喜', 8)
  else {
    if ((map.get(`z${seatWindIndex(game, seat) + 1}`) || 0) >= 3) add('門風', 1)
    if ((map.get(`z${game.prevailing + 1}`) || 0) >= 3) add('圈風', 1)
  }
  if (all.length && all.every(t => t.code[0] === 'z')) add('字一色', 10)
  const raw = items.reduce((sum, item) => sum + item.fan, 0)
  return { items, raw, fan: settlementFan(4, raw), transientItems, transientFan }
}

export function selfKongs(game: Game, seat: number): Claim[] {
  const player = game.players[seat], map = counts(player.hand), claims: Claim[] = []
  for (const [code, n] of map) if (code !== 'x1' && n === 4) claims.push({ kind: '槓', tiles: player.hand.filter(t => t.code === code).map(t => t.id) })
  for (const meld of player.melds) if (meld.kind === '碰' && meld.tiles.every(tile => tile.code !== 'x1')) {
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
    const needed = [start, start + 1, start + 2].filter(n => n !== rank).map(n => `${suit}${n}`)
    const real = needed.map(code => hand.find(t => t.code === code))
    if (real.every(Boolean)) claims.push({ kind: '吃', tiles: real.map(t => t!.id), represented: needed })
    for (let wildAt = 0; wildAt < 2; wildAt++) {
      const other = real[1 - wildAt], fly = hand.find(t => t.code === 'x1')
      if (other && fly) claims.push({ kind: '吃', tiles: wildAt === 0 ? [fly.id, other.id] : [other.id, fly.id], represented: needed })
    }
  }
  return claims
}
export function reactionOptions(game: Game, seat: number, tile: Tile, from: number): Claim[] {
  if (seat === from || tile.code === 'x1') return []
  const player = game.players[seat], same = player.hand.filter(t => t.code === tile.code)
  const flies = player.hand.filter(t => t.code === 'x1')
  const options: Claim[] = []
  if (evaluateWin(game, seat, tile, false)) options.push({ kind: '胡', tiles: [] })
  if (same.length >= 3) options.push({ kind: '槓', tiles: same.slice(0, 3).map(t => t.id) })
  if (same.length >= 2) options.push({ kind: '碰', tiles: same.slice(0, 2).map(t => t.id) })
  if (same.length >= 1 && flies.length) options.push({ kind: '碰', tiles: [same[0].id, flies[0].id], represented: [tile.code, tile.code] })
  if (flies.length >= 2) options.push({ kind: '碰', tiles: flies.slice(0, 2).map(t => t.id), represented: [tile.code, tile.code] })
  if ((from + 1) % game.count === seat) options.push(...chowChoices(player.hand, tile))
  return options
}

export function winPayments(count: 3 | 4, winner: number, from: number | null, fan: number): number[] {
  const payments = Array(count).fill(0)
  if (from === null) {
    for (let i = 0; i < count; i++) if (i !== winner) { const due = fan * 2; payments[i] -= due; payments[winner] += due }
  } else {
    for (let i = 0; i < count; i++) if (i !== winner) { const due = fan * (i === from ? 2 : 1); payments[i] -= due; payments[winner] += due }
  }
  return payments
}

function settleWin(game: Game, winner: number, from: number | null): void {
  const info = evaluateWin(game, winner, from === null ? undefined : game.lastDiscard!.tile, from === null)!
  const payments = winPayments(game.count, winner, from, info.fan)
  for (let i = 0; i < game.count; i++) game.players[i].score += payments[i]
  game.result = { winner, from, ...info, payments, message: from === null ? `${game.players[winner].name} 自摸！` : `${game.players[winner].name} 胡 ${game.players[from].name} 的牌！` }
  game.phase = 'result'; log(game, info.raw >= 10 ? `${game.result.message} 爆番 ×2（結算值 ${info.fan}）` : `${game.result.message} ${info.fan} 番`)
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
  if (player.hand[index].code === 'x1') throw Error('飛牌必須留在手中，不能打出')
  const [tile] = player.hand.splice(index, 1)
  player.river.push(tile); game.lastDiscard = { tile, from: seat }; game.latestRiverTileId = tile.id; game.selected = null
  game.lastDraw = undefined
  game.consecutiveKongs = 0
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
      game.winContext = 'rob-kong'
      settleWin(game, winners[0], kongSeat)
      log(game, `${game.players[winners[0]].name} 搶槓胡`)
    } else {
      const player = game.players[kongSeat]
      const [fourth] = removeIds(player, [tile.id])
      player.melds[meldIndex].kind = '加槓'; player.melds[meldIndex].tiles.push(fourth)
      game.consecutiveKongs = (game.consecutiveKongs || 0) + 1
      log(game, `${player.name} 加槓成功`)
      if (take(game, kongSeat, true, 'kong')) game.phase = 'discard'
    }
    return
  }
  if (!game.lastDiscard) throw Error('沒有待處理的出牌')
  const { tile, from } = game.lastDiscard
  const ranking: Record<Claim['kind'], number> = { 胡: 4, 槓: 3, 碰: 2, 吃: 1 }
  const candidates = Object.entries(choices).flatMap(([s, claim]) => {
    const seat = Number(s)
    const legal = game.reaction[seat]?.some(c => c.kind === claim?.kind && JSON.stringify(c.tiles) === JSON.stringify(claim?.tiles))
    return claim && legal ? [{ seat, claim }] : []
  }).sort((a, b) => ranking[b.claim.kind] - ranking[a.claim.kind] || (a.claim.kind === '碰' && b.claim.kind === '碰' ? a.claim.tiles.filter(id => game.players[a.seat].hand.some(tile => tile.id === id && tile.code === 'x1')).length - b.claim.tiles.filter(id => game.players[b.seat].hand.some(tile => tile.id === id && tile.code === 'x1')).length : 0) || ((a.seat - from + game.count) % game.count) - ((b.seat - from + game.count) % game.count))
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
  player.melds.push({ kind, tiles: [...consumed, tile], represented: claim.represented ? [...claim.represented, tile.code] : undefined, from })
  if (claim.kind === '槓') game.consecutiveKongs = (game.consecutiveKongs || 0) + 1
  game.active = seat; game.lastDiscard = null
  log(game, `${player.name} ${claim.kind} ${label(tile.code)}`)
  if (claim.kind === '槓') { if (take(game, seat, true, 'kong')) game.phase = 'discard' }
  else game.phase = 'discard'
}

export function declareSelfWin(game: Game, seat: number): void {
  if (game.phase !== 'discard' || game.active !== seat || !evaluateWin(game, seat, undefined, true)) throw Error('現在不能胡牌')
  settleWin(game, seat, null)
}
export function declareSelfKong(game: Game, seat: number, claim: Claim): void {
  if (game.phase !== 'discard' || game.active !== seat || !selfKongs(game, seat).some(c => JSON.stringify(c.tiles) === JSON.stringify(claim.tiles))) throw Error('現在不能槓')
  const player = game.players[seat]
  if (claim.tiles.length === 4) { player.melds.push({ kind: '暗槓', tiles: removeIds(player, claim.tiles), from: null }); game.consecutiveKongs = (game.consecutiveKongs || 0) + 1 }
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
  take(game, seat, true, 'kong')
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
  const discardable = player.hand.filter(tile => tile.code !== 'x1')
  if (!discardable.length) throw Error('手中沒有可以打出的牌')
  const visible = game.players.flatMap(p => [...p.river, ...p.melds.flatMap(m => m.tiles)])
  const score = (tile: Tile): number => {
    const same = player.hand.filter(t => t.code === tile.code).length
    const rank = Number(tile.code[1]), suit = tile.code[0]
    const neighbors = 'mps'.includes(suit) ? player.hand.filter(t => t.code[0] === suit && Math.abs(Number(t.code[1]) - rank) <= 2 && t.id !== tile.id).length : 0
    const seen = visible.filter(t => t.code === tile.code).length
    return (same - 1) * 2 + neighbors - seen * .4 + (suit === 'z' && rank >= 5 ? .3 : 0)
  }
  return discardable.sort((a, b) => score(a) - score(b) || a.id - b.id)[0].id
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
