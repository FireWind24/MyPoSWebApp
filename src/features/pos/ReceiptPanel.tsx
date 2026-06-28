import { useCartStore } from '@stores/cartStore'
import { useUIStore } from '@stores/uiStore'
import { useSyncStore } from '@stores/syncStore'
import { fmt } from '@shared/utils'
import { printReceipt, generateTestReceipt } from '@services/printer'

function generateReceiptLines(items: import('@shared/types').CartItem[], total: number, notes: string): string[] {
  const lines: string[] = []
  const now = new Date()
  lines.push('==========================')
  lines.push('      SALE RECEIPT')
  lines.push('==========================')
  lines.push('')
  lines.push('Date: ' + now.toLocaleString())
  lines.push('----------------------------')
  lines.push('Item          Qty    Price')
  lines.push('----------------------------')
  for (const item of items) {
    const name = item.name.length > 14 ? item.name.slice(0, 14) : item.name.padEnd(14)
    lines.push(`${name} ${String(item.qty).padStart(3)} ${item.total.toFixed(2).padStart(8)}`)
  }
  lines.push('----------------------------')
  lines.push(`TOTAL:${total.toFixed(2).padStart(25)}`)
  lines.push('')
  if (notes) lines.push(`Note: ${notes}`)
  lines.push('==========================')
  lines.push('   Thank you!')
  lines.push('==========================')
  return lines
}

export function ReceiptPanel() {
  const items = useCartStore(s => s.items)
  const updateQty = useCartStore(s => s.updateQty)
  const removeItem = useCartStore(s => s.removeItem)
  const notes = useCartStore(s => s.notes)
  const setNotes = useCartStore(s => s.setNotes)
  const clearCart = useCartStore(s => s.clearCart)
  const holdSale = useSyncStore(s => s.holdSale)
  const heldSales = useSyncStore(s => s.heldSales)
  const recallSale = useSyncStore(s => s.recallSale)
  const clearHeldSale = useSyncStore(s => s.clearHeldSale)
  const showToast = useUIStore(s => s.showToast)

  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const total = subtotal

  const handlePrint = async () => {
    if (items.length === 0) return
    const lines = generateReceiptLines(items, total, notes)
    const ok = await printReceipt(lines)
    showToast(ok ? 'Receipt printed' : 'Receipt queued (no printer connected)', ok ? 'ok' : 'inf')
  }

  const handlePrintTest = async () => {
    const lines = generateTestReceipt()
    const ok = await printReceipt(lines)
    showToast(ok ? 'Test receipt printed' : 'Test receipt queued', ok ? 'ok' : 'inf')
  }

  return (
    <div className="rec-panel">
      <div className="rec-header">
        <span>Cart ({items.length})</span>
        <div className="rec-actions">
          {items.length > 0 && (
            <button className="qty-btn" onClick={() => { holdSale(items); clearCart(); showToast('Sale held', 'inf') }} title="Hold sale (Ctrl+H)">⏸</button>
          )}
          <button className="qty-btn" onClick={clearCart} title="New sale (F2)">↺</button>
        </div>
      </div>

      {heldSales.length > 0 && (
        <div className="held-sales-bar">
          <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--t3)', letterSpacing: 1 }}>HELD ({heldSales.length})</span>
          {heldSales.map((sale, i) => (
            <button key={i} className="held-sale-btn" onClick={() => {
              const recalled = recallSale(i)
              if (recalled) {
                recalled.forEach(item => {
                  useCartStore.getState().addItem(
                    { id: '', name: item.name, barcode: '', dept: item.dept, price: item.price, stock: 0 },
                    item.qty
                  )
                })
                clearHeldSale(i)
                showToast('Sale recalled', 'ok')
              }
            }}>
              #{i + 1} ({sale.length} items)
            </button>
          ))}
        </div>
      )}

      <div className="rec-items">
        {items.length === 0 && <div className="empty">Cart is empty<br />Add items from the grid</div>}
        {items.map((item, i) => (
          <div key={i} className="rec-item">
            <div className="qty-controls">
              <button className="qty-btn" onClick={() => updateQty(i, item.qty - 1)}>−</button>
              <span className="qty-val">{item.qty}</span>
              <button className="qty-btn" onClick={() => updateQty(i, item.qty + 1)}>+</button>
              <button className="qty-btn del" onClick={() => removeItem(i)}>✕</button>
            </div>
            <div className="name">{item.name}</div>
            <span className="price">{fmt(item.total)}</span>
          </div>
        ))}
      </div>

      <div className="rec-notes">
        <input type="text" placeholder="Cart note…" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div className="rec-totals">
        <div className="row">
          <span>Subtotal</span>
          <span className="val">{fmt(subtotal)}</span>
        </div>
        <div className="row total">
          <span>Total</span>
          <span className="val">{fmt(total)}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button className="btn btn-ghost btn-xs" onClick={handlePrint} disabled={items.length === 0} title="Ctrl+P" style={{ flex: 1 }}>
            🖨 Print
          </button>
          <button className="btn btn-ghost btn-xs" onClick={handlePrintTest} title="Test print">
            Test
          </button>
        </div>
      </div>
    </div>
  )
}
