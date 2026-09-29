import { createRoot } from 'react-dom/client'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import './app3d.css'
import { Guide } from './guide'
import { audio, loadAudioSettings, type AudioCue, type AudioSettings } from './audio'
import { RoomPanel, useRoomNetwork } from './rooms'
import { LandscapeGate } from './landscape-gate'
import { FullscreenButton } from './fullscreen-button'
import {
  aiChooseDiscard, aiClaim, buildTiles, declareSelfKong, declareSelfWin, discard,
  currentFanPreview, evaluateWin, label, newGame, nextHand, resolveReaction, seatWind, selfKongs,
  sortTiles, WIND, type Claim, type Game,
} from './engine'
const ThreeTable = lazy(() => import('./table3d/ThreeTable').then(module => ({ default: module.ThreeTable })))

const STORAGE = 'gangque.match.v2'

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
    if (!game || game.version !== 1) return null
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
  const [game, setGame] = useState<Game | null>(null)
  const [lobby, setLobby] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [guide, setGuide] = useState(false)
  const [audioSettings, setAudioSettings] = useState(loadAudioSettings)
  const [showAudioSettings, setShowAudioSettings] = useState(false)
  const [lobbyMode, setLobbyMode] = useState<'solo' | 'room'>('room')
  const [toast, setToast] = useState('')
  const gameRef = useRef<Game | null>(game)
  const lastRoomLog = useRef('')
  const hadRoomGame = useRef(false)
  const inRoom = !!network.room?.started

  useEffect(() => {
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
      setSelectedId(null)
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

  function cancelRoomGame() {
    if (network.room?.hostId !== network.account?.id || !network.room?.started) return
    if (window.confirm('取消本局并返回房间？本局分数不计，朋友可加入后再由房主开局。')) network.send({ type: 'cancel' })
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
      if (event.key === 'Escape') { setGuide(false); setShowAudioSettings(false) }
      if (event.key === 'Enter' && !guide && !showAudioSettings && selectedId !== null) act('discard')
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [selectedId, game, guide, showAudioSettings])

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
      network.send({ type: 'action', action, index, tileId: selectedId })
      if (action === 'discard') setSelectedId(null)
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
      } else if (action === 'next') { setSelectedId(null); commit(nextHand(current)); audio.play('tile-shuffle'); return }
      else return
      commit(current)
      const cue: AudioCue = action === 'discard' ? 'tile-discard' : action === 'win' ? 'tsumo' : action === 'kong' ? 'kong' : action === 'claim' ? ({ 吃: 'chi', 碰: 'pong', 槓: 'kong', 胡: 'hu' } as const)[claimKind || '吃'] : 'button'
      audio.play(cue)
    } catch (error) { message(error instanceof Error ? error.message : '操作失敗') }
  }

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/mahjong/sw.js').catch(() => {})
  }, [])

  if (!network.account || lobby || !game) return <div className={`lobby-3d${!network.account ? ' is-auth' : ''}`}>
    <header className="lobby-header"><div className="brand"><strong>港雀</strong><small>香港麻雀 · 3D 牌桌</small></div><div className="lobby-header-actions"><FullscreenButton /><button onClick={() => setGuide(true)}>玩法說明</button><button onClick={() => { void audio.unlock(); setShowAudioSettings(true) }}>聲音設定</button></div></header>
    {!network.account ? <main className="auth-stage"><section className="auth-brand"><h1>港雀</h1><p className="auth-english">HONG KONG MAHJONG</p><p className="auth-invite">一枱麻雀，<br />連繫香港的情與局。</p><img src="/mahjong/assets/lobby-tiles.png" alt="發、中、二筒三張立起的麻將牌" /></section><div className="lobby-auth"><RoomPanel network={network} authOnly onReturn={() => setLobby(false)} /></div></main> : <main className="lobby-content"><section><span className="eyebrow">歡迎入座</span><h1>開枱，<br /><em>打一圈。</em></h1><p>真正立體的麻雀桌。登入後可選擇單機對戰，或透過房間碼與朋友同桌。</p><div className="lobby-tags"><span>香港麻雀</span><span>朋友房間</span><span>局域網／線上</span></div></section>
      <div className="lobby-modes" data-active={lobbyMode}><div className="lobby-switch" role="tablist" aria-label="選擇遊戲方式"><button role="tab" aria-selected={lobbyMode === 'solo'} onClick={() => setLobbyMode('solo')}>單機對戰</button><button role="tab" aria-selected={lobbyMode === 'room'} onClick={() => setLobbyMode('room')}>朋友開房</button></div><section className="mode-panel"><h2>單機對戰 <span>✦</span></h2>{game && !inRoom && <button onClick={() => { void audio.unlock(); setLobby(false) }}><b>繼續上次牌局</b><small>{game.count} 人 · 第 {game.handNumber} 局</small></button>}<button onClick={() => start(4)}><b>四人香港麻雀</b><small>144 張 · 花牌 · 三番起胡</small></button><button onClick={() => start(3)}><b>三人港式變體</b><small>116 張 · 可吃牌 · 三番起胡</small></button></section><RoomPanel network={network} onReturn={() => setLobby(false)} /></div>
    </main>}{guide && <Guide onClose={() => setGuide(false)} />}{showAudioSettings && <AudioSettingsPanel settings={audioSettings} onChange={updateAudio} onClose={() => setShowAudioSettings(false)} />}<LandscapeGate />
  </div>

  const me = game.players[0]
  const isMyTurn = game.phase === 'discard' && game.active === 0
  const claims = game.phase === 'reaction' ? game.reaction[0] ?? [] : []
  const kongs = isMyTurn ? selfKongs(game, 0) : []
  const selfWin = isMyTurn ? evaluateWin(game, 0, undefined, true) : null
  const fanPreview = currentFanPreview(game, 0)
  const round = `${WIND[game.prevailing]}圈 · 第 ${game.handNumber} 局 · ${game.count} 人`
  const turnStatus = game.phase === 'result' ? game.result?.message : isMyTurn ? '輪到你出牌' : claims.length ? '你可以應牌' : game.phase === 'reaction' ? '等待牌友應牌' : `${game.players[game.active].name} 思考中…`
  return <div className="play-page"><div className={`game-screen${isMyTurn ? ' is-my-turn' : ''}`}>
    <Suspense fallback={<div className="loading-scene">正在砌牌牆…</div>}><ThreeTable game={game} selectedId={selectedId} onSelect={setSelectedId} /></Suspense>
    <div className="table-vignette" />
    <header className="game-header"><div className="brand"><strong>港雀</strong><small>香港麻雀 · 茶樓牌局</small></div><div className="round-tag">{round}<span>餘牌 {game.wall.length}</span></div><div className="header-actions"><FullscreenButton /><button onClick={() => setGuide(true)}>說明</button><button onClick={() => updateAudio({ bgmEnabled: !audioSettings.bgmEnabled })} aria-label={`背景音樂${audioSettings.bgmEnabled ? '開啟中，按下關閉' : '已關閉，按下開啟'}`}>{audioSettings.bgmEnabled ? '音樂開' : '音樂關'}</button><button onClick={() => { void audio.unlock(); setShowAudioSettings(true) }}>音量</button>{inRoom && network.room?.hostId === network.account?.id && <button className="cancel-room-game" onClick={cancelRoomGame}>取消本局</button>}<button onClick={() => setLobby(true)}>首頁</button></div></header>
    {game.players.slice(1).map((player, index) => <div key={index} className={`seat-info seat-${index + 1}${game.count === 3 ? ' three-player-seat' : ''}`}><span>{seatWind(game, index + 1)}</span><div><b>{player.name}</b><small>{seatWind(game, index + 1)}位 · {player.score >= 0 ? '+' : ''}{player.score} 分</small></div></div>)}
    <div className="center-status"><small>莊家</small><strong>{seatWind(game, game.dealer)}</strong><span>連莊 {game.repeat}</span></div>
    <div className="my-status"><span>{seatWind(game, 0)}</span><div><b>{inRoom ? me.name : '你'}</b><small>{seatWind(game, 0)}位 · {me.score >= 0 ? '+' : ''}{me.score} 分</small><small className="current-fan" title={fanPreview.items.map(item => `${item.name} ${item.fan}番`).join('、') || '目前未有番型'}>目前參考 {fanPreview.fan} 番</small></div></div>
    {(isMyTurn || claims.length > 0) && <div className="turn-banner" role="status" aria-live="polite"><strong>{isMyTurn ? '輪到你出牌' : '你可以應牌'}</strong><span>{isMyTurn ? '選一張手牌，再按「出牌」' : '請選擇吃、碰、槓、胡或過'}</span></div>}
    <div className="flowers">花牌 {me.flowers.length}{me.flowers.map(tile => <span key={tile.id}>{label(tile.code)}</span>)}</div>
    <div className="wall-note">{turnStatus}</div>
    <div className="hand-access" aria-label="你的手牌">{sortTiles([...me.hand]).map(tile => <button key={tile.id} className={selectedId === tile.id ? 'chosen' : ''} onClick={() => setSelectedId(tile.id)} disabled={!isMyTurn} aria-label={`選擇 ${label(tile.code)}`}>{label(tile.code)}</button>)}</div>
    <div className="action-row"><span className="turn-note">{isMyTurn ? '輪到你出牌' : claims.length ? '請選擇應牌' : '等待牌友出牌'}</span>
      {claims.length ? <>{claims.map((claim, index) => <button key={index} className={`action-ready${claim.kind === '胡' ? ' hot' : ''}`} data-action-kind={claim.kind} onClick={() => act('claim', index)}>{claim.kind}{claim.kind === '吃' ? ` ${claim.tiles.map(id => label(me.hand.find(tile => tile.id === id)!.code)).join('·')}` : ''}</button>)}<button onClick={() => act('pass')}>過</button></> : <><button disabled>吃</button><button disabled>碰</button>{kongs.length ? kongs.map((_, index) => <button key={index} className="action-ready" data-action-kind="槓" onClick={() => act('kong', index)}>槓</button>) : <button disabled>槓</button>}<button className={selfWin ? 'action-ready hot' : ''} data-action-kind="胡" disabled={!selfWin} onClick={() => act('win')}>胡</button><button disabled>過</button></>}
      <button className="discard-button" disabled={!isMyTurn || selectedId === null} onClick={() => act('discard')}>出牌 →</button><button className="hint-button" disabled={!isMyTurn} onClick={() => act('hint')}>建議</button>
    </div>
    {guide && <Guide onClose={() => setGuide(false)} />}
    {showAudioSettings && <AudioSettingsPanel settings={audioSettings} onChange={updateAudio} onClose={() => setShowAudioSettings(false)} />}
    {(game.phase === 'result' || game.phase === 'match-result') && <div className="modal-shade"><div className="result-panel"><small>本局結算</small><h2>{game.phase === 'match-result' ? '東南圈完成' : game.result?.message}</h2>{game.result?.winner != null && <strong>{game.result.fan} 番</strong>}<div>{game.result?.items.map((item, index) => <p key={index}>{item.name}<b>+{item.fan}</b></p>)}</div><div className="scores">{game.players.map((player, index) => <span key={index}>{player.name} {player.score >= 0 ? '+' : ''}{player.score}</span>)}</div>{!inRoom || network.room?.hostId === network.account?.id ? <button onClick={() => !inRoom && game.phase === 'match-result' ? setLobby(true) : act('next')}>{game.phase === 'match-result' ? inRoom ? '開始新一圈' : '返回首頁' : '繼續下一局'}</button> : <p>等待房主開始下一局</p>}</div></div>}
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

createRoot(document.getElementById('app')!).render(<App />)
