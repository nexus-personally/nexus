import { useCallback, useEffect, useRef, useState } from 'react'
import type { Game } from './engine'
import { audio } from './audio'
import { useOfflineRoom } from './offline-room'
import { PairingCode, PairingScanner } from './offline-pairing'

type Account = { id: string; login: string; name: string }
type Seat = { id: string; name: string; connected: boolean } | null
export type Room = { code: string; count: 3 | 4; hostId: string; started: boolean; seats: Seat[] }
const KEY = 'gangque.room.token'
const ACCOUNT_KEY = 'gangque.room.cached-account'

function cachedAccount(): Account | null {
  try { const value = localStorage.getItem(ACCOUNT_KEY); return value ? JSON.parse(value) as Account : null } catch { return null }
}

export function useRoomNetwork() {
  const [account, setAccount] = useState<Account | null>(() => localStorage.getItem(KEY) ? cachedAccount() : null)
  const [room, setRoom] = useState<Room | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const socket = useRef<WebSocket | null>(null)
  const retry = useRef<number | null>(null)
  const offline = useOfflineRoom(account)
  const connect = useCallback((token: string) => {
    socket.current?.close()
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${scheme}//${location.host}/mahjong/ws`)
    socket.current = ws
    ws.onopen = () => { ws.send(JSON.stringify({ type: 'auth', token })); setConnected(true) }
    ws.onmessage = event => {
      const message = JSON.parse(event.data)
      if (message.type === 'error') {
        if (message.error === '登录已失效') {
          localStorage.removeItem(KEY)
          localStorage.removeItem(ACCOUNT_KEY)
          setAccount(null); setRoom(null); setGame(null)
          ws.close()
        }
        setError(message.error)
      }
      if (message.type === 'auth') { setAccount(message.account); localStorage.setItem(ACCOUNT_KEY, JSON.stringify(message.account)) }
      if (message.type === 'room') { setRoom(message.room); setGame(message.game); setError('') }
    }
    ws.onclose = () => {
      if (socket.current !== ws) return
      setConnected(false)
      retry.current = window.setTimeout(() => { if (localStorage.getItem(KEY) === token) connect(token) }, 3000)
    }
  }, [])
  useEffect(() => {
    const token = localStorage.getItem(KEY)
    if (token) connect(token)
    return () => { if (retry.current) window.clearTimeout(retry.current); socket.current?.close(); socket.current = null }
  }, [connect])
  const api = useCallback(async (path: string, body: Record<string, unknown>) => {
    const response = await fetch(`/mahjong/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(localStorage.getItem(KEY) ? { Authorization: `Bearer ${localStorage.getItem(KEY)}` } : {}) }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok) throw Error(result.error || '操作失败')
    return result
  }, [])
  const authenticate = async (mode: 'register' | 'login', data: { login: string; password: string; name?: string }) => {
    const result = await api(mode, data)
    localStorage.setItem(KEY, result.token)
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(result.account))
    setAccount(result.account); setError(''); connect(result.token)
  }
  const logout = () => { offline.close(); localStorage.removeItem(KEY); localStorage.removeItem(ACCOUNT_KEY); socket.current?.close(); socket.current = null; setConnected(false); setAccount(null); setRoom(null); setGame(null) }
  const send = (message: Record<string, unknown>) => {
    if (offline.active) { offline.send(message); return }
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) { setError('与房间主机的连接尚未建立'); return }
    socket.current.send(JSON.stringify(message))
  }
  return { account, room: offline.active ? offline.room : room, game: offline.active ? offline.game : game,
    connected: offline.active ? offline.connected : connected, error: offline.active ? offline.error : error,
    setError: offline.active ? offline.setError : setError, api, authenticate, logout, send, setAccount, offline }
}

export type RoomNetwork = ReturnType<typeof useRoomNetwork>

export function RoomPanel({ network, onReturn, authOnly = false }: { network: RoomNetwork; onReturn: () => void; authOnly?: boolean }) {
  const [page, setPage] = useState<'login' | 'register' | 'reset' | 'profile'>('login')
  const [login, setLogin] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [channel, setChannel] = useState<'offline' | 'online'>('offline')
  const [roomAction, setRoomAction] = useState<'create' | 'join'>('create')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const run = async (work: () => Promise<void>) => { setBusy(true); network.setError(''); setNotice(''); try { await work() } catch (error) { network.setError(error instanceof Error ? error.message : '操作失败') } finally { setBusy(false) } }
  const room = network.room
  const offline = network.offline
  const scanOffer = useCallback((data: string) => { void offline.acceptOffer(data).catch(error => offline.setError(error instanceof Error ? error.message : '配对失败')) }, [offline])
  const scanAnswer = useCallback((data: string) => { void offline.acceptAnswer(data).catch(error => offline.setError(error instanceof Error ? error.message : '配对失败')) }, [offline])
  return <section className="room-panel">
    <h2>{authOnly ? '歡迎回來' : '朋友开房'} {!authOnly && <span>✦</span>}</h2>
    <p className="room-subtitle">{authOnly ? '登入後即可開始單機對戰，或與朋友開房同桌。' : '同一局可由朋友与电脑共同入座。无网时各手机先安装本游戏，连接同一热点，再扫码配对。'}</p>
    {!network.account ? <>
      <nav className="room-tabs"><button className={page === 'login' ? 'active' : ''} onClick={() => setPage('login')}>登录</button><button className={page === 'register' ? 'active' : ''} onClick={() => setPage('register')}>注册</button><button className={page === 'reset' ? 'active' : ''} onClick={() => setPage('reset')}>忘记密码</button></nav>
      {page !== 'profile' && <form onSubmit={event => { event.preventDefault(); void run(async () => {
        if (page === 'reset') { await network.api('reset-password', { login, password }); setNotice('密码已更新，请登录'); setPage('login') }
        else await network.authenticate(page, { login, name, password })
      }) }}>
        <label>登录名<input required minLength={3} maxLength={24} autoComplete="username" value={login} onChange={event => setLogin(event.target.value)} placeholder="英文字母、数字或下划线" /></label>
        {page === 'register' && <label>用户名<input required maxLength={20} value={name} onChange={event => setName(event.target.value)} placeholder="牌桌上显示的名字" /></label>}
        <label>{page === 'reset' ? '新密码' : '密码'}<input required minLength={8} type="password" autoComplete={page === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button disabled={busy}>{page === 'register' ? '创建账号' : page === 'reset' ? '更改密码' : '登录'}</button>
      </form>}
      {page === 'reset' && <small className="room-warning">仅凭登录名即可重设密码，任何知道登录名的人都可能接管账号。请勿在此账号保存敏感信息。</small>}
    </> : <>
      <div className="room-account"><b>{network.account.name}</b><span>@{network.account.login} · {offline.active ? network.connected ? '无网房间已连接' : '等待手机配对' : network.connected ? '线上主机已连接' : '离线可用'}</span><button disabled={offline.active || !network.connected} onClick={() => { setPage(page === 'profile' ? 'login' : 'profile'); setName(network.account?.name || '') }}>修改资料</button><button onClick={() => { if (room && !room.started) network.send({ type: 'leave' }); network.logout(); setPage('login') }}>退出登录</button></div>
      {page === 'profile' && <form onSubmit={event => { event.preventDefault(); void run(async () => { const result = await network.api('profile', { name, password, newPassword }); network.setAccount(result.account); setPassword(''); setNewPassword(''); setNotice('资料已更新') }) }}>
        <label>用户名<input required maxLength={20} value={name} onChange={event => setName(event.target.value)} /></label>
        <label>当前密码<input required type="password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label>新密码（留空则不修改）<input type="password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
        <button disabled={busy}>保存资料</button>
      </form>}
      {!authOnly && (!room ? <div className="room-flow">
        {!offline.active && <>
          <nav className="room-channel-tabs" aria-label="房间连接方式"><button className={channel === 'offline' ? 'active' : ''} aria-pressed={channel === 'offline'} onClick={() => { setChannel('offline'); setRoomAction('create') }}>面对面无网</button><button className={channel === 'online' ? 'active' : ''} aria-pressed={channel === 'online'} onClick={() => { setChannel('online'); setRoomAction('create') }}>线上房间</button></nav>
          <nav className="room-action-tabs" aria-label="开房或加入"><button className={roomAction === 'create' ? 'active' : ''} aria-pressed={roomAction === 'create'} onClick={() => setRoomAction('create')}>创建房间</button><button className={roomAction === 'join' ? 'active' : ''} aria-pressed={roomAction === 'join'} onClick={() => setRoomAction('join')}>加入朋友</button></nav>
          <div className="room-flow-panel">
            {channel === 'offline' ? roomAction === 'create' ? <><p>所有手机连接同一热点；空位可由电脑补上。</p><div className="room-choice-grid"><button onClick={() => { void audio.unlock(); offline.create(4) }}>四人房 <small>你和最多三位朋友</small></button><button onClick={() => { void audio.unlock(); offline.create(3) }}>三人房 <small>你和最多两位朋友</small></button></div></> : <><p>请房主展示邀请二维码。扫码后，再让房主扫描你的回应码。</p><PairingScanner title="扫描房主二维码" onScan={scanOffer} /></> : roomAction === 'create' ? <><p>通过网络开房，建立后分享 8 位房间码。</p><div className="room-choice-grid"><button disabled={!network.connected} onClick={() => { void audio.unlock(); network.send({ type: 'create', count: 4 }) }}>四人房 <small>朋友或电脑同桌</small></button><button disabled={!network.connected} onClick={() => { void audio.unlock(); network.send({ type: 'create', count: 3 }) }}>三人房 <small>朋友或电脑同桌</small></button></div></> : <><p>输入朋友给你的 8 位房间码。</p><div className="room-code-entry"><input value={roomCode} maxLength={8} onChange={event => setRoomCode(event.target.value.toUpperCase())} placeholder="8 位房间码" aria-label="房间码" /><button disabled={!network.connected || roomCode.length !== 8} onClick={() => { void audio.unlock(); network.send({ type: 'join', code: roomCode }) }}>加入</button></div></>}
          </div>
        </>}
        {offline.active && offline.pairing?.kind === 'answer' && <div className="room-flow-panel"><PairingCode data={offline.pairing.data} title="让房主扫描此回应码" /><button onClick={offline.leave}>取消配对</button></div>}
      </div> : <div className="room-lobby">
        <div className="room-code">{offline.active ? '无网房间' : '线上房间码'} <strong>{room.code}</strong>{!offline.active && <button onClick={() => navigator.clipboard?.writeText(room.code)}>复制</button>}</div>
        {offline.active && offline.isHost && !room.started && <><button onClick={() => void offline.invite().catch(error => offline.setError(error instanceof Error ? error.message : '无法邀请'))}>邀请朋友扫码</button>{offline.pairing?.kind === 'offer' && <><PairingCode data={offline.pairing.data} title="请朋友扫描邀请二维码" /><PairingScanner title="再扫描朋友手机的回应码" onScan={scanAnswer} /></>}</>}
        <div className="room-seats">{room.seats.map((seat, index) => <div key={index}><span>{['东', '南', '西', '北'][index]}</span><b>{seat?.name || '电脑补位'}</b><small>{seat ? seat.connected ? '已连接' : '暂时断线' : '开局时由电脑入座'}</small></div>)}</div>
        {room.started ? <div className="room-controls"><button onClick={() => { void audio.unlock(); onReturn() }}>返回正在进行的牌局</button>{room.hostId === network.account.id && <button onClick={() => { if (window.confirm('取消本局并返回房间？本局分数不计，朋友可加入后再由房主开局。')) network.send({ type: 'cancel' }) }}>取消本局</button>}</div> : <div className="room-controls">{room.hostId === network.account.id && <button onClick={() => { void audio.unlock(); network.send({ type: 'start' }) }}>开始牌局</button>}<button onClick={() => offline.active ? offline.leave() : network.send({ type: 'leave' })}>离开房间</button></div>}
      </div>)}
    </>}
    {notice && <p className="room-notice">{notice}</p>}{network.error && <p className="room-error">{network.error}</p>}
  </section>
}
