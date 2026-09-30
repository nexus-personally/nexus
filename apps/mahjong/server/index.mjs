import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, createReadStream, statSync } from 'node:fs'
import { join, extname, resolve, sep } from 'node:path'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { WebSocketServer, WebSocket } from 'ws'
import { Pool } from 'pg'
import { aiChooseDiscard, aiClaim, declareSelfKong, declareSelfWin, discard, evaluateWin, newGame, nextHand, resolveReaction, selfKongs } from '../src/engine.ts'
import { settlementDeltas } from '../src/wallet.ts'

const ROOT = resolve(import.meta.dirname, '../dist')
const DATA = resolve(process.env.GANGQUE_DATA_DIR || join(import.meta.dirname, 'data'))
const ACCOUNTS = join(DATA, 'accounts.json')
const usePostgres = Boolean(process.env.DATABASE_URL)
if (!usePostgres) mkdirSync(DATA, { recursive: true })
let accounts = !usePostgres && existsSync(ACCOUNTS) ? JSON.parse(readFileSync(ACCOUNTS, 'utf8')) : []
const pool = usePostgres ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false, minVersion: 'TLSv1.2' } : undefined }) : null
const sessions = new Map()
const rooms = new Map()
const sockets = new Map()
const attempts = new Map()
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }

