import { useCallback, useEffect, useRef, useState } from 'react'
import type { Game } from './engine'
import { audio } from './audio'
import { useOfflineRoom } from './offline-room'
import { PairingCode, PairingScanner } from './offline-pairing'
import { useGameDialog } from './game-dialog'
import { createPortal } from 'react-dom'

type Account = { id: string; login: string; name: string; mamoney: number }
type Seat = { id: string; name: string; connected: boolean; voice?: boolean; ready?: boolean } | null
export type VoiceCredentials = { url: string; token: string }
export type ChatMessage = { id: string; senderId: string | null; senderName: string; text: string; sentAt: number; system?: boolean }
export type Room = { code: string; count: 3 | 4; hostId: string; started: boolean; deadlineAt?: number | null; seats: Seat[]; messages?: ChatMessage[] }
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
  const voiceRequests = useRef<Array<{ resolve: (value: VoiceCredentials) => void; reject: (error: Error) => void }>>([])
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
      if (message.type === 'wallet') { setAccount(message.account); localStorage.setItem(ACCOUNT_KEY, JSON.stringify(message.account)) }
      if (message.type === 'room') { setRoom(message.room); setGame(message.game); setError('') }
      if (message.type === 'voice-token') voiceRequests.current.shift()?.resolve({ url: message.url, token: message.token })
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
  const updateAccount = (value: Account) => { setAccount(value); localStorage.setItem(ACCOUNT_KEY, JSON.stringify(value)) }
  const logout = () => { offline.close(); localStorage.removeItem(KEY); localStorage.removeItem(ACCOUNT_KEY); socket.current?.close(); socket.current = null; setConnected(false); setAccount(null); setRoom(null); setGame(null) }
  const send = (message: Record<string, unknown>) => {
    if (offline.active) { offline.send(message); return }
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) { setError('与房间主机的连接尚未建立'); return }
    socket.current.send(JSON.stringify(message))
  }
  const requestVoiceCredentials = useCallback(() => new Promise<VoiceCredentials>((resolve, reject) => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) { reject(Error('与房间主机的连接尚未建立')); return }
    voiceRequests.current.push({ resolve, reject })
    socket.current.send(JSON.stringify({ type: 'voice-token' }))
    window.setTimeout(() => {
      const index = voiceRequests.current.findIndex(item => item.resolve === resolve)
      if (index >= 0) { voiceRequests.current.splice(index, 1); reject(Error('语音服务连接超时')) }
    }, 10000)
  }), [])
  return { account, room: offline.active ? offline.room : room, game: offline.active ? offline.game : game,
    connected: offline.active ? offline.connected : connected, error: offline.active ? offline.error : error,
    setError: offline.active ? offline.setError : setError, api, authenticate, logout, send, requestVoiceCredentials, setAccount: updateAccount, offline }
}

export type RoomNetwork = ReturnType<typeof useRoomNetwork>

