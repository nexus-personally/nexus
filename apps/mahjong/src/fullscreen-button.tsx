import { useEffect, useState } from 'react'

export function FullscreenButton() {
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  const [error, setError] = useState(false)
  useEffect(() => {
    const update = () => { setFull(!!document.fullscreenElement); setError(false) }
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  if (window.matchMedia('(display-mode: fullscreen)').matches) return null
  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
      if (screen.orientation && 'lock' in screen.orientation) {
        try { await (screen.orientation as ScreenOrientation & { lock: (mode: string) => Promise<void> }).lock('landscape') } catch { /* Keep playing if orientation lock is unavailable. */ }
      }
    } catch { setError(true) }
  }
  return <button className="mobile-fullscreen" onClick={() => void toggle()} title={error ? '浏览器不支持全屏，请从主画面打开已安装的港雀' : undefined}>{error ? '請安裝應用' : full ? '退出全屏' : '全屏'}</button>
}