async function loadAccounts() {
  if (!pool) return
  await pool.query('CREATE TABLE IF NOT EXISTS mahjong_accounts (id text PRIMARY KEY, login text NOT NULL UNIQUE, name text NOT NULL, password text NOT NULL)')
  await pool.query('ALTER TABLE mahjong_accounts ADD COLUMN IF NOT EXISTS mamoney bigint NOT NULL DEFAULT 500')
  await pool.query('CREATE TABLE IF NOT EXISTS mahjong_sessions (token_hash text PRIMARY KEY, account_id text NOT NULL REFERENCES mahjong_accounts(id), created_at timestamptz NOT NULL DEFAULT now())')
  await pool.query('CREATE TABLE IF NOT EXISTS mahjong_wallet_events (account_id text NOT NULL REFERENCES mahjong_accounts(id), event_id text NOT NULL, delta bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(account_id, event_id))')
  const result = await pool.query('SELECT id, login, name, password, mamoney AS balance FROM mahjong_accounts')
  accounts = result.rows
}
async function saveAccount(account) {
  if (pool) {
    await pool.query('INSERT INTO mahjong_accounts (id, login, name, password, mamoney) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password', [account.id, account.login, account.name, account.password, account.balance ?? 500])
    return
  }
  const temp = `${ACCOUNTS}.tmp`
  const snapshot = accounts.some(item => item.id === account.id) ? accounts : [...accounts, account]
  writeFileSync(temp, JSON.stringify(snapshot), { mode: 0o600 })
  renameSync(temp, ACCOUNTS)
}
function hash(password, salt = randomBytes(16).toString('hex')) { return `${salt}:${scryptSync(password, salt, 64).toString('hex')}` }
function matches(password, stored) {
  const [salt, hex] = stored.split(':')
  const expected = Buffer.from(hex, 'hex')
  const actual = scryptSync(password, salt, expected.length)
  return timingSafeEqual(expected, actual)
}
function publicAccount(account) { return { id: account.id, login: account.login, name: account.name, mamoney: Number(account.balance ?? 500) } }
const tokenHash = token => createHash('sha256').update(token).digest('hex')
async function tokenFor(account) {
  const token = randomBytes(32).toString('hex')
  if (pool) await pool.query('INSERT INTO mahjong_sessions (token_hash, account_id) VALUES ($1, $2)', [tokenHash(token), account.id])
  sessions.set(token, account.id)
  return token
}
async function accountFor(token) {
  if (!token) return undefined
  let id = sessions.get(token)
  if (!id && pool) {
    const result = await pool.query('SELECT account_id FROM mahjong_sessions WHERE token_hash = $1', [tokenHash(token)])
    id = result.rows[0]?.account_id
    if (id) sessions.set(token, id)
  }
  return accounts.find(item => item.id === id)
}
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
async function bodyOf(req, parsedBody) {
  if (parsedBody !== undefined) {
    if (Buffer.byteLength(JSON.stringify(parsedBody), 'utf8') > 8192) throw Error('请求过大')
    return parsedBody
  }
  let text = ''
  for await (const chunk of req) { text += chunk; if (text.length > 8192) throw Error('请求过大') }
  return JSON.parse(text || '{}')
}
function validatePassword(value) { return typeof value === 'string' && value.length >= 8 && value.length <= 128 }
function validateLogin(value) { return typeof value === 'string' && /^[a-zA-Z0-9_]{3,24}$/.test(value) }
function validateName(value) { return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 20 }
function rateLimit(req) {
  const forwarded = req.headers['cf-connecting-ip']
  const key = process.env.RENDER_EXTERNAL_URL && typeof forwarded === 'string' && isIP(forwarded) ? forwarded : req.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const record = attempts.get(key) || { time: now, count: 0 }
  if (now - record.time > 60000) { record.time = now; record.count = 0 }
  attempts.set(key, record)
  return ++record.count <= 30
}
async function handleApi(req, res, path, parsedBody) {
  path = path.replace(/^\/mahjong/, '')
  if (req.method !== 'POST') return json(res, 405, { error: '仅支持 POST' })
  if (!rateLimit(req)) return json(res, 429, { error: '操作太频繁，请稍后重试' })
  try {
    const body = await bodyOf(req, parsedBody)
    const account = await accountFor((req.headers.authorization || '').replace(/^Bearer /, ''))
    if (path === '/api/register') {
      if (!validateLogin(body.login) || !validateName(body.name) || !validatePassword(body.password)) throw Error('登录名须为 3～24 位英数字或下划线；用户名 1～20 字；密码至少 8 位')
      if (accounts.some(item => item.login.toLowerCase() === body.login.toLowerCase())) throw Error('登录名已被使用')
      const created = { id: randomBytes(12).toString('hex'), login: body.login, name: body.name.trim(), password: hash(body.password), balance: 500 }
      await saveAccount(created); accounts.push(created)
      return json(res, 200, { token: await tokenFor(created), account: publicAccount(created) })
    }
    if (path === '/api/login') {
      const found = accounts.find(item => item.login.toLowerCase() === String(body.login || '').toLowerCase())
      if (!found || !matches(String(body.password || ''), found.password)) return json(res, 401, { error: '登录名或密码错误' })
      return json(res, 200, { token: await tokenFor(found), account: publicAccount(found) })
    }
    if (path === '/api/reset-password') {
      if (!validatePassword(body.password)) throw Error('新密码至少 8 位')
      const found = accounts.find(item => item.login.toLowerCase() === String(body.login || '').toLowerCase())
      if (!found) return json(res, 404, { error: '找不到登录名' })
      found.password = hash(body.password)
      for (const [token, id] of sessions) if (id === found.id) sessions.delete(token)
      if (pool) await pool.query('DELETE FROM mahjong_sessions WHERE account_id = $1', [found.id])
      sockets.get(found.id)?.close()
      await saveAccount(found)
      return json(res, 200, { ok: true })
    }
    if (!account) return json(res, 401, { error: '请先登录' })
    if (path === '/api/me') return json(res, 200, { account: publicAccount(account) })
    if (path === '/api/wallet/sync') return json(res, 410, { error: '旧版客户端结算已停用；线上牌局由房间主机自动入账' })
    if (path === '/api/profile') {
      if (!matches(String(body.password || ''), account.password)) throw Error('当前密码错误')
      if (body.name !== undefined) { if (!validateName(body.name)) throw Error('用户名须为 1～20 字'); account.name = body.name.trim() }
      if (body.newPassword) { if (!validatePassword(body.newPassword)) throw Error('新密码至少 8 位'); account.password = hash(body.newPassword) }
      await saveAccount(account)
      const room = roomOf(account.id)
      if (room) { const seat = room.seats.findIndex(member => member?.id === account.id); room.seats[seat].name = account.name; if (room.game) room.game.players[seat].name = account.name; broadcast(room) }
      return json(res, 200, { account: publicAccount(account) })
    }
    json(res, 404, { error: '接口不存在' })
  } catch (error) { json(res, 400, { error: error.message || '请求失败' }) }
}

