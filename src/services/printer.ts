export type PrinterConnection = 'webusb' | 'serial' | 'none'

export interface PrinterConfig {
  enabled: boolean
  connectionType: PrinterConnection
  paperWidth: '58mm' | '80mm'
  autoPrint: boolean
  footerText: string
  logoUrl: string
}

interface PrintJob {
  id: string
  lines: string[]
  status: 'queued' | 'printing' | 'done' | 'failed'
  retries: number
}

const DEFAULT_CONFIG: PrinterConfig = {
  enabled: false,
  connectionType: 'none',
  paperWidth: '80mm',
  autoPrint: false,
  footerText: '',
  logoUrl: '',
}

let printerConfig: PrinterConfig = { ...DEFAULT_CONFIG }
let printQueue: PrintJob[] = []
let usbDevice: USBDevice | null = null

export function getPrinterConfig(): PrinterConfig {
  return { ...printerConfig }
}

export function setPrinterConfig(config: Partial<PrinterConfig>) {
  printerConfig = { ...printerConfig, ...config }
  localStorage.setItem('pos_printer_config', JSON.stringify(printerConfig))
}

export function loadPrinterConfig() {
  try {
    const saved = localStorage.getItem('pos_printer_config')
    if (saved) printerConfig = { ...DEFAULT_CONFIG, ...JSON.parse(saved) }
  } catch { }
}

function escposText(text: string): Uint8Array {
  const lines = text.split('\n').map(l => l + '\n')
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []

  // Initialize printer
  parts.push(new Uint8Array([0x1B, 0x40])) // ESC @
  // Center align
  parts.push(new Uint8Array([0x1B, 0x61, 0x01])) // ESC a 1

  for (const line of lines) {
    parts.push(encoder.encode(line))
  }

  // Cut paper
  parts.push(new Uint8Array([0x1D, 0x56, 0x00])) // GS V 0

  const totalLen = parts.reduce((s, p) => s + p.length, 0)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const p of parts) {
    result.set(p, offset)
    offset += p.length
  }
  return result
}

export async function connectPrinter(): Promise<boolean> {
  try {
    if (!navigator.usb) {
      console.warn('WebUSB not available')
      return false
    }
    const device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: 0x04b8 }, // Epson
        { vendorId: 0x0519 }, // Star
        { vendorId: 0x1504 }, // Bixolon
      ],
    })
    usbDevice = device
    await device.open()
    await device.selectConfiguration(1)
    await device.claimInterface(0)
    setPrinterConfig({ connectionType: 'webusb', enabled: true })
    return true
  } catch (err) {
    console.error('Printer connection failed:', err)
    return false
  }
}

export async function disconnectPrinter() {
  if (usbDevice) {
    try { await usbDevice.close() } catch { }
    usbDevice = null
  }
  setPrinterConfig({ connectionType: 'none', enabled: false })
}

export async function printReceipt(lines: string[]): Promise<boolean> {
  const config = getPrinterConfig()
  if (!config.enabled || !usbDevice) {
    // Queue for later
    const job: PrintJob = {
      id: `print_${Date.now()}`,
      lines,
      status: 'queued',
      retries: 0,
    }
    printQueue.push(job)
    return false
  }

  try {
    const data = escposText(lines.join('\n'))
    await usbDevice.transferOut(1, data.buffer as ArrayBuffer)
    return true
  } catch (err) {
    console.error('Print failed:', err)
    const job: PrintJob = {
      id: `print_${Date.now()}`,
      lines,
      status: 'queued',
      retries: 0,
    }
    printQueue.push(job)
    return false
  }
}

export function processPrintQueue() {
  if (printQueue.length === 0 || !usbDevice) return
  const job = printQueue[0]
  job.status = 'printing'
  printReceipt(job.lines).then(success => {
    if (success) {
      printQueue.shift()
      processPrintQueue()
    } else {
      job.retries++
      if (job.retries >= 3) {
        printQueue.shift()
      }
    }
  })
}

function receiptHtml(lines: string[], title: string): string {
  const body = lines.map(l => escapeHtml(l)).join('\n')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:'Courier New',monospace;font-size:13px;padding:20px;margin:0;line-height:1.4;white-space:pre}
  @media print{@page{margin:0}}
  @media screen{body{max-width:80mm;margin:auto}}
</style></head><body>${body}</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export function printViaBrowser(lines: string[], title: string = 'Receipt') {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-9999px;left:0;width:80mm;height:0;border:none'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) return
  doc.open()
  doc.write(receiptHtml(lines, title))
  doc.close()
  iframe.contentWindow?.focus()
  setTimeout(() => {
    iframe.contentWindow?.print()
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe) }, 2000)
  }, 100)
}

