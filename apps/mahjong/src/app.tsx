import { createRoot } from 'react-dom/client'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import './app3d.css'
import './lobby-reference.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen, faVolumeHigh } from '@fortawesome/free-solid-svg-icons'
import { Guide } from './guide'
import { audio, loadAudioSettings, type AudioCue, type AudioSettings } from './audio'
import { RoomPanel, useRoomNetwork } from './rooms'
import { LandscapeGate } from './landscape-gate'
import { FullscreenButton } from './fullscreen-button'
import { VoiceChat } from './voice-chat'
import { RoomChat } from './room-chat'
import { GameDialogProvider, useGameDialog } from './game-dialog'
import { ArrowsOut, CaretDown, CaretUp, Diamond, DotsThree, House, MusicNotes, Prohibit, Question, SignOut, SpeakerHigh } from '@phosphor-icons/react'
import { SPECIAL_TILE_ATLAS, SPECIAL_TILE_ATLAS_SIZE, specialTileRegion } from './specialTiles'
import {
  aiChooseDiscard, aiClaim, buildTiles, canRedeemPongFly, declareSelfKong, declareSelfWin, discard,
  currentFanPreview, evaluateWin, label, newGame, nextHand, resolveReaction, seatWind, selfKongs,
  redeemPongFly, sortTiles, WIND, type Claim, type Game, type Tile,
} from './engine'
const ThreeTable = lazy(() => import('./table3d/ThreeTable').then(module => ({ default: module.ThreeTable })))

const STORAGE = 'gangque.match.v2'
const CLAIM_PREVIEW_VALUE = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('claim-preview') : null
const CLAIM_PREVIEW = CLAIM_PREVIEW_VALUE !== null

function claimPreviewGame(): Game {
  const game = newGame(3, 0, undefined, 0, 0, 0, 1, 930)
  const handCodes = ['p1', 'p2', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'z1', 'z5', 'x1']
  game.players[0].hand = handCodes.map((code, index) => ({ id: 9000 + index, code }))
  const incoming = { id: 9999, code: 'p2' }
  game.players[1].river.push(incoming)
  game.lastDiscard = { tile: incoming, from: 1 }
  game.latestRiverTileId = incoming.id
  game.phase = 'reaction'
  game.active = 1
  game.reaction = { 0: CLAIM_PREVIEW_VALUE === 'scroll' ? [
    { kind: '吃', tiles: [9000, 9003], represented: ['p1', 'p3'] },
    { kind: '吃', tiles: [9003, 9004], represented: ['p3', 'p4'] },
    { kind: '吃', tiles: [9000, 9012], represented: ['p1', 'p3'] },
  ] : [
    { kind: '碰', tiles: [9001, 9002] },
    { kind: '碰', tiles: [9001, 9012], represented: ['p2', 'p2'] },
  ] }
  return game
}

type ReactionDecision = { index: number; kind: Claim['kind'] } | 'pass' | null

function ClaimTileFace({ code, incoming = false }: { code: string; incoming?: boolean }) {
  const region = specialTileRegion(code)
  return <span className={`claim-tile${incoming ? ' incoming' : ''}`} aria-label={`${label(code)}${incoming ? '，牌友打出的牌' : ''}`}>
    {region
      ? <svg viewBox={`${region.x} ${region.y} ${region.width} ${region.height}`} role="img" aria-hidden="true"><image href={SPECIAL_TILE_ATLAS} width={SPECIAL_TILE_ATLAS_SIZE.width} height={SPECIAL_TILE_ATLAS_SIZE.height} /></svg>
      : <img src={`/mahjong/assets/tiles/${code}.svg`} alt="" />}
  </span>
}

function ClaimCombination({ claim, hand, incoming, onChoose }: { claim: Claim; hand: Tile[]; incoming: Tile; onChoose: () => void }) {
  const tiles = claim.tiles.map(id => hand.find(tile => tile.id === id)).filter((tile): tile is Tile => Boolean(tile))
  return <button className="claim-combination" onClick={onChoose} aria-label={`${claim.kind}：${[...tiles, incoming].map(tile => label(tile.code)).join('、')}`}>
    <span className="claim-tile-row">{tiles.map(tile => <ClaimTileFace key={tile.id} code={tile.code} />)}<ClaimTileFace code={incoming.code} incoming /></span>
  </button>
}

function mamoneyDelta(game: Game, seat: number): number {
  return game.result?.mamoneyDeltas?.[seat] ?? 0
}

function cueFromHistory(message: string): AudioCue {
  if (message.includes('自摸')) return 'tsumo'
  if (message.includes('胡')) return 'hu'
  if (message.includes('槓')) return 'kong'
  if (message.includes('碰')) return 'pong'
  if (message.includes('吃')) return 'chi'
  if (message.includes('打出')) return 'tile-discard'
  if (message.includes('補花')) return 'tile-draw'
  return 'turn'
}

