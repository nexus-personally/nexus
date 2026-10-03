import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'

export function PairingCode({ data, title, variant }: { data: string; title: string; variant?: 'room' }) {
  const [image, setImage] = useState('')
  useEffect(() => { void QRCode.toDataURL(data, { width: 420, margin: 2, errorCorrectionLevel: 'L' }).then(setImage) }, [data])
  return <div className={`offline-code${variant === 'room' ? ' offline-code-room' : ''}`}><h3>{title}</h3>{image && <img src={image} alt="无网配对二维码" />}
    <p>{variant === 'room' ? '请朋友用手机扫描该二维码加入房间' : '让另一台手机扫描这张码。两台手机须连接同一热点，并保持本页打开。'}</p>
    <button onClick={() => void navigator.clipboard?.writeText(data)}><CopyIcon />复制配对文字</button>
  </div>
}

function CopyIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h7A1.5 1.5 0 0 1 19 5.5v10a1.5 1.5 0 0 1-1.5 1.5H15M6.5 8h7A1.5 1.5 0 0 1 15 9.5v10a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 19.5v-10A1.5 1.5 0 0 1 6.5 8Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> }

export function PairingScanner({ title, onScan }: { title: string; onScan: (data: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')
  useEffect(() => {
    if (!scanning) return
    let stopped = false
    let stream: MediaStream | null = null
    let frame = 0
    const canvas = document.createElement('canvas')
    const tick = () => {
      if (stopped) return
      const element = video.current
      if (element && element.readyState >= 2) {
        canvas.width = element.videoWidth; canvas.height = element.videoHeight
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (context && canvas.width && canvas.height) {
          context.drawImage(element, 0, 0)
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
          const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' })
          if (result?.data.startsWith('GQ1.')) { stopped = true; stream?.getTracks().forEach(track => track.stop()); onScanRef.current(result.data); setScanning(false); return }
        }
      }
      frame = requestAnimationFrame(tick)
    }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(result => {
      if (stopped) { result.getTracks().forEach(track => track.stop()); return }
      stream = result
      if (video.current) { video.current.srcObject = result; void video.current.play().then(tick) }
    }).catch(() => { setError('无法开启相机，请允许相机权限，或粘贴配对文字'); setScanning(false) })
    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach(track => track.stop()) }
  }, [scanning])
  return <div className="offline-scanner"><h3>{title}</h3>
    {scanning && <video ref={video} autoPlay muted playsInline />}
    <button onClick={() => { setError(''); setScanning(value => !value) }}>{scanning ? '关闭相机' : '开启相机扫码'}</button>
    <div className="offline-paste"><textarea value={manual} onChange={event => setManual(event.target.value)} placeholder="或粘贴另一台手机复制的配对文字" /><button disabled={!manual.trim()} onClick={() => { onScan(manual.trim()); setManual('') }}>确认配对</button></div>
    {error && <p className="room-error">{error}</p>}
  </div>
}
