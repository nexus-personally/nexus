import { useCallback, useEffect, useRef, useState } from 'react'
import { compressSync, decompressSync, strFromU8, strToU8 } from 'fflate'
import {
  aiChooseDiscard, aiClaim, declareSelfKong, declareSelfWin, discard, evaluateWin,
  newGame, nextHand, resolveReaction, selfKongs, type Claim, type Game,
} from './engine'

export type OfflineAccount = { id: string; login: string; name: string }
export type OfflineRoom = {
  code: string
  count: 3 | 4
  hostId: string
  started: boolean
  seats: ({ id: string; name: string; connected: boolean } | null)[]
}
type Update = (room: OfflineRoom | null, game: Game | null, connected: boolean) => void
type Signal = { version: 1; kind: 'offer' | 'answer'; session: string; room: string; sdp: string }
type Pairing = { kind: 'offer' | 'answer'; data: string }

const PREFIX = 'GQ1.'

function encodeSignal(signal: Signal): string {
  const bytes = compressSync(strToU8(JSON.stringify(signal)), { level: 9 })
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return PREFIX + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function decodeSignal(value: string): Signal {
  const text = value.trim()
  if (!text.startsWith(PREFIX) || text.length > 12000) throw Error('这不是港雀的无网配对二维码')
  const binary = atob(text.slice(PREFIX.length).replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  const signal = JSON.parse(strFromU8(decompressSync(bytes))) as Signal
  if (signal.version !== 1 || !['offer', 'answer'].includes(signal.kind) || typeof signal.sdp !== 'string' || typeof signal.session !== 'string') throw Error('配对资料不完整')
  return signal
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function waitForIce(peer: RTCPeerConnection): Promise<string> {
  return new Promise((resolve, reject) => {
    let timer = 0
    const finish = () => {
      if (peer.iceGatheringState !== 'complete') return
      clearTimeout(timer)
      peer.removeEventListener('icegatheringstatechange', finish)
      const sdp = peer.localDescription?.sdp
      if (sdp && sdp.includes('candidate:')) resolve(sdp)
      else reject(Error('手机未取得热点局域网地址，请确认两台手机已连上同一热点'))
    }
    timer = window.setTimeout(() => { peer.removeEventListener('icegatheringstatechange', finish); reject(Error('热点连接准备超时，请重试配对')) }, 20000)
    peer.addEventListener('icegatheringstatechange', finish)
    finish()
  })
}

function playerView(game: Game, seat: number): Game {
  const rotate = (value: number) => (value - seat + game.count) % game.count
  const players = Array.from({ length: game.count }, (_, index) => {
    const source = game.players[(seat + index) % game.count]
    return { ...source, hand: index === 0 ? source.hand : source.hand.map(tile => ({ id: tile.id, code: 'hidden' })) }
  }) as Game['players']
  return {
    ...game, players,
    wall: game.wall.map(tile => ({ id: tile.id, code: 'hidden' })) as Game['wall'],
    active: rotate(game.active), dealer: rotate(game.dealer),
    lastDiscard: game.lastDiscard && { ...game.lastDiscard, from: rotate(game.lastDiscard.from) },
    reaction: { 0: game.reaction[seat] || [] }, pendingKong: null,
    result: game.result && { ...game.result,
      winner: game.result.winner === null ? null : rotate(game.result.winner),
      from: game.result.from === null ? null : rotate(game.result.from),
      payments: Array.from({ length: game.count }, (_, index) => game.result!.payments[(seat + index) % game.count]),
    },
  }
}

class PhoneHost {
  room: OfflineRoom
  game: Game | null = null
  choices: Record<number, Claim | null> = {}
  private peers = new Map<number, { peer: RTCPeerConnection; channel: RTCDataChannel }>()
  private pending: { peer: RTCPeerConnection; channel: RTCDataChannel; session: string } | null = null
  private timer: number | null = null
  constructor(private account: OfflineAccount, count: 3 | 4, private update: Update, private onError: (value: string) => void) {
    this.room = { code: randomCode(), count, hostId: account.id, started: false, seats: Array(count).fill(null) }
    this.room.seats[0] = { id: account.id, name: account.name, connected: true }
    this.broadcast()
  }
  private broadcast() {
    this.room.started = !!this.game
    this.update({ ...this.room, seats: [...this.room.seats] }, this.game ? playerView(this.game, 0) : null, true)
    for (const [seat, { channel }] of this.peers) if (channel.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'room', room: this.room, game: this.game ? playerView(this.game, seat) : null }))
    }
  }
  async invite(): Promise<string> {
    if (this.game) throw Error('牌局进行中不能加入新玩家，请房主先取消本局')
    if (this.room.seats.every(Boolean)) throw Error('房间已满')
    this.pending?.peer.close()
    const peer = new RTCPeerConnection({ iceServers: [] })
    const channel = peer.createDataChannel('gangque', { ordered: true })
    const session = randomCode()
    this.pending = { peer, channel, session }
    channel.onopen = () => {
      channel.send(JSON.stringify({ type: 'welcome' }))
    }
    channel.onmessage = event => {
      try {
        const message = JSON.parse(String(event.data))
        if (message.type !== 'hello') return
        const incoming = message.account as OfflineAccount
        if (!incoming || typeof incoming.id !== 'string' || typeof incoming.name !== 'string' || !incoming.id || !incoming.name) throw Error('玩家资料不完整')
        if (this.game) throw Error('牌局已经开始')
        let seat = this.room.seats.findIndex(member => member?.id === incoming.id)
        if (seat < 0) seat = this.room.seats.findIndex(member => !member)
        if (seat < 1) throw Error('房间已满或帐号重复')
        this.peers.get(seat)?.peer.close()
        this.room.seats[seat] = { id: incoming.id, name: incoming.name.slice(0, 20), connected: true }
        this.peers.set(seat, { peer, channel })
        this.pending = null
        channel.onmessage = packet => {
          try { this.action(seat, JSON.parse(String(packet.data))) } catch (error) { channel.send(JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : '操作失败' })) }
        }
        peer.onconnectionstatechange = () => {
          if (['failed', 'disconnected', 'closed'].includes(peer.connectionState) && this.peers.get(seat)?.peer === peer) {
            this.peers.delete(seat)
            if (this.game) this.room.seats[seat] = { ...this.room.seats[seat]!, connected: false }
            else this.room.seats[seat] = null
            this.broadcast(); this.schedule()
          }
        }
        this.broadcast()
      } catch (error) { this.onError(error instanceof Error ? error.message : '配对失败'); peer.close() }
    }
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' && this.pending?.peer === peer) this.onError('连接失败。热点可能阻止设备互连，请重新配对或更换热点主机')
    }
    await peer.setLocalDescription(await peer.createOffer())
    const sdp = await waitForIce(peer)
    return encodeSignal({ version: 1, kind: 'offer', session, room: this.room.code, sdp })
  }
  async acceptAnswer(value: string) {
    const signal = decodeSignal(value)
    if (signal.kind !== 'answer' || signal.session !== this.pending?.session || signal.room !== this.room.code) throw Error('这不是当前邀请的回应二维码')
    await this.pending.peer.setRemoteDescription({ type: 'answer', sdp: signal.sdp })
  }
  action(seat: number, message: Record<string, unknown>) {
    if (message.type === 'leave') {
      if (seat === 0) return
      if (this.game) throw Error('牌局进行中无法离开，断线后由电脑接手')
      this.peers.get(seat)?.peer.close(); this.peers.delete(seat); this.room.seats[seat] = null; this.broadcast(); return
    }
    if (message.type === 'cancel') {
      if (seat !== 0 || !this.game) throw Error('只有房主可取消本局')
      if (this.timer) clearTimeout(this.timer)
      this.timer = null; this.game = null; this.choices = {}; this.broadcast(); return
    }
    if (message.type === 'start') {
      if (seat !== 0 || this.game) throw Error('只有房主可开局')
      this.game = newGame(this.room.count)
      this.game.players.forEach((player, index) => { player.name = this.room.seats[index]?.name || `电脑 ${index + 1}`; player.ai = !this.room.seats[index] })
      this.broadcast(); this.schedule(); return
    }
    if (message.type !== 'action') throw Error('未知房间操作')
    const game = this.game
    if (!game) throw Error('牌局尚未开始')
    const action = String(message.action)
    if (action === 'next') {
      if (seat !== 0 || !['result', 'match-result'].includes(game.phase)) throw Error('只有房主可开始下一局')
      this.game = game.phase === 'match-result' ? newGame(this.room.count) : nextHand(game)
      this.game.players.forEach((player, index) => { player.name = this.room.seats[index]?.name || `电脑 ${index + 1}`; player.ai = !this.room.seats[index] })
      this.choices = {}; this.broadcast(); this.schedule(); return
    }
    if (game.phase === 'discard' && game.active === seat) {
      if (action === 'discard') discard(game, seat, Number(message.tileId))
      else if (action === 'win') declareSelfWin(game, seat)
      else if (action === 'kong') {
        const claim = selfKongs(game, seat)[Number(message.index)]
        if (!claim) throw Error('没有可杠的牌')
        declareSelfKong(game, seat, claim)
      } else throw Error('当前操作无效')
    } else if (game.phase === 'reaction' && (game.reaction[seat] || []).length) {
      if (seat in this.choices) throw Error('已选择应牌')
      if (action !== 'pass' && action !== 'claim') throw Error('请选择应牌或过')
      const claim = action === 'claim' ? game.reaction[seat][Number(message.index)] : null
      if (action === 'claim' && !claim) throw Error('没有这个应牌选项')
      this.choices[seat] = claim
    } else throw Error('尚未轮到你')
    this.broadcast(); this.schedule()
  }
  private schedule() {
    if (!this.game || this.timer) return
    this.timer = window.setTimeout(() => {
      this.timer = null
      const game = this.game
      if (!game || game.phase === 'result' || game.phase === 'match-result') return
      try {
        if (game.phase === 'reaction') {
          const waiting = this.room.seats.some((member, seat) => member?.connected && (game.reaction[seat] || []).length && !(seat in this.choices))
          if (waiting) return
          const choices = { ...this.choices }
          for (let seat = 0; seat < this.room.count; seat++) if (!this.room.seats[seat]?.connected) choices[seat] = aiClaim(game, seat)
          resolveReaction(game, choices); this.choices = {}
        } else if (!this.room.seats[game.active]?.connected) {
          if (evaluateWin(game, game.active, undefined, true)) declareSelfWin(game, game.active)
          else {
            const kong = game.wall.length ? selfKongs(game, game.active)[0] : undefined
            if (kong) declareSelfKong(game, game.active, kong)
            else discard(game, game.active, aiChooseDiscard(game, game.active))
          }
        } else return
        this.broadcast(); this.schedule()
      } catch (error) { this.onError(error instanceof Error ? error.message : '电脑操作失败') }
    }, 650)
  }
  close() {
    if (this.timer) clearTimeout(this.timer)
    this.pending?.peer.close()
    for (const { peer } of this.peers.values()) peer.close()
    this.peers.clear()
  }
}