function savedGame(accountId: string): Game | null {
  try {
    const stored = localStorage.getItem(`${STORAGE}.${accountId}`)
    const game = stored ? JSON.parse(stored) as Game : null
    if (!game || game.version !== 2) return null
    if (!game.wallOrder || game.wallOrder.filter(id => game.wall.some(tile => tile.id === id)).join(',') !== game.wall.map(tile => tile.id).join(',')) {
      const stillInWall = new Set(game.wall.map(tile => tile.id))
      game.wallOrder = [
        ...game.wall.map(tile => tile.id),
        ...buildTiles(game.count).map(tile => tile.id).filter(id => !stillInWall.has(id)),
      ]
    }
    return game
  } catch { return null }
}

function App() {
  const network = useRoomNetwork()
  const confirmDialog = useGameDialog()
  const [game, setGame] = useState<Game | null>(() => CLAIM_PREVIEW ? claimPreviewGame() : null)
  const [lobby, setLobby] = useState(!CLAIM_PREVIEW)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [guide, setGuide] = useState(false)
  const [audioSettings, setAudioSettings] = useState(loadAudioSettings)
  const [showAudioSettings, setShowAudioSettings] = useState(false)
  const [gameMenuOpen, setGameMenuOpen] = useState(false)
  const gameMenuRef = useRef<HTMLDivElement>(null)
  const [lobbyMode, setLobbyMode] = useState<'solo' | 'room'>('room')
  const [toast, setToast] = useState('')
  const [clockNow, setClockNow] = useState(Date.now())
  const [claimMode, setClaimMode] = useState<'吃' | '碰' | null>(() => CLAIM_PREVIEW_VALUE === 'scroll' ? '吃' : CLAIM_PREVIEW_VALUE === 'picker' ? '碰' : null)
  const [reactionDecision, setReactionDecision] = useState<ReactionDecision>(() => CLAIM_PREVIEW_VALUE === 'waiting' ? { index: 0, kind: '碰' } : null)
  const [showFanDetails, setShowFanDetails] = useState(false)
  const [resultCollapsed, setResultCollapsed] = useState(false)
  const [roundReadyScreen, setRoundReadyScreen] = useState(false)
  const gameRef = useRef<Game | null>(game)
  const lastRoomLog = useRef('')
  const hadRoomGame = useRef(false)
  const inRoom = !!network.room?.started

  useEffect(() => {
    if (CLAIM_PREVIEW) return
    if (!network.account) { gameRef.current = null; setGame(null); setLobby(true); return }
    if (network.room?.started) return
    const restored = savedGame(network.account.id)
    gameRef.current = restored
    setGame(restored)
    setLobby(true)
  }, [network.account?.id])

  useEffect(() => {
    if (network.game && network.room) {
      hadRoomGame.current = true
      const latest = network.game.history[0] || ''
      if (lastRoomLog.current && latest && latest !== lastRoomLog.current) audio.play(cueFromHistory(latest))
      lastRoomLog.current = latest
      gameRef.current = network.game
      setGame(network.game)
      setSelectedId(current => current !== null && network.game!.players[0].hand.some(tile => tile.id === current && tile.code !== 'x1') ? current : null)
      setLobby(false)
    }
  }, [network.game, network.room?.code])

  useEffect(() => {
    if (network.room?.started || !network.room || !hadRoomGame.current) return
    hadRoomGame.current = false
    lastRoomLog.current = ''
    const restored = network.account ? savedGame(network.account.id) : null
    gameRef.current = restored
    setGame(restored)
    setSelectedId(null)
    setLobbyMode('room')
    setLobby(true)
  }, [network.room?.started, network.room?.code, network.account?.id])

  async function cancelRoomGame() {
    if (network.room?.hostId !== network.account?.id || !network.room?.started) return
    if (await confirmDialog({ eyebrow: '港雀 · 房主管理', title: '取消本局？', message: '本局分数不会记录，所有玩家将返回房间，之后可重新准备开局。', confirmLabel: '取消本局', cancelLabel: '继续牌局', tone: 'danger' })) network.send({ type: 'cancel' })
  }

  async function leaveRoomGame() {
    if (!network.room) return
    const offlineHost = network.offline.active && network.offline.isHost
    const activeHand = Boolean(network.game && network.game.phase !== 'result' && network.game.phase !== 'match-result')
    const message = offlineHost
      ? activeHand ? '房主离开会结束整个无网房，未完成的本局不会计分。' : '房主离开后，无网房间会立即结束，其他玩家也会断开连接。'
      : activeHand ? '离开后将由电脑接管你的牌，本局仍会继续并正常结算。' : '你将退出当前房间，之后需要重新加入才能回到牌桌。'
    if (!await confirmDialog({ eyebrow: offlineHost ? '港雀 · 无网房间' : '港雀 · 房间操作', title: offlineHost ? '结束房间？' : '离开房间？', message, confirmLabel: offlineHost ? '结束并离开' : '离开房间', cancelLabel: '留在牌桌', tone: 'danger' })) return
    if (network.offline.active) network.offline.leave()
    else network.send({ type: 'leave' })
    setLobby(true)
  }

  function commit(next: Game) {
    gameRef.current = next
    setGame({ ...next })
    if (network.account) localStorage.setItem(`${STORAGE}.${network.account.id}`, JSON.stringify(next))
  }
  function message(value: string) {
    setToast(value)
    window.setTimeout(() => setToast(current => current === value ? '' : current), 2600)
  }
  function updateAudio(patch: Partial<AudioSettings>) {
    const next = { ...audioSettings, ...patch }
    setAudioSettings(next)
    audio.setSettings(next)
    if (!next.muted) void audio.unlock()
  }

  useEffect(() => { audio.setSettings(audioSettings) }, [])
  useEffect(() => {
    audio.setScene(lobby || !game ? 'lobby' : game.phase === 'result' || game.phase === 'match-result' ? 'result' : game.wall.length <= 20 ? 'tense' : 'gameplay')
  }, [lobby, game?.phase, game?.wall.length])

  useEffect(() => {
    if (!inRoom || !network.room?.deadlineAt) return
    setClockNow(Date.now())
    const timer = window.setInterval(() => setClockNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [inRoom, network.room?.deadlineAt])

  useEffect(() => {
    setClaimMode(CLAIM_PREVIEW_VALUE === 'scroll' ? '吃' : CLAIM_PREVIEW_VALUE === 'picker' ? '碰' : null)
    setReactionDecision(CLAIM_PREVIEW_VALUE === 'waiting' ? { index: 0, kind: '碰' } : null)
  }, [game?.phase, game?.lastDiscard?.tile.id, game?.lastDiscard?.from, game?.history[0]])

  useEffect(() => {
    setRoundReadyScreen(false)
    if (game?.phase === 'result' || game?.phase === 'match-result') setResultCollapsed(false)
  }, [game?.handId, game?.phase])

  useEffect(() => {
    if (!game || inRoom || lobby || guide || showAudioSettings || game.phase === 'result' || game.phase === 'match-result') return
    if (game.phase === 'discard' && game.active === 0) return
    if (game.phase === 'reaction' && (game.reaction[0] ?? []).length) return
    const timer = window.setTimeout(() => {
      const current = gameRef.current
      if (!current) return
      try {
        const previousLog = current.history[0]
        if (current.phase === 'reaction') {
          const choices: Record<number, Claim | null> = {}
          for (let seat = 1; seat < current.count; seat++) choices[seat] = aiClaim(current, seat)
          resolveReaction(current, choices)
        } else if (current.phase === 'discard' && current.active !== 0) {
          if (evaluateWin(current, current.active, undefined, true)) declareSelfWin(current, current.active)
          else {
            const kong = current.wall.length ? selfKongs(current, current.active)[0] : undefined
            if (kong) declareSelfKong(current, current.active, kong)
            else discard(current, current.active, aiChooseDiscard(current, current.active))
          }
        }
        commit(current)
        audio.play(current.history[0] === previousLog ? current.active === 0 ? 'turn' : 'tile-draw' : cueFromHistory(current.history[0] || ''))
      } catch (error) { message(error instanceof Error ? error.message : '電腦操作失敗') }
    }, 660)
    return () => window.clearTimeout(timer)
  }, [game, inRoom, lobby, guide, showAudioSettings])

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setGuide(false); setShowAudioSettings(false); setGameMenuOpen(false) }
      if (event.key === 'Enter' && !guide && !showAudioSettings && selectedId !== null) act('discard')
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [selectedId, game, guide, showAudioSettings])

  useEffect(() => {
    if (!gameMenuOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (!gameMenuRef.current?.contains(event.target as Node)) setGameMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [gameMenuOpen])

  function start(count: 3 | 4) {
    if (!network.account) { message('請先登入'); return }
    void audio.unlock().then(() => audio.play('tile-shuffle'))
    const next = newGame(count)
    setSelectedId(null)
    setLobby(false)
    commit(next)
  }

  function act(action: string, index = 0) {
    const current = gameRef.current
    if (!current) return
    if (inRoom) {
      if (action === 'hint') {
        const id = aiChooseDiscard(current, 0)
        setSelectedId(id)
        message(`建議打出 ${label(current.players[0].hand.find(tile => tile.id === id)!.code)}`)
        return
      }
      if (action === 'claim') {
        const claim = current.reaction[0]?.[index]
        if (claim) setReactionDecision({ index, kind: claim.kind })
      } else if (action === 'pass' || action === 'withdraw') setReactionDecision('pass')
      network.send({ type: 'action', action, index, tileId: selectedId })
      if (action === 'discard' || action === 'redeem-fly') setSelectedId(null)
      return
    }
    try {
      const claimKind = action === 'claim' ? current.reaction[0]?.[index]?.kind : undefined
      if (action === 'discard' && selectedId !== null && current.phase === 'discard' && current.active === 0) {
        discard(current, 0, selectedId)
        setSelectedId(null)
      } else if (action === 'hint') {
        const id = aiChooseDiscard(current, 0)
        setSelectedId(id)
        message(`建議打出 ${label(current.players[0].hand.find(tile => tile.id === id)!.code)}`)
        return
      } else if (action === 'win') declareSelfWin(current, 0)
      else if (action === 'kong') declareSelfKong(current, 0, selfKongs(current, 0)[index])
      else if (action === 'pass' || action === 'claim') {
        const choices: Record<number, Claim | null> = { 0: action === 'claim' ? current.reaction[0][index] : null }
        for (let seat = 1; seat < current.count; seat++) choices[seat] = aiClaim(current, seat)
        resolveReaction(current, choices)
      } else if (action === 'redeem-fly') { redeemPongFly(current, 0); setSelectedId(null) }
      else if (action === 'next') { setSelectedId(null); commit(nextHand(current)); audio.play('tile-shuffle'); return }
      else return
      commit(current)
      const cue: AudioCue = action === 'discard' ? 'tile-discard' : action === 'win' ? 'tsumo' : action === 'kong' ? 'kong' : action === 'claim' ? ({ 吃: 'chi', 碰: 'pong', 槓: 'kong', 胡: 'hu' } as const)[claimKind || '吃'] : 'button'
      audio.play(cue)
    } catch (error) { message(error instanceof Error ? error.message : '操作失敗') }
  }

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/mahjong/sw.js').catch(() => {})
  }, [])

  if (network.account && network.room && !network.room.started && !lobby) {
    const waitingRoom = network.room
    const mySeat = waitingRoom.seats.find(seat => seat?.id === network.account?.id)
    const amReady = Boolean(mySeat?.ready)
    const readyCount = waitingRoom.seats.filter(seat => seat?.ready).length
    const humanCount = waitingRoom.seats.filter(Boolean).length
    const mySeatIndex = Math.max(0, waitingRoom.seats.findIndex(seat => seat?.id === network.account?.id))
    return <div className="play-page waiting-table-page"><div className="game-screen">
      <div className="table-vignette" />
      <header className="game-header">
        <div className="game-brand-block"><div className="brand"><strong>港雀</strong><small>香港麻雀 · 茶樓牌局</small></div><span className="wallet-badge">媽幣 {network.account.mamoney ?? 500}</span></div>
        <div className="round-tag">等待開局<span>{network.offline.active ? '無網房間' : `房間 ${waitingRoom.code}`}</span></div>
        <div className="header-actions"><VoiceChat network={network} /><RoomChat network={network} /><button className="game-menu-trigger leave-room-game" aria-label="离开房间" onClick={leaveRoomGame}><SignOut weight="bold" aria-hidden="true" /></button></div>
      </header>
      {waitingRoom.seats.map((seat, index) => seat && <div key={seat.id} className={`waiting-seat waiting-seat-${(index - mySeatIndex + waitingRoom.count) % waitingRoom.count}${seat.ready ? ' is-ready' : ''}`}><span>{index + 1}</span><div><b>{seat.id === network.account?.id ? `${seat.name}（你）` : seat.name}</b><small>{seat.connected ? seat.ready ? '已準備' : '等待準備' : '暫時斷線'}</small></div></div>)}
      <section className="table-ready-stage" aria-label="开局准备">
        <button className={amReady ? 'is-ready' : ''} aria-pressed={amReady} onClick={() => { void audio.unlock(); network.send({ type: 'ready', ready: !amReady }) }}>{amReady ? '取消準備' : '準備'}</button>
        <strong>{readyCount} / {humanCount} 玩家已準備</strong>
        <span>{amReady ? '等待其他玩家' : '全員準備後自動開局'}</span>
      </section>
    </div><LandscapeGate /></div>
  }

  if ((!network.account && !CLAIM_PREVIEW) || lobby || !game) return <div className={`lobby-3d${!network.account ? ' is-auth' : ''}`}>
    <header className="lobby-header"><div className="brand"><strong>港雀</strong><small>香港麻雀 · 3D 牌桌</small></div><div className="lobby-header-actions"><FullscreenButton /><button aria-label="玩法说明" title="玩法说明" onClick={() => setGuide(true)}><FontAwesomeIcon icon={faBookOpen} aria-hidden="true" /></button><button aria-label="声音设置" title="声音设置" onClick={() => { void audio.unlock(); setShowAudioSettings(true) }}><FontAwesomeIcon icon={faVolumeHigh} aria-hidden="true" /></button></div></header>
    {!network.account ? <main className="auth-stage"><section className="auth-brand"><h1>港雀</h1><p className="auth-english">HONG KONG MAHJONG</p><p className="auth-invite">一枱麻雀，<br />連繫香港的情與局。</p><img src="/mahjong/assets/lobby-tiles.png" alt="發、中、二筒三張立起的麻將牌" /></section><div className="lobby-auth"><RoomPanel network={network} authOnly onReturn={() => setLobby(false)} /></div></main> : <main className={`game-lobby-stage${network.room ? ' has-room' : ''}`}>
      <div className="game-mode-choices" role="tablist" aria-label="选择游戏模式">
        <button role="tab" aria-selected={lobbyMode === 'solo'} onClick={() => setLobbyMode('solo')}><span className="mode-icon mode-monitor" aria-hidden="true"><img src="/mahjong/assets/lobby-monitor.png" alt="" /></span><span><b>人机对战</b><span className="mode-divider" aria-hidden="true"><Diamond weight="fill" /></span><small>立即开始</small></span></button>
        <button role="tab" aria-selected={lobbyMode === 'room'} onClick={() => setLobbyMode('room')}><span className="mode-icon mode-players" aria-hidden="true"><img src="/mahjong/assets/lobby-players.png" alt="" /></span><span><b>玩家对决</b><span className="mode-divider" aria-hidden="true"><Diamond weight="fill" /></span><small>与朋友同桌</small></span></button>
      </div>
      <div className="game-mode-detail">
        {lobbyMode === 'solo' && <section className="solo-mode-detail" aria-label="人机对战选项">
          {game && !inRoom && <button onClick={() => { void audio.unlock(); setLobby(false) }}><b>继续上次牌局</b><small>{game.count} 人 · 第 {game.handNumber} 局</small></button>}
          <button onClick={() => start(4)}><b>四人香港麻将</b><small>152 张 · 动物、飞 · 三番起胡</small></button>
          <button onClick={() => start(3)}><b>三人马来西亚麻将</b><small>84 张 · 筒子、字牌、飞 · 五番起胡</small></button>
        </section>}
        <RoomPanel network={network} showRoomFlow={lobbyMode === 'room'} onReturn={() => setLobby(false)} />
      </div>
    </main>}{guide && <Guide onClose={() => setGuide(false)} />}{showAudioSettings && <AudioSettingsPanel settings={audioSettings} onChange={updateAudio} onClose={() => setShowAudioSettings(false)} />}<LandscapeGate />
  </div>

  if (inRoom && roundReadyScreen && (game.phase === 'result' || game.phase === 'match-result') && network.account && network.room) {
    const waitingRoom = network.room
    const mySeat = waitingRoom.seats.find(seat => seat?.id === network.account?.id)
    const amReady = Boolean(mySeat?.ready)
    const readyCount = waitingRoom.seats.filter(seat => seat?.connected && seat.ready).length
    const humanCount = waitingRoom.seats.filter(seat => seat?.connected).length
    const mySeatIndex = Math.max(0, waitingRoom.seats.findIndex(seat => seat?.id === network.account?.id))
    return <div className="play-page waiting-table-page"><div className="game-screen">
      <div className="table-vignette" />
      <header className="game-header">
        <div className="game-brand-block"><div className="brand"><strong>港雀</strong><small>香港麻雀 · 茶樓牌局</small></div><span className="wallet-badge">媽幣 {network.account.mamoney ?? 500}</span></div>
        <div className="round-tag">{game.phase === 'match-result' ? '等待新一圈' : '等待下一局'}<span>{network.offline.active ? '無網房間' : `房間 ${waitingRoom.code}`}</span></div>
        <div className="header-actions"><VoiceChat network={network} /><RoomChat network={network} /><button className="game-menu-trigger leave-room-game" aria-label="离开房间" onClick={leaveRoomGame}><SignOut weight="bold" aria-hidden="true" /></button></div>
      </header>
      {waitingRoom.seats.map((seat, index) => seat && <div key={seat.id} className={`waiting-seat waiting-seat-${(index - mySeatIndex + waitingRoom.count) % waitingRoom.count}${seat.ready ? ' is-ready' : ''}`}><span>{index + 1}</span><div><b>{seat.id === network.account?.id ? `${seat.name}（你）` : seat.name}</b><small>{seat.connected ? seat.ready ? '已準備' : '等待準備' : '已離線 · 電腦接管'}</small></div></div>)}
      <section className="table-ready-stage" aria-label="下一局准备">
        <button className={amReady ? 'is-ready' : ''} aria-pressed={amReady} onClick={() => { void audio.unlock(); network.send({ type: 'ready', ready: !amReady }) }}>{amReady ? '取消準備' : '準備'}</button>
        <strong>{readyCount} / {humanCount} 玩家已準備</strong>
        <span>{amReady ? '等待其他在线玩家' : '全员准备后自动开局'}</span>
      </section>
    </div><LandscapeGate /></div>
  }

  const me = game.players[0]
  const isMyTurn = game.phase === 'discard' && game.active === 0
  const claims = game.phase === 'reaction' ? game.reaction[0] ?? [] : []
  const kongs = isMyTurn ? selfKongs(game, 0) : []
  const selfWin = isMyTurn ? evaluateWin(game, 0, undefined, true) : null
  const canRedeemFly = isMyTurn && canRedeemPongFly(game, 0)
  const fanPreview = currentFanPreview(game, 0)
  const round = `${WIND[game.prevailing]}圈 · 第 ${game.handNumber} 局 · ${game.count} 人`
  const turnStatus = game.phase === 'result' ? game.result?.message : isMyTurn ? '輪到你出牌' : claims.length ? '你可以應牌' : game.phase === 'reaction' ? '等待牌友應牌' : `${game.players[game.active].name} 思考中…`
  const centerTurn = game.phase === 'discard' && !isMyTurn
    ? { title: game.players[game.active].name, note: '出牌中' }
    : game.phase === 'reaction' && !claims.length
      ? { title: '等待应牌', note: '其他玩家考虑中' }
      : null
  const secondsLeft = CLAIM_PREVIEW ? 8 : inRoom && network.room?.deadlineAt ? Math.max(0, Math.ceil((network.room.deadlineAt - clockNow) / 1000)) : null
  const visualClaimKinds = (['吃', '碰'] as const).filter(kind => claims.some(claim => claim.kind === kind))
  const directClaims = claims.map((claim, index) => ({ claim, index })).filter(({ claim }) => claim.kind !== '吃' && claim.kind !== '碰')
  const choiceClaims = claimMode
    ? claims.map((claim, index) => ({ claim, index, flyCount: claim.tiles.filter(id => me.hand.some(tile => tile.id === id && tile.code === 'x1')).length }))
      .filter(({ claim }) => claim.kind === claimMode)
      .sort((a, b) => a.flyCount - b.flyCount)
    : []
  const submittedClaim = typeof reactionDecision === 'object' && reactionDecision ? claims[reactionDecision.index] : null
  return <div className="play-page"><div className={`game-screen${isMyTurn ? ' is-my-turn' : ''}`}>
    <Suspense fallback={<div className="loading-scene">正在砌牌牆…</div>}><ThreeTable game={game} selectedId={selectedId} onSelect={id => {
      const tile = me.hand.find(candidate => candidate.id === id)
      if (tile?.code === 'x1') { message('飛牌必須留在手中，不能打出'); return }
      setSelectedId(id)
    }} /></Suspense>
    <div className="table-vignette" />
    <header className="game-header">
      <div className="game-brand-block"><div className="brand"><strong>港雀</strong><small>香港麻雀 · 茶樓牌局</small></div><span className="wallet-badge">媽幣 {network.account?.mamoney ?? 500}</span></div>
      <div className="round-tag">{round}<span>餘牌 {game.wall.length}</span></div>
      <div className="header-actions"><VoiceChat network={network} />{inRoom && <RoomChat network={network} />}<div className="game-menu" ref={gameMenuRef}>
        <button className="game-menu-trigger" aria-label="打开游戏菜单" aria-expanded={gameMenuOpen} aria-controls="game-menu-panel" onClick={() => setGameMenuOpen(open => !open)}><DotsThree weight="bold" aria-hidden="true" /></button>
        {gameMenuOpen && <nav className="game-menu-panel" id="game-menu-panel" aria-label="遊戲選單">
          <button onClick={() => { setGameMenuOpen(false); void audio.unlock(); setShowAudioSettings(true) }}><SpeakerHigh aria-hidden="true" />音量</button>
          <button onClick={() => updateAudio({ bgmEnabled: !audioSettings.bgmEnabled })}><MusicNotes aria-hidden="true" />音樂{audioSettings.bgmEnabled ? '開' : '關'}</button>
          <button onClick={() => { setGameMenuOpen(false); setGuide(true) }}><Question aria-hidden="true" />說明</button>
          <div className="game-menu-fullscreen"><ArrowsOut aria-hidden="true" /><FullscreenButton /></div>
          <div className="game-menu-divider" />
          {inRoom && network.room?.hostId === network.account?.id && game.phase !== 'result' && game.phase !== 'match-result' && <button className="cancel-room-game" onClick={() => { setGameMenuOpen(false); cancelRoomGame() }}><Prohibit aria-hidden="true" />取消本局</button>}
          {inRoom && <button className="leave-room-game" onClick={() => { setGameMenuOpen(false); leaveRoomGame() }}><SignOut aria-hidden="true" />離開房間</button>}
          <button onClick={() => { setGameMenuOpen(false); setLobby(true) }}><House aria-hidden="true" />首頁</button>
        </nav>}
      </div></div>
    </header>
    {game.players.slice(1).map((player, index) => <div key={index} className={`seat-info seat-${index + 1}${game.count === 3 ? ' three-player-seat' : ''}${game.phase === 'discard' && game.active === index + 1 ? ' active-seat' : ''}`}><span>{seatWind(game, index + 1)}</span><div><b>{player.name}</b><small>{seatWind(game, index + 1)}位 · {player.score >= 0 ? '+' : ''}{player.score} 分</small></div></div>)}
    {centerTurn && <div className="center-turn-indicator" role="status" aria-live="polite"><small>轮到</small><strong>{centerTurn.title}</strong><span>{centerTurn.note}{secondsLeft !== null ? ` · ${secondsLeft}秒` : ''}</span></div>}
    <div className="my-status"><span>{seatWind(game, 0)}</span><div><b>{inRoom ? me.name : '你'}</b><small>{seatWind(game, 0)}位 · {me.score >= 0 ? '+' : ''}{me.score} 分</small><button className="current-fan" onClick={() => setShowFanDetails(true)}>目前成立 {fanPreview.fan} 番</button>{fanPreview.transientFan > 0 && <small className="transient-fan">现在自摸可加 {fanPreview.transientFan} 番</small>}</div></div>
    {(isMyTurn || claims.length > 0) && !claimMode && reactionDecision === null && <div className="turn-banner" role="status" aria-live="polite"><strong>{isMyTurn ? '輪到你出牌' : '你可以應牌'}</strong><span>{isMyTurn ? '選一張手牌，再按「出牌」' : '請選擇吃、碰、槓、胡或過'}</span>{secondsLeft !== null && <time aria-hidden="true">{secondsLeft} 秒</time>}</div>}
    <div className="wall-note">{turnStatus}{secondsLeft !== null && !isMyTurn && !claims.length ? ` · ${secondsLeft} 秒` : ''}</div>
    <div className="hand-access" aria-label="你的手牌">{sortTiles([...me.hand]).map(tile => <button key={tile.id} className={selectedId === tile.id ? 'chosen' : ''} onClick={() => setSelectedId(tile.id)} disabled={game.phase === 'result' || game.phase === 'match-result' || tile.code === 'x1'} aria-label={tile.code === 'x1' ? '飛牌不可選擇' : `選擇 ${label(tile.code)}`}>{label(tile.code)}</button>)}</div>
    {claims.length > 0 && claimMode && game.lastDiscard && reactionDecision === null && <section className="claim-picker" aria-label={`選擇${claimMode}牌`}>
      <header><strong>選擇{claimMode}牌</strong>{secondsLeft !== null && <time>{secondsLeft}秒</time>}</header>
      <div className="claim-picker-body"><button className="claim-picker-back" onClick={() => setClaimMode(null)}>‹ 返回</button><div className={`claim-options${choiceClaims.length > 2 ? ' scrollable' : ''}`}>{choiceClaims.map(({ claim, index }) => <ClaimCombination key={index} claim={claim} hand={me.hand} incoming={game.lastDiscard!.tile} onChoose={() => act('claim', index)} />)}</div><button className="claim-picker-pass" onClick={() => act('pass')}>過</button></div>
    </section>}
    {claims.length > 0 && reactionDecision !== null && <section className="claim-picker claim-waiting" role="status" aria-live="polite">
      {reactionDecision === 'pass' || !submittedClaim || !game.lastDiscard ? <><strong>已過牌</strong><span>等待其他玩家</span></> : <><header><strong>已選擇：{submittedClaim.kind}</strong>{secondsLeft !== null && <time>{secondsLeft}秒</time>}</header><div className="claim-waiting-body"><ClaimCombination claim={submittedClaim} hand={me.hand} incoming={game.lastDiscard.tile} onChoose={() => {}} /><span>等待其他玩家回應</span><button onClick={() => act('withdraw')}>撤回</button></div></>}
    </section>}
    {canRedeemFly && <button className="redeem-fly-button" onClick={() => act('redeem-fly')}>起飛</button>}
    {(!claims.length || (!claimMode && reactionDecision === null)) && <div className="action-row"><span className="turn-note">{isMyTurn ? '輪到你出牌' : claims.length ? '請選擇應牌' : '等待牌友出牌'}</span>
      {claims.length ? <>{visualClaimKinds.map(kind => <button key={kind} className="action-ready" data-action-kind={kind} onClick={() => setClaimMode(kind)}>{kind}</button>)}{directClaims.map(({ claim, index }) => <button key={`${claim.kind}-${index}`} className={`action-ready${claim.kind === '胡' ? ' hot' : ''}`} data-action-kind={claim.kind} onClick={() => act('claim', index)}>{claim.kind}</button>)}<button onClick={() => act('pass')}>過</button></> : <><button disabled>吃</button><button disabled>碰</button>{kongs.length ? kongs.map((_, index) => <button key={index} className="action-ready" data-action-kind="槓" onClick={() => act('kong', index)}>槓</button>) : <button disabled>槓</button>}<button className={selfWin ? 'action-ready hot' : ''} data-action-kind="胡" disabled={!selfWin} onClick={() => act('win')}>胡</button><button disabled>過</button></>}
      <button className="discard-button" disabled={!isMyTurn || selectedId === null || me.hand.find(tile => tile.id === selectedId)?.code === 'x1'} onClick={() => act('discard')}>出牌 →</button><button className="hint-button" disabled={!isMyTurn} onClick={() => act('hint')}>建議</button>
    </div>}
    {guide && <Guide onClose={() => setGuide(false)} />}
    {showAudioSettings && <AudioSettingsPanel settings={audioSettings} onChange={updateAudio} onClose={() => setShowAudioSettings(false)} />}
    {showFanDetails && <div className="fan-details" role="dialog" aria-modal="true" aria-label="目前番数明细"><button onClick={() => setShowFanDetails(false)} aria-label="关闭">×</button><strong>目前成立 {fanPreview.fan} 番</strong>{fanPreview.items.length ? fanPreview.items.map((item, index) => <p key={`${item.name}-${index}`}>{item.name}<b>+{item.fan}</b></p>) : <p>目前没有稳定成立的番型</p>}{fanPreview.transientItems.map((item, index) => <p className="transient" key={`${item.name}-${index}`}>{item.name}（立即自摸）<b>+{item.fan}</b></p>)}</div>}
    {(game.phase === 'result' || game.phase === 'match-result') && (resultCollapsed
      ? <button className="result-restore" onClick={() => setResultCollapsed(false)}><CaretDown weight="bold" aria-hidden="true" />展開結算</button>
      : <div className="modal-shade"><div className="result-panel">
      <button className="result-collapse" onClick={() => setResultCollapsed(true)}><CaretUp weight="bold" aria-hidden="true" />收起</button>
      <small>本局結算</small>
      <h2>{game.phase === 'match-result' ? '東南圈完成' : game.result?.message}</h2>
      {game.result?.winner != null && (game.result.raw >= 10
        ? <><strong>爆番 ×2</strong><small>原始番數 {game.result.raw} 番 · 爆番倍率 ×2 · 本局結算值 {game.result.fan}</small></>
        : <strong>{game.result.fan} 番</strong>)}
      <div>{game.result?.items.map((item, index) => <p key={index}>{item.name}<b>+{item.fan}</b></p>)}</div>
      <small className="score-caption">本局輸贏</small><div className="scores round-payments">{game.players.map((player, index) => <span key={index}>{player.name} {(game.result?.payments[index] ?? 0) >= 0 ? '+' : ''}{game.result?.payments[index] ?? 0}</span>)}</div>
      <small className="score-caption">累計分數</small><div className="scores">{game.players.map((player, index) => <span key={index}>{player.name} {player.score >= 0 ? '+' : ''}{player.score}</span>)}</div>
      {inRoom && game.result && (network.offline.active
        ? <p className="wallet-settlement">無網局只記本局分數，線上媽幣不入帳</p>
        : game.result.mamoneyDeltas
          ? <p className="wallet-settlement">本局媽幣 {mamoneyDelta(game, 0) >= 0 ? '+' : ''}{mamoneyDelta(game, 0)} · 帳戶餘額 {network.account?.mamoney ?? 500}</p>
          : <p className="wallet-settlement">媽幣結算尚未完成，請稍後由房主重試</p>)}
      {!inRoom ? <button onClick={() => game.phase === 'match-result' ? setLobby(true) : act('next')}>{game.phase === 'match-result' ? '返回首頁' : '繼續下一局'}</button> : <button onClick={() => setRoundReadyScreen(true)}>{game.phase === 'match-result' ? '前往新一圈准备' : '继续'}</button>}
    </div></div>)}
    {toast && <div className="toast">{toast}</div>}
  </div><LandscapeGate /></div>
}

