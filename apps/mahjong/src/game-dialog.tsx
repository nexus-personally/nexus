import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'

type DialogTone = 'default' | 'danger'
type DialogOptions = {
  eyebrow?: string
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: DialogTone
}

type PendingDialog = DialogOptions & { resolve: (value: boolean) => void }
type ConfirmDialog = (options: DialogOptions) => Promise<boolean>
const DialogContext = createContext<ConfirmDialog | null>(null)

export function GameDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<PendingDialog | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const confirm = useCallback<ConfirmDialog>(options => new Promise(resolve => {
    setDialog(current => {
      current?.resolve(false)
      return { confirmLabel: '确认', cancelLabel: '返回', tone: 'default', eyebrow: '港雀 · 牌桌提示', ...options, resolve }
    })
  }), [])
  const close = useCallback((value: boolean) => {
    setDialog(current => {
      current?.resolve(value)
      return null
    })
  }, [])

  useEffect(() => {
    if (!dialog) return
    confirmRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialog, close])

  return <DialogContext.Provider value={confirm}>{children}{dialog && <div className="game-dialog-shade" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(false) }}>
    <section className={`game-dialog game-dialog-${dialog.tone}`} role="alertdialog" aria-modal="true" aria-labelledby="game-dialog-title" aria-describedby="game-dialog-message">
      <button className="game-dialog-close" onClick={() => close(false)} aria-label="关闭弹窗"><X weight="bold" aria-hidden="true" /></button>
      <div className="game-dialog-emblem" aria-hidden="true">東</div>
      <small>{dialog.eyebrow}</small>
      <h2 id="game-dialog-title">{dialog.title}</h2>
      <p id="game-dialog-message">{dialog.message}</p>
      <div className="game-dialog-divider" aria-hidden="true" />
      <div className="game-dialog-actions">
        <button className="game-dialog-cancel" onClick={() => close(false)}>{dialog.cancelLabel}</button>
        <button ref={confirmRef} className="game-dialog-confirm" onClick={() => close(true)}>{dialog.confirmLabel}</button>
      </div>
    </section>
  </div>}</DialogContext.Provider>
}

export function useGameDialog(): ConfirmDialog {
  const confirm = useContext(DialogContext)
  if (!confirm) throw Error('useGameDialog must be used within GameDialogProvider')
  return confirm
}
