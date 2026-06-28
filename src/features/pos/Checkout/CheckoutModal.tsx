import { useState, useEffect, useMemo, useRef } from 'react'
import { useUIStore } from '@stores/uiStore'
import { useCartStore } from '@stores/cartStore'
import { db } from '@db/schema'
import { generateId } from '@shared/utils'
import { printViaBrowser } from '@services/printer'
import { Modal } from '@shared/ui/Modal'
import { Button } from '@shared/ui/Button'

const QUICK_AMOUNTS = [500, 1000, 2000, 5000]

export function CheckoutModal() {
  const showCheckout = useUIStore(s => s.showCheckout)
  const setShowCheckout = useUIStore(s => s.setShowCheckout)
  const showToast = useUIStore(s => s.showToast)

  const items = useCartStore(s => s.items)
  const discount = useCartStore(s => s.discount)
  const discPct = useCartStore(s => s.discPct)
  const taxPct = useCartStore(s => s.taxPct)
  const paymentMethod = useCartStore(s => s.paymentMethod)
  const cash = useCartStore(s => s.cash)
  const cardAmount = useCartStore(s => s.cardAmount)
  const customerName = useCartStore(s => s.customerName)
  const clearCart = useCartStore(s => s.clearCart)
  const setPaymentMethod = useCartStore(s => s.setPaymentMethod)
  const setCash = useCartStore(s => s.setCash)
  const setCardAmount = useCartStore(s => s.setCardAmount)
  const setCustomerName = useCartStore(s => s.setCustomerName)

  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; phone: string }>>([])
  const [processing, setProcessing] = useState(false)
  const [showPrintPrompt, setShowPrintPrompt] = useState(false)
  const cashRef = useRef<HTMLInputElement>(null)
  const printBtnRef = useRef<HTMLButtonElement>(null)

  // Focus cash input when modal opens
  useEffect(() => {
    if (showCheckout) {
      setTimeout(() => cashRef.current?.focus(), 150)
    }
  }, [showCheckout])

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.total, 0), [items])
  const discAmt = useMemo(() => {
    if (!items.length) return 0
    return discPct > 0 ? subtotal * (discPct / 100) : discount
  }, [items, discount, discPct, subtotal])
  const taxAmount = useMemo(() => (subtotal - discAmt) * (taxPct / 100), [subtotal, discAmt, taxPct])
  const total = useMemo(() => subtotal - discAmt + taxAmount, [subtotal, discAmt, taxAmount])

  useEffect(() => {
    if (customerSearch.trim()) {
      db.customers
        .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
        .toArray()
        .then(setCustomers)
    } else {
      setCustomers([])
    }
  }, [customerSearch])

  const generateReceiptLines = (now: number): string[] => {
    const lines: string[] = []
    const nowStr = new Date(now).toLocaleString()
    lines.push('==========================')
    lines.push('      SALE RECEIPT')
    lines.push('==========================')
    lines.push('')
    lines.push('Date: ' + nowStr)
    lines.push('----------------------------')
    lines.push('Item          Qty    Price')
    lines.push('----------------------------')
    for (const item of items) {
      const name = item.name.length > 14 ? item.name.slice(0, 14) : item.name.padEnd(14)
      lines.push(`${name} ${String(item.qty).padStart(3)} ${item.total.toFixed(2).padStart(8)}`)
    }
    lines.push('----------------------------')
    lines.push(`TOTAL:${total.toFixed(2).padStart(25)}`)
    if (customerName) lines.push(`Customer: ${customerName}`)
    lines.push('')
    lines.push('==========================')
    lines.push('   Thank you!')
    lines.push('==========================')
    return lines
  }

  const finishSale = () => {
    clearCart()
    setCash(0)
    setCardAmount(0)
    setCustomerName('')
    setCustomerSearch('')
    setShowCheckout(false)
    setShowPrintPrompt(false)
    showToast('Sale completed!', 'ok')
  }

  const handlePrintAndFinish = () => {
    const lines = generateReceiptLines(Date.now())
    printViaBrowser(lines, 'Sale Receipt')
    finishSale()
  }

  const handleCheckout = async () => {
    if (processing) return
    setProcessing(true)
    try {
      const now = Date.now()
      const invoiceId = generateId()

      // Update stock
      for (const item of items) {
        const product = await db.products.where('name').equals(item.name).first()
        if (product) {
          const newStock = Math.max(0, product.stock - item.qty)
          await db.products.update(product.id, { stock: newStock })
          if (newStock !== product.stock) {
            await db.stockMovements.add({
              id: generateId(),
              product_id: product.id,
              delta: -item.qty,
              reason: 'sale',
              invoice_id: invoiceId,
              created_at: now,
              notes: '',
            })
          }
        }
      }

      // Create invoice
      await db.invoices.add({
        id: invoiceId,
        store_id: '',
        cashier_id: '',
        date: now,
        dateStr: new Date(now).toISOString().slice(0, 10),
        items: [...items],
        subtotal,
        discount: discAmt,
        discPct,
        tax: taxAmount,
        taxPct,
        taxAmount,
        total,
        payment_method: paymentMethod,
        cash: paymentMethod === 'cash' ? cash : paymentMethod === 'card' ? 0 : cash,
        cardAmount: paymentMethod === 'card' ? total : paymentMethod === 'split' ? cardAmount : 0,
        change: paymentMethod === 'cash' ? cash - total : 0,
        customer_id: '',
        customerName: customerName,
        status: 'completed',
      })

      setShowPrintPrompt(true)
      setTimeout(() => printBtnRef.current?.focus(), 100)
    } catch {
      showToast('Checkout failed', 'err')
    } finally {
      setProcessing(false)
    }
  }

  if (!showCheckout) return null

  return (
    <Modal open={showCheckout} onClose={() => { if (!showPrintPrompt) setShowCheckout(false) }} title={showPrintPrompt ? 'Sale Complete' : 'Checkout'}>
      {showPrintPrompt ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--g)', marginBottom: 8 }}>✓ Sale Complete</div>
          <div style={{ color: 'var(--t2)', marginBottom: 24, fontSize: 14 }}>Print receipt for this sale?</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button variant="primary" ref={printBtnRef} onClick={handlePrintAndFinish}>
              🖨 Print Receipt
            </Button>
            <Button variant="ghost" onClick={finishSale}>
              Skip
            </Button>
          </div>
        </div>
      ) : (
        <div onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleCheckout()
          }
        }}>
          <div className="checkout-tabs">
            {(['cash', 'card', 'split'] as const).map(m => (
              <div
                key={m}
                className={`checkout-tab ${paymentMethod === m ? 'active' : ''}`}
                onClick={() => setPaymentMethod(m)}
              >
                {m === 'cash' ? 'Cash' : m === 'card' ? 'Card' : 'Split'}
              </div>
            ))}
          </div>

          <div className="checkout-summary">
            <div className="row"><span>Subtotal</span><span className="val">{subtotal.toFixed(2)}</span></div>
            {discAmt > 0 && <div className="row"><span>Discount</span><span className="val" style={{ color: 'var(--r)' }}>-{discAmt.toFixed(2)}</span></div>}
            {taxAmount > 0 && <div className="row"><span>Tax ({taxPct}%)</span><span className="val">{taxAmount.toFixed(2)}</span></div>}
            <div className="row total"><span>Total</span><span className="val">{total.toFixed(2)}</span></div>
          </div>

          <div className="customer-row">
            <input
              placeholder="Customer name..."
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>

          <div className="customer-row customer-select">
            <input
              placeholder="Search customers..."
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
            />
            {customers.length > 0 && (
              <div className="customer-dropdown">
                {customers.map(c => (
                  <div
                    key={c.id}
                    className="item"
                    onClick={() => { setCustomerName(c.name); setCustomerSearch(''); setCustomers([]) }}
                  >
                    {c.name} {c.phone && `(${c.phone})`}
                  </div>
                ))}
              </div>
            )}
          </div>

          {paymentMethod !== 'card' && (
            <div className="cash-input-group">
              <label>Cash Amount</label>
              <input
                ref={cashRef}
                type="number"
                placeholder="0"
                value={cash || ''}
                onChange={e => setCash(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}

          {paymentMethod !== 'card' && (
            <div className="quick-amounts">
              {QUICK_AMOUNTS.map(a => (
                <button key={a} className="quick-amount" onClick={() => setCash(a)}>
                  {a.toLocaleString()}
                </button>
              ))}
              <button className="quick-amount" onClick={() => setCash(Math.ceil(total / 100) * 100)}>
                Round Up
              </button>
              <button className="quick-amount" onClick={() => setCash(total)}>
                Exact
              </button>
            </div>
          )}

          {paymentMethod === 'split' && (
            <div className="cash-input-group">
              <label>Card Amount</label>
              <input
                type="number"
                placeholder="0"
                value={cardAmount || ''}
                onChange={e => setCardAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}

          {paymentMethod === 'cash' && cash > 0 && (
            <div className="change-display">
              <div className="label">Change</div>
              <div className={`amount ${cash < total ? 'negative' : ''}`}>
                {cash >= total ? (cash - total).toFixed(2) : (total - cash).toFixed(2)}
                {cash < total && ' due'}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCheckout(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleCheckout}
              disabled={processing || items.length === 0 || (paymentMethod === 'cash' && cash < total)}
            >
              {processing ? 'Processing...' : `Complete Sale • ${total.toFixed(2)}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