class PhoneGuest {
  private peer: RTCPeerConnection | null = null
  private channel: RTCDataChannel | null = null
  private closing = false
  constructor(private account: OfflineAccount, private update: Update, private onError: (value: string) => void) {}
  async acceptOffer(value: string): Promise<string> {
    const signal = decodeSignal(value)
    if (signal.kind !== 'offer') throw Error('请扫描房主的邀请二维码')
    this.close()
    this.closing = false
    const peer = new RTCPeerConnection({ iceServers: [] })
    this.peer = peer
    peer.ondatachannel = event => {
      const channel = event.channel
      this.channel = channel
      channel.onopen = () => {
        channel.send(JSON.stringify({ type: 'hello', account: this.account }))
      }
      channel.onmessage = packet => {
        try {
          const message = JSON.parse(String(packet.data))
          if (message.type === 'room') this.update(message.room, message.game, true)
          if (message.type === 'error') this.onError(message.error)
        } catch { this.onError('收到的牌局资料无法读取') }
      }
      channel.onclose = () => { if (!this.closing) { this.update(null, null, false); this.onError('与房主断开连接，请重新扫码加入') } }
    }
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed') this.onError('连接失败。热点可能阻止设备互连，请重新配对')
    }
    await peer.setRemoteDescription({ type: 'offer', sdp: signal.sdp })
    await peer.setLocalDescription(await peer.createAnswer())
    const sdp = await waitForIce(peer)
    return encodeSignal({ version: 1, kind: 'answer', session: signal.session, room: signal.room, sdp })
  }
  send(message: Record<string, unknown>) {
    if (this.channel?.readyState !== 'open') throw Error('尚未与房主连接')
    this.channel.send(JSON.stringify(message))
  }
  close() { this.closing = true; this.channel?.close(); this.peer?.close(); this.channel = null; this.peer = null }
}

