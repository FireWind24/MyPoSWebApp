import { useState } from 'react'
import { useCartStore } from '@stores/cartStore'
import { useUIStore } from '@stores/uiStore'
import { useSyncStore } from '@stores/syncStore'
import { fmt } from '@shared/utils'

export function CartPanel() {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editQty, setEditQty] = useState(0)
  const [editPrice, setEditPrice] = useState(0)

  const items = useCartStore(s => s.items)
  const updateQty = useCartStore(s => s.updateQty)
  const updatePrice = useCartStore(s => s.updatePrice)
  const removeItem = useCartStore(s => s.removeItem)
  const discount = useCartStore(s => s.discount)
  const discPct = useCartStore(s => s.discPct)
  const setDiscount = useCartStore(s => s.setDiscount)
  const setDiscPct = useCartStore(s => s.setDiscPct)
  const notes = useCartStore(s => s.notes)
  const setNotes = useCartStore(s => s.setNotes)
  const clearCart = useCartStore(s => s.clearCart)
  const setShowCheckout = useUIStore(s => s.setShowCheckout)
  const holdSale = useSyncStore(s => s.holdSale)
  const heldSales = useSyncStore(s => s.heldSales)
  const recallSale = useSyncStore(s => s.recallSale)
  const clearHeldSale = useSyncStore(s => s.clearHeldSale)
  const showToast = useUIStore(s => s.showToast)

  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const discAmt = discPct > 0 ? subtotal * (discPct / 100) : discount
  const total = subtotal - discAmt

  const startEdit = (i: number) => {
    setEditIdx(i)
    setEditQty(items[i].qty)
    setEditPrice(items[i].price)
  }

  const saveEdit = () => {
    if (editIdx === null) return
    if (editQty > 0) updateQty(editIdx, editQty)
    if (editPrice >= 0) updatePrice(editIdx, editPrice)
    setEditIdx(null)
  }

  return (
    <div className="cart-panel">
      <div className="cart-header">
        <span>Cart ({items.length})</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {items.length > 0 && (
            <button className="qty-btn" onClick={() => { holdSale(items); clearCart(); showToast('Sale held', 'inf') }} title="Hold sale (Ctrl+H)">
              ⏸
            </button>
          )}
          <button className="qty-btn" onClick={clearCart} title="New sale (F2)">↺</button>
        </div>
      </div>

      {heldSales.length > 0 && (
        <div className="held-sales-bar">
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: 1 }}>HELD ({heldSales.length})</span>
          {heldSales.map((sale, i) => (
            <button key={i} className="held-sale-btn" onClick={() => {
              const recalled = recallSale(i)
              if (recalled) {
                // Restore items
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

      <div className="cart-items">
        {items.length === 0 && <div className="empty">Cart is empty<br />Search or click items to add</div>}
        {items.map((item, i) => (
          <div key={i}>
            {editIdx === i ? (
              <div className="cart-item" style={{ flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <label style={{ fontSize: 11, color: 'var(--t3)' }}>Qty:</label>
                  <input type="number" min="1" value={editQty} onChange={e => setEditQty(parseInt(e.target.value) || 1)}
                    style={{ width: 58, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 4, padding: '5px 7px', color: 'var(--t)', fontFamily: 'var(--mono)', fontSize: 13 }} />
                  <label style={{ fontSize: 11, color: 'var(--t3)' }}>Price:</label>
                  <input type="number" min="0" step="0.01" value={editPrice} onChange={e => setEditPrice(parseFloat(e.target.value) || 0)}
                    style={{ width: 82, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 4, padding: '5px 7px', color: 'var(--t)', fontFamily: 'var(--mono)', fontSize: 13 }} />
                  <button className="qty-btn" onClick={saveEdit}>✓</button>
                  <button className="qty-btn del" onClick={() => setEditIdx(null)}>✕</button>
                </div>
              </div>
            ) : (
              <div className="cart-item" onClick={() => startEdit(i)} style={{ cursor: 'pointer' }}>
                <div className="qty-controls">
                  <button className="qty-btn" onClick={e => { e.stopPropagation(); updateQty(i, item.qty - 1) }}>−</button>
                  <span className="qty-val">{item.qty}</span>
                  <button className="qty-btn" onClick={e => { e.stopPropagation(); updateQty(i, item.qty + 1) }}>+</button>
                  <button className="qty-btn del" onClick={e => { e.stopPropagation(); removeItem(i) }}>✕</button>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="name">{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{item.dept}</div>
                </div>
                <span className="price">{fmt(item.total)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="cart-totals">
        <div className="row">
          <span>Subtotal</span>
          <span className="val">{fmt(subtotal)}</span>
        </div>
        <div className="disc-input">
          <input type="number" placeholder="Disc Rs" value={discount || ''}
            onChange={e => { setDiscount(parseFloat(e.target.value) || 0); setDiscPct(0) }} />
          <input type="number" placeholder="Disc %" value={discPct || ''}
            onChange={e => { setDiscPct(parseFloat(e.target.value) || 0); setDiscount(0) }} />
        </div>
        {discAmt > 0 && (
          <div className="row">
            <span>Discount</span>
            <span className="val" style={{ color: 'var(--r)' }}>-{fmt(discAmt)}</span>
          </div>
        )}
        <div className="row">
          <span>Notes</span>
          <input type="text" placeholder="Optional cart note…" value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 4, padding: '5px 7px', color: 'var(--t)', fontSize: 12, fontFamily: 'var(--mono)' }} />
        </div>
        <div className="row total">
          <span>Total</span>
          <span className="val">{fmt(total)}</span>
        </div>
        <button className="checkout-btn" disabled={items.length === 0} onClick={() => setShowCheckout(true)}>
          Checkout • {fmt(total)}
        </button>
      </div>
    </div>
  )
}
