import { useEffect, useRef } from 'react'
import { useUIStore } from '@stores/uiStore'
import { Button } from './Button'

export function ConfirmDialog() {
  const { confirm, hideConfirm } = useUIStore()
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirm) {
      okRef.current?.focus()
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') hideConfirm()
        if (e.key === 'Enter') {
          confirm.onOk()
          hideConfirm()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }
  }, [confirm, hideConfirm])

  if (!confirm) return null

  return (
    <div className="confirm-overlay" onClick={hideConfirm}>
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <p>{confirm.msg}</p>
        <div className="actions">
          <Button variant="ghost" onClick={hideConfirm}>Cancel</Button>
          <Button
            variant="danger"
            ref={okRef}
            onClick={() => {
              confirm.onOk()
              hideConfirm()
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  )
}
