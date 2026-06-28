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
