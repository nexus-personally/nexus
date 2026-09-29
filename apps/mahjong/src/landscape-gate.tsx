import { useEffect, useState } from 'react'

const portrait = () => window.matchMedia('(orientation: portrait) and (pointer: coarse)').matches

async function lockLandscape(fromButton: boolean) {
  if (!portrait()) return
  if (fromButton && document.fullscreenEnabled && !document.fullscreenElement) {
    try { await document.documentElement.requestFullscreen() } catch { /* Continue with orientation lock. */ }
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: 'landscape') => Promise<void> }
    await orientation?.lock?.('landscape')
  } catch { /* iOS Safari and some browsers require a manual device rotation. */ }
}

export function LandscapeGate() {
  const [isPortrait, setIsPortrait] = useState(portrait)
  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait) and (pointer: coarse)')
    const update = () => setIsPortrait(media.matches)
    media.addEventListener('change', update)
    void lockLandscape(false)
    return () => media.removeEventListener('change', update)
  }, [])
  if (!isPortrait) return null
  return <div className="landscape-gate" role="dialog" aria-modal="true" aria-label="请将手机横放">
    <div className="landscape-gate-card"><span aria-hidden="true">▭ ↻</span><h2>請將手機橫放</h2>
      <p>港雀只在橫屏顯示牌桌。請解除手機的方向鎖，然後橫放手機。</p>
      <button onClick={() => void lockLandscape(true)}>嘗試開啟橫屏</button>
      <small>若沒有自動旋轉，請手動轉動手機。從主畫面開啟已安裝的港雀，效果會更穩定。</small>
    </div>
  </div>
}