export function RoomPanel({ network, onReturn, authOnly = false, showRoomFlow = true }: { network: RoomNetwork; onReturn: () => void; authOnly?: boolean; showRoomFlow?: boolean }) {
  const confirmDialog = useGameDialog()
  const [page, setPage] = useState<'login' | 'register' | 'reset' | 'profile'>('login')
  const [login, setLogin] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [channel, setChannel] = useState<'offline' | 'online'>('online')
  const [roomAction, setRoomAction] = useState<'create' | 'join' | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const run = async (work: () => Promise<void>) => { setBusy(true); network.setError(''); setNotice(''); try { await work() } catch (error) { network.setError(error instanceof Error ? error.message : '操作失败') } finally { setBusy(false) } }
  const room = network.room
  const offline = network.offline
  const leaveRoom = async () => {
    if (!room) return true
    const offlineHost = offline.active && offline.isHost
    const activeHand = Boolean(network.game && network.game.phase !== 'result' && network.game.phase !== 'match-result')
    const message = offlineHost
      ? activeHand ? '房主离开会结束整个无网房，未完成的本局不会计分。' : '房主离开后，无网房间会立即结束，其他玩家也会断开连接。'
      : activeHand ? '离开后将由电脑接管你的牌，本局仍会继续并正常结算。' : '你将退出当前房间，之后需要重新加入才能回到牌桌。'
    if (!await confirmDialog({ eyebrow: offlineHost ? '港雀 · 无网房间' : '港雀 · 房间操作', title: offlineHost ? '结束房间？' : '离开房间？', message, confirmLabel: offlineHost ? '结束并离开' : '离开房间', cancelLabel: '留在房间', tone: 'danger' })) return false
    if (offline.active) offline.leave()
    else network.send({ type: 'leave' })
    return true
  }
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
      {createPortal(<div className="room-account"><button className="account-summary" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}><span className="account-tile" aria-hidden="true">發</span><b>{network.account.name}</b><i /><span className="account-balance"><img className="account-coin" src="/mahjong/assets/lobby-gold-coin.png" alt="" />妈币 {network.account.mamoney ?? 500}</span></button>{accountOpen && <div className="account-menu"><button disabled={offline.active || !network.connected} onClick={() => { setPage('profile'); setName(network.account?.name || ''); setAccountOpen(false) }}>修改资料</button><button onClick={() => { setAccountOpen(false); void (async () => { if (room && !await leaveRoom()) return; network.logout(); setPage('login') })() }}>退出登录</button></div>}</div>, document.body)}
      {page === 'profile' && <form className="account-profile-form" onSubmit={event => { event.preventDefault(); void run(async () => { const result = await network.api('profile', { name, password, newPassword }); network.setAccount(result.account); setPassword(''); setNewPassword(''); setNotice('资料已更新'); setPage('login') }) }}>
        <button type="button" className="account-profile-close" onClick={() => setPage('login')} aria-label="关闭修改资料">×</button>
        <h3>修改资料</h3>
        <label>用户名<input required maxLength={20} value={name} onChange={event => setName(event.target.value)} /></label>
        <label>当前密码<input required type="password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label>新密码（留空则不修改）<input type="password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
        <button disabled={busy}>保存资料</button>
      </form>}
      {!authOnly && showRoomFlow && (!room ? <div className="room-flow">
        {!offline.active && <>
          <div className="room-channel-choice"><strong>玩家连接</strong><nav aria-label="房间连接方式"><label><input type="radio" name="room-channel" checked={channel === 'online'} onChange={() => { setChannel('online'); setRoomAction(null) }} /><span>线上房间<small>不同地点</small></span></label><label><input type="radio" name="room-channel" checked={channel === 'offline'} onChange={() => { setChannel('offline'); setRoomAction(null) }} /><span>面对面无网<small>同一热点</small></span></label></nav></div>
          <p className="room-channel-help">{channel === 'online' ? '选择线上房间后，朋友输入房间码即可加入。' : '所有手机先连接同一个热点，再通过二维码配对。'}</p>
          <nav className="room-primary-actions" aria-label="创建或加入房间"><button className={roomAction === 'create' ? 'active' : ''} aria-pressed={roomAction === 'create'} onClick={() => setRoomAction('create')}>创建房间</button><button className={roomAction === 'join' ? 'active' : ''} aria-pressed={roomAction === 'join'} onClick={() => setRoomAction('join')}>加入房间</button></nav>
          {roomAction && createPortal(<div className="room-setup-shade" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRoomAction(null) }}><section className="room-flow-panel" role="dialog" aria-modal="true" aria-label={roomAction === 'create' ? '创建房间' : '加入房间'}><button className="room-setup-close" onClick={() => setRoomAction(null)} aria-label="关闭">×</button><h3>{roomAction === 'create' ? '创建房间' : '加入房间'}</h3>
            {channel === 'offline' ? roomAction === 'create' ? <><p>所有手机连接同一热点；空位可由电脑补上。无网局只记录本局分数，不改线上妈币。</p><div className="room-choice-grid"><button onClick={() => { void audio.unlock(); offline.create(4) }}>四人房 <small>152 张港式牌 + 動物 + 飛</small></button><button onClick={() => { void audio.unlock(); offline.create(3) }}>三人房 <small>84 张马来西亚玩法</small></button></div></> : <><p>请房主展示邀请二维码。扫码后，再让房主扫描你的回应码。</p><PairingScanner title="扫描房主二维码" onScan={scanOffer} /></> : roomAction === 'create' ? <><p>通过网络开房，建立后分享 8 位房间码。</p><div className="room-choice-grid"><button disabled={!network.connected} onClick={() => { void audio.unlock(); network.send({ type: 'create', count: 4 }) }}>四人房 <small>152 张港式牌 + 動物 + 飛</small></button><button disabled={!network.connected} onClick={() => { void audio.unlock(); network.send({ type: 'create', count: 3 }) }}>三人房 <small>84 张马来西亚玩法</small></button></div></> : <><p>输入朋友给你的 8 位房间码。</p><div className="room-code-entry"><input value={roomCode} maxLength={8} onChange={event => setRoomCode(event.target.value.toUpperCase())} placeholder="8 位房间码" aria-label="房间码" /><button disabled={!network.connected || roomCode.length !== 8} onClick={() => { void audio.unlock(); network.send({ type: 'join', code: roomCode }) }}>加入</button></div></>}
          </section></div>, document.body)}
        </>}
        {offline.active && offline.pairing?.kind === 'answer' && <div className="room-flow-panel"><PairingCode data={offline.pairing.data} title="让房主扫描此回应码" /><button onClick={offline.leave}>取消配对</button></div>}
      </div> : <div className="room-lobby">
        <div className="room-code">{offline.active ? '无网房间' : '线上房间码'} <strong>{room.code}</strong>{!offline.active && <button onClick={() => navigator.clipboard?.writeText(room.code)}>复制</button>}</div>
        {offline.active && offline.isHost && !room.started && <><button onClick={() => void offline.invite().catch(error => offline.setError(error instanceof Error ? error.message : '无法邀请'))}>邀请朋友扫码</button>{offline.pairing?.kind === 'offer' && <><PairingCode data={offline.pairing.data} title="请朋友扫描邀请二维码" /><PairingScanner title="再扫描朋友手机的回应码" onScan={scanAnswer} /></>}</>}
        <div className="room-seats">{room.seats.map((seat, index) => <div key={index} className={seat?.ready ? 'is-ready' : ''}><span>{index + 1}</span><b>{seat?.name || '电脑补位'}</b><small>{seat ? seat.connected ? seat.ready ? '已准备' : '等待准备' : '暂时断线' : '开局时由电脑入座'}</small></div>)}</div>
        {room.started ? <div className="room-controls"><button onClick={() => { void audio.unlock(); onReturn() }}>返回正在进行的牌局</button>{room.hostId === network.account.id && network.game?.phase !== 'result' && network.game?.phase !== 'match-result' && <button onClick={() => { void confirmDialog({ eyebrow: '港雀 · 房主管理', title: '取消本局？', message: '本局分数不会记录，所有玩家将返回房间，之后可重新准备开局。', confirmLabel: '取消本局', cancelLabel: '继续牌局', tone: 'danger' }).then(confirmed => { if (confirmed) network.send({ type: 'cancel' }) }) }}>取消本局</button>}<button onClick={() => void leaveRoom()}>离开房间</button></div> : <div className="room-controls"><button onClick={() => { void audio.unlock(); onReturn() }}>进入牌桌准备</button><button onClick={() => void leaveRoom()}>离开房间</button></div>}
      </div>)}
    </>}
    {notice && <p className="room-notice">{notice}</p>}{network.error && <p className="room-error">{network.error}</p>}
  </section>
}