function send(ws, type, payload = {}) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...payload })) }
function roomOf(accountId) { return [...rooms.values()].find(room => room.seats.some(seat => seat?.id === accountId)) }
const REACTION_MS = 15000
const TURN_MS = 60000
function ensureDeadline(room) {
  const game = room.game
  if (!game || !['discard', 'reaction'].includes(game.phase)) { room.deadlineKey = null; room.deadlineAt = null; return null }
  const key = `${game.handId}:${game.phase}:${game.active}:${game.lastDiscard?.tile.id ?? ''}:${game.history[0] ?? ''}`
  if (room.deadlineKey !== key) {
    room.deadlineKey = key
    room.deadlineAt = Date.now() + (game.phase === 'reaction' ? REACTION_MS : TURN_MS)
  }
  return room.deadlineAt
}
function roomInfo(room) { return { code: room.code, count: room.count, hostId: room.hostId, started: !!room.game, deadlineAt: ensureDeadline(room), seats: room.seats.map(seat => seat && { id: seat.id, name: seat.name, connected: sockets.has(seat.id) }) } }
function viewFor(game, seat) {
  const rotate = value => (value - seat + game.count) % game.count
  const players = Array.from({ length: game.count }, (_, index) => {
    const source = game.players[(seat + index) % game.count]
    return { ...source, hand: index === 0 ? source.hand : source.hand.map(tile => ({ id: tile.id, code: 'hidden' })) }
  })
  return { ...game, players, wall: game.wall.map(tile => ({ id: tile.id, code: 'hidden' })), active: rotate(game.active), dealer: rotate(game.dealer), lastDiscard: game.lastDiscard && { ...game.lastDiscard, from: rotate(game.lastDiscard.from) }, reaction: { 0: game.reaction[seat] || [] }, pendingKong: null, result: game.result && { ...game.result, winner: game.result.winner === null ? null : rotate(game.result.winner), from: game.result.from === null ? null : rotate(game.result.from), payments: Array.from({ length: game.count }, (_, index) => game.result.payments[(seat + index) % game.count]), mamoneyDeltas: game.result.mamoneyDeltas && Array.from({ length: game.count }, (_, index) => game.result.mamoneyDeltas[(seat + index) % game.count]) } }
}
async function settleRoom(room) {
  const game = room.game
  if (!game || game.phase !== 'result' || !game.result || game.result.winner === null || room.settledHands.has(game.handId)) return
  if (room.settlement?.handId === game.handId) return room.settlement.promise
  const eligible = room.seats.map((member, seat) => Boolean(member && sockets.has(member.id) && !game.players[seat].ai))
  const eventId = `room-${game.handId}`
  const accountAtSeat = room.seats.map(member => member ? accounts.find(item => item.id === member.id) : undefined)
  const promise = (async () => {
    let deltas
    let entries = []
    if (pool) {
      const client = await pool.connect()
      const balances = new Map()
      try {
        await client.query('BEGIN')
        const participantIds = accountAtSeat.flatMap((account, seat) => account && eligible[seat] ? [account.id] : [])
        const locked = participantIds.length
          ? await client.query('SELECT id, mamoney FROM mahjong_accounts WHERE id = ANY($1::text[]) FOR UPDATE', [participantIds])
          : { rows: [] }
        const lockedBalances = new Map(locked.rows.map(row => [row.id, Number(row.mamoney)]))
        deltas = settlementDeltas(game.result, eligible, accountAtSeat.map(account => account ? lockedBalances.get(account.id) ?? 0 : 0))
        entries = accountAtSeat.flatMap((account, seat) => account && deltas[seat] ? [{ account, delta: deltas[seat] }] : [])
        for (const { account, delta } of entries) {
          if (!account) throw Error('结算帐号不存在')
          const inserted = await client.query('INSERT INTO mahjong_wallet_events (account_id, event_id, delta) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING delta', [account.id, eventId, delta])
          const updated = inserted.rowCount
            ? await client.query('UPDATE mahjong_accounts SET mamoney = GREATEST(0, mamoney + $1) WHERE id = $2 RETURNING mamoney', [delta, account.id])
            : await client.query('SELECT mamoney FROM mahjong_accounts WHERE id = $1', [account.id])
          balances.set(account.id, Number(updated.rows[0].mamoney))
        }
        await client.query('COMMIT')
      } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
      for (const { account } of entries) account.balance = balances.get(account.id)
    } else {
      deltas = settlementDeltas(game.result, eligible, accountAtSeat.map(account => Number(account?.balance ?? 0)))
      entries = accountAtSeat.flatMap((account, seat) => account && deltas[seat] ? [{ account, delta: deltas[seat] }] : [])
      const changes = new Map()
      for (const { account, delta } of entries) {
        if (!account) throw Error('结算帐号不存在')
        if (account.walletEvents?.includes(eventId)) continue
        changes.set(account.id, { balance: Math.max(0, Number(account.balance ?? 500) + delta), walletEvents: [...(account.walletEvents || []), eventId].slice(-2000) })
      }
      if (changes.size) {
        const snapshot = accounts.map(account => changes.has(account.id) ? { ...account, ...changes.get(account.id) } : account)
        const temp = `${ACCOUNTS}.tmp`
        writeFileSync(temp, JSON.stringify(snapshot), { mode: 0o600 })
        renameSync(temp, ACCOUNTS)
        for (const account of accounts) if (changes.has(account.id)) Object.assign(account, changes.get(account.id))
      }
    }
    game.result.mamoneyDeltas = deltas
    room.settledHands.add(game.handId)
    for (const { account } of entries) send(sockets.get(account.id), 'wallet', { account: publicAccount(account) })
  })()
  room.settlement = { handId: game.handId, promise }
  try { await promise } finally { if (room.settlement?.promise === promise) room.settlement = null }
}
async function publishRoom(room) {
  try { await settleRoom(room) }
  catch (error) { broadcast(room); throw error }
  broadcast(room)
}
function broadcast(room) {
  for (let seat = 0; seat < room.count; seat++) {
    const member = room.seats[seat]
    if (!member) continue
    send(sockets.get(member.id), 'room', { room: roomInfo(room), game: room.game ? viewFor(room.game, seat) : null })
  }
}
function leaveRoom(accountId) {
  const room = roomOf(accountId)
  if (!room || room.game) return false
  const seat = room.seats.findIndex(member => member?.id === accountId)
  room.seats[seat] = null
  if (room.hostId === accountId) room.hostId = room.seats.find(Boolean)?.id || null
  if (!room.hostId) rooms.delete(room.code)
  else broadcast(room)
  return true
}
function schedule(room) {
  if (!room.game || room.timer) return
  const game = room.game
  if (game.phase === 'result' || game.phase === 'match-result') return
  const deadline = ensureDeadline(room)
  const waitingHuman = game.phase === 'reaction'
    ? room.seats.some((member, seat) => member && sockets.has(member.id) && (game.reaction[seat] || []).length && !(seat in room.choices))
    : Boolean(room.seats[game.active] && sockets.has(room.seats[game.active].id))
  room.timer = setTimeout(async () => {
    room.timer = null
    const game = room.game
    if (!game || game.phase === 'result' || game.phase === 'match-result') return
    try {
      if (game.phase === 'reaction') {
        const pendingHumans = room.seats.some((member, seat) => member && sockets.has(member.id) && (game.reaction[seat] || []).length && !(seat in room.choices))
        if (pendingHumans && Date.now() < room.deadlineAt) { schedule(room); return }
        const choices = { ...room.choices }
        for (let seat = 0; seat < room.count; seat++) {
          if (!room.seats[seat] || !sockets.has(room.seats[seat].id)) choices[seat] = aiClaim(game, seat)
          else if (!(seat in choices)) choices[seat] = null
        }
        resolveReaction(game, choices); room.choices = {}
      } else {
        if (room.seats[game.active] && sockets.has(room.seats[game.active].id) && Date.now() < room.deadlineAt) { schedule(room); return }
        if (evaluateWin(game, game.active, undefined, true)) declareSelfWin(game, game.active)
        else {
          const kong = game.wall.length ? selfKongs(game, game.active)[0] : undefined
          if (kong) declareSelfKong(game, game.active, kong)
          else discard(game, game.active, aiChooseDiscard(game, game.active))
        }
      }
      await publishRoom(room); schedule(room)
    } catch (error) { console.error('Room AI error:', error) }
  }, waitingHuman ? Math.max(1, deadline - Date.now()) : 650)
}
async function roomAction(room, account, action, payload) {
  const game = room.game
  if (!game) throw Error('牌局尚未开始')
  const seat = room.seats.findIndex(member => member?.id === account.id)
  if (seat < 0) throw Error('你不在房间里')
  if (action === 'next') {
    if (account.id !== room.hostId || !['result', 'match-result'].includes(game.phase)) throw Error('只有房主可开始下一局')
    await settleRoom(room)
    room.game = game.phase === 'match-result' ? newGame(room.count) : nextHand(game)
    room.game.players.forEach((player, index) => { player.name = room.seats[index]?.name || `电脑 ${index + 1}`; player.ai = !room.seats[index] })
    room.choices = {}; await publishRoom(room); schedule(room); return
  }
  if (game.phase === 'discard' && game.active === seat) {
    if (action === 'discard') discard(game, seat, Number(payload.tileId))
    else if (action === 'win') declareSelfWin(game, seat)
    else if (action === 'kong') { const claim = selfKongs(game, seat)[Number(payload.index)]; if (!claim) throw Error('没有可杠的牌'); declareSelfKong(game, seat, claim) }
    else throw Error('当前操作无效')
  } else if (game.phase === 'reaction' && (game.reaction[seat] || []).length) {
    if (action === 'withdraw') {
      if (!(seat in room.choices) || room.choices[seat] === null) throw Error('目前沒有可撤回的應牌')
      room.choices[seat] = null
      if (room.timer) { clearTimeout(room.timer); room.timer = null }
      await publishRoom(room); schedule(room); return
    }
    if (seat in room.choices) throw Error('已选择应牌')
    if (action !== 'pass' && action !== 'claim') throw Error('请选择应牌或过')
    const claim = action === 'claim' ? game.reaction[seat][Number(payload.index)] : null
    if (action === 'claim' && !claim) throw Error('没有这个应牌选项')
    room.choices[seat] = claim
  } else throw Error('尚未轮到你')
  if (room.timer) { clearTimeout(room.timer); room.timer = null }
  await publishRoom(room); schedule(room)
}
function code() { let value; do { value = randomBytes(4).toString('hex').toUpperCase() } while (rooms.has(value)); return value }
async function handleSocket(ws, message, account) {
  const room = roomOf(account.id)
  if (message.type === 'resume') { if (room) { await publishRoom(room); schedule(room) } else send(ws, 'room', { room: null, game: null }); return }
  if (message.type === 'create') {
    if (room) throw Error('请先离开当前房间')
    const count = message.count === 3 ? 3 : 4
    const created = { code: code(), count, hostId: account.id, seats: Array(count).fill(null), game: null, choices: {}, timer: null, deadlineKey: null, deadlineAt: null, settledHands: new Set(), settlement: null }
    created.seats[0] = publicAccount(account); rooms.set(created.code, created); broadcast(created); return
  }
  if (message.type === 'join') {
    if (room) throw Error('请先离开当前房间')
    const target = rooms.get(String(message.code || '').toUpperCase())
    if (!target || target.game) throw Error('房间不存在或牌局已开始')
    const seat = target.seats.findIndex(member => !member)
    if (seat < 0) throw Error('房间已满')
    target.seats[seat] = publicAccount(account); broadcast(target); return
  }
  if (message.type === 'leave') { if (!leaveRoom(account.id)) throw Error('牌局进行中无法离开，断线后可重连'); send(ws, 'room', { room: null, game: null }); return }
  if (!room) throw Error('请先创建或加入房间')
  if (message.type === 'cancel') {
    if (room.hostId !== account.id) throw Error('只有房主可取消本局')
    if (!room.game) throw Error('目前没有进行中的牌局')
    if (room.game.phase === 'result' || room.game.phase === 'match-result') throw Error('本局已经结算，请开始下一局')
    if (room.timer) clearTimeout(room.timer)
    room.timer = null
    room.game = null
    room.choices = {}
    broadcast(room)
    return
  }
  if (message.type === 'start') {
    if (room.hostId !== account.id || room.game) throw Error('只有房主可开局')
    room.game = newGame(room.count)
    room.game.players.forEach((player, seat) => { player.name = room.seats[seat]?.name || `电脑 ${seat + 1}`; player.ai = !room.seats[seat] })
    broadcast(room); schedule(room); return
  }
  if (message.type === 'action') return roomAction(room, account, message.action, message)
  throw Error('未知房间操作')
}

