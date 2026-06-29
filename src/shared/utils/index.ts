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

export function fmt(v: number | string, currency?: string): string {
  const num = parseFloat(String(v)) || 0
  return (currency || 'Rs') + ' ' + num.toLocaleString('en-IN', {
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

export function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  return [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === '\n' && !inQuotes) { lines.push(current); current = '' }
    else if (ch === '\r' && !inQuotes) { /* skip CR */ }
    else current += ch
  }
  if (current) lines.push(current)

  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let f = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (q && line[i + 1] === '"') { f += '"'; i++ }
        else q = !q
      } else if (ch === ',' && !q) { fields.push(f.trim()); f = '' }
      else f += ch
    }
    fields.push(f.trim())
    return fields
  }

  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).filter(l => l.trim()).map(parseLine)
  return { headers, rows }
}

export function pickFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) { resolve(null); return }
      const text = await file.text()
      resolve({ name: file.name, text })
    }
    input.click()
  })
}