export function useOfflineRoom(account: OfflineAccount | null) {
  const [active, setActive] = useState(false)
  const [room, setRoom] = useState<OfflineRoom | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const host = useRef<PhoneHost | null>(null)
  const guest = useRef<PhoneGuest | null>(null)
  const update = useCallback<Update>((nextRoom, nextGame, isConnected) => { setRoom(nextRoom); setGame(nextGame); setConnected(isConnected); if (nextRoom) setPairing(null) }, [])
  const close = useCallback(() => {
    host.current?.close(); guest.current?.close(); host.current = null; guest.current = null
    setActive(false); setRoom(null); setGame(null); setConnected(false); setPairing(null); setError('')
  }, [])
  useEffect(() => () => { host.current?.close(); guest.current?.close() }, [])
  const create = (count: 3 | 4) => {
    if (!account) throw Error('请先在线登录一次，让这台手机保存帐号资料')
    close(); setActive(true)
    host.current = new PhoneHost(account, count, update, setError)
  }
  const invite = async () => {
    if (!host.current) throw Error('请先创建无网房间')
    setError('')
    setPairing({ kind: 'offer', data: await host.current.invite() })
  }
  const acceptOffer = async (data: string) => {
    if (!account) throw Error('请先在线登录一次，让这台手机保存帐号资料')
    close(); setActive(true)
    guest.current = new PhoneGuest(account, update, setError)
    setPairing({ kind: 'answer', data: await guest.current.acceptOffer(data) })
  }
  const acceptAnswer = async (data: string) => {
    if (!host.current) throw Error('请先创建无网房间')
    await host.current.acceptAnswer(data)
    setPairing(null)
  }
  const send = (message: Record<string, unknown>) => {
    try {
      if (host.current) host.current.action(0, message)
      else guest.current?.send(message)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败') }
  }
  const leave = () => {
    if (guest.current && !room?.started) { try { guest.current.send({ type: 'leave' }) } catch { /* disconnected */ } }
    close()
  }
  return { active, room, game, connected, error, setError, pairing, isHost: !!host.current,
    create, invite, acceptOffer, acceptAnswer, send, leave, close, clearPairing: () => setPairing(null) }
}
