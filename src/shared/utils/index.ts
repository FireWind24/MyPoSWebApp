export function n2(v: number | string): string {
  return (parseFloat(String(v)) || 0).toFixed(2)
}

export function n0(v: number | string | undefined | null): number {
  return parseFloat(String(v ?? 0)) || 0
}

export function toMs(v: number | string | Date): number {
  if (typeof v === 'number') return v
  return new Date(v).getTime()
}

export function fmt(v: number | string): string {
  const num = parseFloat(String(v)) || 0
  return 'Rs ' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function dlBlob(content: string, type: string, name: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-PK', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)} ${formatTime(ts)}`
}