function serveAsset(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname.replace(/^\/mahjong/, '')
  const file = resolve(ROOT, `.${path === '/' ? '/index.html' : path}`)
  if (!(file === ROOT || file.startsWith(ROOT + sep))) return json(res, 403, { error: '禁止访问' })
  let target = file
  try { if (!statSync(target).isFile()) target = join(ROOT, 'index.html') } catch { target = join(ROOT, 'index.html') }
  try { res.writeHead(200, { 'Content-Type': mime[extname(target)] || 'application/octet-stream', 'Cache-Control': target.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600' }); createReadStream(target).pipe(res) }
  catch { json(res, 404, { error: '请先运行 npm run build' }) }
}

function onSocket(ws) {
  let account = null
  ws.on('message', async raw => {
    try {
      if (raw.length > 8192) throw Error('消息过大')
      const message = JSON.parse(String(raw))
      if (!account) {
        if (message.type !== 'auth') throw Error('请先登录')
        account = await accountFor(message.token)
        if (!account) throw Error('登录已失效')
        sockets.get(account.id)?.close()
        sockets.set(account.id, ws)
        send(ws, 'auth', { account: publicAccount(account) })
        const room = roomOf(account.id)
        if (room) await publishRoom(room)
        return
      }
      await handleSocket(ws, message, account)
    } catch (error) { send(ws, 'error', { error: error.message || '操作失败' }) }
  })
  ws.on('close', () => { if (account && sockets.get(account.id) === ws) { sockets.delete(account.id); const room = roomOf(account.id); if (room) { if (room.timer) clearTimeout(room.timer); room.timer = null; void publishRoom(room).catch(error => console.error('Room settlement error:', error)); schedule(room) } } })
}

export async function registerMahjong(fastify) {
  await loadAccounts()
  fastify.all('/mahjong/api/*', async (request, reply) => {
    reply.hijack()
    await handleApi(request.raw, reply.raw, new URL(request.url, 'http://localhost').pathname, request.body)
  })
  fastify.get('/mahjong', async (_request, reply) => reply.redirect('/mahjong/'))
  fastify.get('/mahjong/*', async (request, reply) => {
    reply.hijack()
    serveAsset(request.raw, reply.raw)
  })
  const wss = new WebSocketServer({ noServer: true })
  wss.on('connection', onSocket)
  fastify.server.on('upgrade', (request, socket, head) => {
    if (new URL(request.url, 'http://localhost').pathname !== '/mahjong/ws') return
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request))
  })
  fastify.addHook('onClose', async () => { wss.close(); await pool?.end() })
}
