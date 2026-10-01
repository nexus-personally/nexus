import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoomNetwork, VoiceSignalMessage } from './rooms'
import { Microphone, MicrophoneSlash, SignOut } from '@phosphor-icons/react'

const iceServers: RTCIceServer[] = [
  { urls: import.meta.env.VITE_MAHJONG_STUN_URL || 'stun:stun.cloudflare.com:3478' },
]
if (import.meta.env.VITE_MAHJONG_TURN_URL) {
  iceServers.push({
    urls: import.meta.env.VITE_MAHJONG_TURN_URL,
    username: import.meta.env.VITE_MAHJONG_TURN_USERNAME,
    credential: import.meta.env.VITE_MAHJONG_TURN_CREDENTIAL,
  })
}

export function VoiceChat({ network }: { network: RoomNetwork }) {
  const [enabled, setEnabled] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')
  const [controlsOpen, setControlsOpen] = useState(false)
  const controlsRef = useRef<HTMLDivElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const peers = useRef(new Map<string, RTCPeerConnection>())
  const audios = useRef(new Map<string, HTMLAudioElement>())
  const offered = useRef(new Set<string>())
  const pendingCandidates = useRef(new Map<string, RTCIceCandidateInit[]>())
  const onlineRoom = network.room && !network.offline.active ? network.room : null
  const sendRef = useRef(network.send)
  const roomRef = useRef(onlineRoom)
  sendRef.current = network.send
  roomRef.current = onlineRoom

  const closePeer = useCallback((id: string) => {
    peers.current.get(id)?.close()
    peers.current.delete(id)
    const audio = audios.current.get(id)
    if (audio) { audio.pause(); audio.srcObject = null; audio.remove() }
    audios.current.delete(id)
    offered.current.delete(id)
    pendingCandidates.current.delete(id)
  }, [])

  const stop = useCallback((announce = true) => {
    if (announce && roomRef.current) sendRef.current({ type: 'voice-state', enabled: false })
    for (const id of [...peers.current.keys()]) closePeer(id)
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    setEnabled(false)
    setMuted(false)
  }, [closePeer])

  const peerFor = useCallback((id: string) => {
    const existing = peers.current.get(id)
    if (existing) return existing
    const peer = new RTCPeerConnection({ iceServers })
    stream.current?.getTracks().forEach(track => peer.addTrack(track, stream.current!))
    peer.onicecandidate = event => {
      if (event.candidate) sendRef.current({ type: 'voice-signal', targetId: id, signal: { candidate: event.candidate.toJSON() } })
    }
    peer.ontrack = event => {
      let audio = audios.current.get(id)
      if (!audio) {
        audio = document.createElement('audio')
        audio.autoplay = true
        audio.setAttribute('playsinline', '')
        audio.hidden = true
        document.body.append(audio)
        audios.current.set(id, audio)
      }
      audio.srcObject = event.streams[0]
      void audio.play().catch(() => setError('浏览器阻止了语音播放，请再点一次语音按钮'))
    }
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') closePeer(id)
    }
    peers.current.set(id, peer)
    return peer
  }, [closePeer])

  const flushCandidates = useCallback(async (id: string, peer: RTCPeerConnection) => {
    const pending = pendingCandidates.current.get(id) || []
    pendingCandidates.current.delete(id)
    for (const candidate of pending) await peer.addIceCandidate(candidate)
  }, [])

  useEffect(() => network.onVoiceSignal((message: VoiceSignalMessage) => {
    if (!stream.current) return
    void (async () => {
      try {
        const peer = peerFor(message.fromId)
        if (message.signal.description) {
          await peer.setRemoteDescription(message.signal.description)
          await flushCandidates(message.fromId, peer)
          if (message.signal.description.type === 'offer') {
            await peer.setLocalDescription(await peer.createAnswer())
            sendRef.current({ type: 'voice-signal', targetId: message.fromId, signal: { description: peer.localDescription } })
          }
        }
        if (message.signal.candidate) {
          if (peer.remoteDescription) await peer.addIceCandidate(message.signal.candidate)
          else pendingCandidates.current.set(message.fromId, [...(pendingCandidates.current.get(message.fromId) || []), message.signal.candidate])
        }
      } catch { setError('无法建立语音连接，请尝试离开语音后重新加入') }
    })()
  }), [flushCandidates, network.onVoiceSignal, peerFor])

  useEffect(() => {
    if (!enabled || !onlineRoom || !network.account) return
    const targets = onlineRoom.seats.flatMap(seat => seat && 'voice' in seat && seat.voice && seat.id !== network.account?.id ? [seat.id] : [])
    for (const id of [...peers.current.keys()]) if (!targets.includes(id)) closePeer(id)
    for (const id of targets) {
      const peer = peerFor(id)
      if (network.account.id < id && !offered.current.has(id)) {
        offered.current.add(id)
        void (async () => {
          try {
            await peer.setLocalDescription(await peer.createOffer())
            sendRef.current({ type: 'voice-signal', targetId: id, signal: { description: peer.localDescription } })
          } catch { offered.current.delete(id); setError('无法发起语音连接') }
        })()
      }
    }
  }, [closePeer, enabled, network.account, onlineRoom, peerFor])

  useEffect(() => () => stop(true), [stop])
  useEffect(() => { if (!onlineRoom && enabled) stop(false) }, [enabled, onlineRoom, stop])
  useEffect(() => {
    if (!controlsOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) setControlsOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setControlsOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [controlsOpen])

  const start = async () => {
    setError('')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
      setEnabled(true)
      sendRef.current({ type: 'voice-state', enabled: true })
    } catch { setError('无法使用麦克风，请检查浏览器权限') }
  }

  if (!onlineRoom) return null
  const voiceCount = onlineRoom.seats.filter(seat => seat && 'voice' in seat && seat.voice).length
  return <div className="voice-chat" aria-label="房间语音" ref={controlsRef}>
    {!enabled ? <button className="voice-join" onClick={() => void start()}><Microphone aria-hidden="true" />加入語音{voiceCount ? ` (${voiceCount})` : ''}</button> : <>
      <button className={muted ? 'voice-muted' : 'voice-live'} aria-expanded={controlsOpen} aria-controls="voice-controls" onClick={() => setControlsOpen(open => !open)}>{muted ? <MicrophoneSlash aria-hidden="true" /> : <Microphone aria-hidden="true" />}{muted ? '已靜音' : `語音中 (${Math.max(1, voiceCount)})`}</button>
      {controlsOpen && <div className="voice-controls" id="voice-controls">
        <button onClick={() => {
          const next = !muted
          stream.current?.getAudioTracks().forEach(track => { track.enabled = !next })
          setMuted(next)
        }}>{muted ? <Microphone aria-hidden="true" /> : <MicrophoneSlash aria-hidden="true" />}{muted ? '開啟麥克風' : '靜音'}</button>
        <button onClick={() => { setControlsOpen(false); stop(true) }}><SignOut aria-hidden="true" />退出語音</button>
      </div>}
    </>}
    {error && <span role="alert">{error}</span>}
  </div>
}