export interface ReceiptStoreInfo {
  name: string
  address?: string
  phone?: string
  receipt_footer?: string
}

export function generateSaleReceipt(
  items: { name: string; qty: number; total: number; dept?: string }[],
  total: number,
  opts?: { notes?: string; customerName?: string; store?: ReceiptStoreInfo }
): string[] {
  const lines: string[] = []
  const s = opts?.store
  lines.push('================================')
  lines.push(`      ${(s?.name || 'SALE RECEIPT').toUpperCase()}`)
  if (s?.address) lines.push(`  ${s.address}`)
  if (s?.phone) lines.push(`  Tel: ${s.phone}`)
  lines.push('================================')
  lines.push('')
  lines.push('Date: ' + new Date().toLocaleString())
  if (opts?.customerName) lines.push('Customer: ' + opts.customerName)
  lines.push('--------------------------------')
  lines.push('Item                 Qty   Amount')
  lines.push('--------------------------------')
  for (const item of items) {
    const name = item.name.length > 18 ? item.name.slice(0, 18) : item.name.padEnd(18)
    const deptTag = item.dept && item.dept !== item.name ? `[${item.dept}]` : ''
    lines.push(`${name} ${String(item.qty).padStart(3)} ${item.total.toFixed(2).padStart(8)}`)
    if (deptTag) lines.push(`  ${deptTag}`)
  }
  lines.push('--------------------------------')
  lines.push(`TOTAL:${total.toFixed(2).padStart(30)}`)
  if (opts?.notes) lines.push(`Note: ${opts.notes}`)
  lines.push('')
  lines.push('================================')
  if (s?.receipt_footer) {
    lines.push(`  ${s.receipt_footer}`)
    lines.push('')
  }
  lines.push('        Thank you!')
  lines.push('================================')
  return lines
}

export function generateDailyReportReceipt(report: {
  date: string
  revenue: number
  transactions: number
  cashTotal: number
  cardTotal: number
  splitTotal: number
  avgTransaction: number
  topProducts: { name: string; qty: number; revenue: number }[]
  storeName?: string
}): string[] {
  const lines: string[] = []
  const s = (n: number) => n.toFixed(2)
  lines.push('================================')
  lines.push(`  ${(report.storeName || 'DAILY REPORT').toUpperCase()}`)
  lines.push('================================')
  lines.push('')
  lines.push(`Date: ${report.date}`)
  lines.push('--------------------------------')
  lines.push('  SALES SUMMARY')
  lines.push('--------------------------------')
  lines.push(`Revenue:            ${s(report.revenue).padStart(10)}`)
  lines.push(`Transactions:       ${String(report.transactions).padStart(10)}`)
  lines.push(`Avg Transaction:    ${s(report.avgTransaction).padStart(10)}`)
  lines.push('')
  lines.push('--------------------------------')
  lines.push('  PAYMENT BREAKDOWN')
  lines.push('--------------------------------')
  lines.push(`Cash:               ${s(report.cashTotal).padStart(10)}`)
  lines.push(`Card:               ${s(report.cardTotal).padStart(10)}`)
  lines.push(`Split:              ${s(report.splitTotal).padStart(10)}`)
  lines.push('')
  lines.push('--------------------------------')
  lines.push('  TOP PRODUCTS')
  lines.push('--------------------------------')
  lines.push('Product          Qty   Amount')
  lines.push('--------------------------------')
  for (const p of report.topProducts) {
    const name = p.name.length > 16 ? p.name.slice(0, 16) : p.name.padEnd(16)
    lines.push(`${name} ${String(p.qty).padStart(3)} ${s(p.revenue).padStart(8)}`)
  }
  lines.push('')
  lines.push('================================')
  lines.push('      End of Day Report')
  lines.push('================================')
  return lines
}

export function generateTestReceipt(): string[] {
  const config = getPrinterConfig()
  const lines: string[] = []
  lines.push('==========================')
  lines.push('      TEST RECEIPT')
  lines.push('==========================')
  lines.push('')
  lines.push('Printer: ' + config.connectionType)
  lines.push('Width: ' + config.paperWidth)
  lines.push('Date: ' + new Date().toLocaleString())
  lines.push('')
  lines.push('Item          Qty   Price')
  lines.push('--------------------------')
  lines.push('Test Product    1   10.00')
  lines.push('')
  lines.push('--------------------------')
  lines.push('TOTAL:             10.00')
  lines.push('')
  lines.push('==========================')
  lines.push('   PRINT TEST SUCCESSFUL')
  lines.push('==========================')
  return lines
}

export function getPrintQueue(): PrintJob[] {
  return [...printQueue]
}
