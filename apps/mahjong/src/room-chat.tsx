import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChatCircleDots, Eye, EyeSlash, PaperPlaneRight } from '@phosphor-icons/react'
import type { ChatMessage, RoomNetwork } from './rooms'

const BARRAGE_KEY = 'gangque.barrage.visible'

export function RoomChat({ network }: { network: RoomNetwork }) {
  const messages = network.room?.messages ?? []
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [visible, setVisible] = useState(() => localStorage.getItem(BARRAGE_KEY) !== 'false')
  const [seenCount, setSeenCount] = useState(messages.length)
  const [activeBarrage, setActiveBarrage] = useState<ChatMessage[]>([])
  const [barrageTarget, setBarrageTarget] = useState<Element | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef(new Set(messages.map(message => message.id)))
  const historyRef = useRef<HTMLDivElement>(null)
  const unread = open ? 0 : Math.max(0, messages.length - seenCount)

  useEffect(() => {
    if (!messages.length) setSeenCount(0)
    else if (open) setSeenCount(messages.length)
  }, [open, messages.length])
  useEffect(() => {
    if (expanded) historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight })
  }, [expanded, messages.length])
  useEffect(() => {
    setBarrageTarget(chatRef.current?.closest('.game-screen') ?? null)
  }, [])
  useEffect(() => {
    if (!messages.length) { seenIds.current.clear(); setActiveBarrage([]); return }
    const incoming = messages.filter(message => !message.system && !seenIds.current.has(message.id))
    messages.forEach(message => seenIds.current.add(message.id))
    if (!incoming.length) return
    setActiveBarrage(current => [...current, ...incoming].slice(-5))
    const ids = new Set(incoming.map(message => message.id))
    window.setTimeout(() => setActiveBarrage(current => current.filter(message => !ids.has(message.id))), 8200)
  }, [messages])

  const send = () => {
    const value = text.trim()
    if (!value) return
    network.send({ type: 'chat', text: value })
    setText('')
  }
  const toggleVisible = () => {
    const next = !visible
    setVisible(next)
    localStorage.setItem(BARRAGE_KEY, String(next))
  }

  return <>
    {visible && barrageTarget && createPortal(<div className="barrage-layer" aria-live="polite">{activeBarrage.map((message, index) => <div key={message.id} className="barrage-message" style={{ top: `calc(18cqh + ${index * 4.2}cqh)` } as CSSProperties}><b>{message.senderName}</b><span>{message.text}</span></div>)}</div>, barrageTarget)}
    <div className="room-chat" ref={chatRef}>
      <button className="chat-trigger" aria-label="打开弹幕" aria-expanded={open} onClick={() => setOpen(value => !value)}><ChatCircleDots weight="bold" aria-hidden="true" />弹幕{unread > 0 && <span>{Math.min(unread, 99)}</span>}</button>
      {open && <section className={`chat-popover${expanded ? ' is-expanded' : ''}`} aria-label="房间聊天">
        <header><strong>{expanded ? '房间聊天' : '发送弹幕'}</strong><button onClick={toggleVisible} aria-label={visible ? '隐藏弹幕' : '显示弹幕'}>{visible ? <Eye aria-hidden="true" /> : <EyeSlash aria-hidden="true" />}{visible ? '弹幕开' : '弹幕关'}</button></header>
        {expanded && <div className="chat-history" ref={historyRef}>{messages.length ? messages.map(message => <p key={message.id} className={message.system ? 'system' : ''}>{message.system ? <span>{message.text}</span> : <><b>{message.senderName}</b><span>{message.text}</span></>}</p>) : <small>这一局还没有消息</small>}</div>}
        <form onSubmit={event => { event.preventDefault(); send() }}><input value={text} maxLength={50} onChange={event => setText(event.target.value)} placeholder="输入弹幕（最多 50 字）" aria-label="弹幕内容" /><button disabled={!text.trim()} aria-label="发送弹幕"><PaperPlaneRight weight="bold" aria-hidden="true" /></button></form>
        <button className="chat-expand" onClick={() => setExpanded(value => !value)}>{expanded ? '收起聊天记录' : '查看聊天记录'}</button>
      </section>}
    </div>
  </>
}