function AudioSettingsPanel({ settings, onChange, onClose }: { settings: AudioSettings; onChange: (patch: Partial<AudioSettings>) => void; onClose: () => void }) {
  const sliders = [
    { key: 'master', label: '總音量' },
    { key: 'bgm', label: '背景音樂' },
    { key: 'sfx', label: '麻將音效' },
    { key: 'voice', label: '語音' },
  ] as const
  return <div className="modal-shade"><section className="audio-panel" role="dialog" aria-modal="true" aria-label="聲音設定">
    <button className="audio-close" onClick={onClose} aria-label="關閉聲音設定">×</button>
    <small>港雀 · 音效</small><h2>聲音設定</h2>
    <label className="audio-mute"><input type="checkbox" checked={!settings.muted} onChange={event => onChange({ muted: !event.target.checked })} />開啟聲音</label>
    {sliders.map(({ key, label }) => <label className="audio-slider" key={key}><span>{label}</span><input type="range" min="0" max="100" value={Math.round(settings[key] * 100)} onChange={event => onChange({ [key]: Number(event.target.value) / 100 })} /><output>{Math.round(settings[key] * 100)}%</output></label>)}
    <label className="audio-language">語音語言<select value={settings.voiceLanguage} onChange={event => onChange({ voiceLanguage: event.target.value as AudioSettings['voiceLanguage'] })}><option value="mandarin">普通話</option><option value="cantonese">粵語</option><option value="english">English</option><option value="off">不播放語音</option></select></label>
    <p>配樂與牌音為本地合成音。普通話吃、碰、槓、胡、自摸使用內置語音檔；其他語言由瀏覽器和裝置提供。</p>
    <div className="audio-panel-actions"><button onClick={() => { void audio.unlock().then(() => { audio.play('tile-discard'); audio.play('pong') }) }}>試聽「碰」</button><button onClick={onClose}>返回牌局</button></div>
  </section></div>
}

createRoot(document.getElementById('app')!).render(<GameDialogProvider><App /></GameDialogProvider>)
