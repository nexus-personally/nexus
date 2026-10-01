import { useCallback, useEffect, useRef, useState } from 'react'
import { Room as LiveKitRoom, RoomEvent, Track, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant } from 'livekit-client'
import type { RoomNetwork } from './rooms'
import { Microphone, MicrophoneSlash, SignOut } from '@phosphor-icons/react'

export function VoiceChat({ network }: { network: RoomNetwork }) {
  const [enabled, setEnabled] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')
  const [controlsOpen, setControlsOpen] = useState(false)
  const [participantCount, setParticipantCount] = useState(0)
  const controlsRef = useRef<HTMLDivElement>(null)
  const roomRef = useRef<LiveKitRoom | null>(null)
  const onlineRoom = network.room && !network.offline.active ? network.room : null
  const onlineRoomRef = useRef(onlineRoom)
  const sendRef = useRef(network.send)
  sendRef.current = network.send
  onlineRoomRef.current = onlineRoom

  const stop = useCallback(async (announce = true) => {
    const room = roomRef.current
    roomRef.current = null
    if (announce && onlineRoomRef.current) sendRef.current({ type: 'voice-state', enabled: false })
    if (room) { await room.localParticipant.setMicrophoneEnabled(false); await room.disconnect() }
    setEnabled(false)
    setMuted(false)
    setParticipantCount(0)
  }, [])

  const start = async () => {
    setError('')
    try {
      const credentials = await network.requestVoiceCredentials()
      const room = new LiveKitRoom({ adaptiveStream: true, dynacast: true })
      const updateCount = () => setParticipantCount(room.remoteParticipants.size + 1)
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication: RemoteTrackPublication, _participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) document.body.append(track.attach())
      })
      room.on(RoomEvent.TrackUnsubscribed, track => track.detach().forEach(element => element.remove()))
      room.on(RoomEvent.ParticipantConnected, updateCount)
      room.on(RoomEvent.ParticipantDisconnected, updateCount)
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) { roomRef.current = null; setEnabled(false); setParticipantCount(0) }
      })
      await room.connect(credentials.url, credentials.token)
      await room.localParticipant.setMicrophoneEnabled(true)
      roomRef.current = room
      setEnabled(true)
      updateCount()
      sendRef.current({ type: 'voice-state', enabled: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法加入房间语音')
      await stop(false)
    }
  }

  useEffect(() => () => { void stop(true) }, [stop])
  useEffect(() => { if (!onlineRoom && enabled) void stop(false) }, [enabled, onlineRoom, stop])
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

  if (!onlineRoom) return null
  const voiceCount = enabled ? participantCount : onlineRoom.seats.filter(seat => seat && 'voice' in seat && seat.voice).length
  return <div className="voice-chat" aria-label="房间语音" ref={controlsRef}>
    {!enabled ? <button className="voice-join" onClick={() => void start()}><Microphone aria-hidden="true" />加入語音{voiceCount ? ` (${voiceCount})` : ''}</button> : <>
      <button className={muted ? 'voice-muted' : 'voice-live'} aria-expanded={controlsOpen} aria-controls="voice-controls" onClick={() => setControlsOpen(open => !open)}>{muted ? <MicrophoneSlash aria-hidden="true" /> : <Microphone aria-hidden="true" />}{muted ? '已靜音' : `語音中 (${Math.max(1, voiceCount)})`}</button>
      {controlsOpen && <div className="voice-controls" id="voice-controls">
        <button onClick={() => {
          const next = !muted
          void roomRef.current?.localParticipant.setMicrophoneEnabled(!next)
          setMuted(next)
        }}>{muted ? <Microphone aria-hidden="true" /> : <MicrophoneSlash aria-hidden="true" />}{muted ? '開啟麥克風' : '靜音'}</button>
        <button onClick={() => { setControlsOpen(false); void stop(true) }}><SignOut aria-hidden="true" />退出語音</button>
      </div>}
    </>}
    {error && <span role="alert">{error}</span>}
  </div>
}
