import { useEffect, useState, useCallback } from 'react'

interface ToastItem {
  id: number
  msg: string
  type: 'ok' | 'err' | 'inf'
}

let toastId = 0
const listeners: Set<(t: ToastItem) => void> = new Set()

export function toast(msg: string, type: 'ok' | 'err' | 'inf' = 'inf') {
  const t: ToastItem = { id: ++toastId, msg, type }
  listeners.forEach(fn => fn(t))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((t: ToastItem) => {
    setToasts(prev => [...prev, t])
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== t.id))
    }, 2700)
  }, [])

  useEffect(() => {
    listeners.add(addToast)
    return () => { listeners.delete(addToast) }
  }, [addToast])

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col-reverse gap-[7px] z-[9999] pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-[18px] py-[9px] rounded-lg text-xs font-bold tracking-[.3px] whitespace-nowrap shadow-lg animate-[tIn_.2s_ease] ${
            t.type === 'ok' ? 'bg-[rgba(0,214,143,.1)] border border-(--g2) text-(--g)' :
            t.type === 'err' ? 'bg-[rgba(240,82,82,.1)] border border-(--r) text-(--r)' :
            'bg-[rgba(77,158,255,.1)] border border-(--b2) text-(--b)'
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}
