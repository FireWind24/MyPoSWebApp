import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { db } from '@db/schema'
import { useCartStore } from '@stores/cartStore'
import { useUIStore } from '@stores/uiStore'

let rowIdCounter = 0
function newRowId() { return `r_${++rowIdCounter}` }

export interface GridRow {
  id: string
  productName: string
  code: string
  balance: number
  rate: number
  qty: number
  disc: number
  netValue: number
  dept: string
  productId: string
}

function blankRow(): GridRow {
  return { id: newRowId(), productName: '', code: '', balance: 0, rate: 0, qty: 1, disc: 0, netValue: 0, dept: '', productId: '' }
}

function createBlankRows(n: number): GridRow[] {
  return Array.from({ length: n }, () => blankRow())
}

const INITIAL_ROWS = 6
const APPEND_THRESHOLD = 2

interface ProductInfo {
  id: string; name: string; barcode: string; dept: string; price: number; stock: number
}

interface AutocompleteState {
  field: 'name' | 'code'
  rowIndex: number
  query: string
  results: ProductInfo[]
  selectedIndex: number
  position: { top: number; left: number; width: number }
}

export function InvoiceGrid() {
  const [rows, setRows] = useState<GridRow[]>(() => createBlankRows(INITIAL_ROWS))
  const [focusedRow, setFocusedRow] = useState<number | null>(null)
  const [ac, setAc] = useState<AutocompleteState | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number } | null>(null)
  const [billDisc, setBillDisc] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [allProducts, setAllProducts] = useState<ProductInfo[]>([])
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const cartItems = useCartStore(s => s.items)
  const clearCartStore = useCartStore(s => s.clearCart)
  const setShowCheckout = useUIStore(s => s.setShowCheckout)
  const showToast = useUIStore(s => s.showToast)

  // Watch for external cart clear (F2 from App.tsx), then focus first field
  const prevLen = useRef(cartItems.length)
  useEffect(() => {
    if (prevLen.current > 0 && cartItems.length === 0 && filledRows.length > 0) {
      setRows(createBlankRows(INITIAL_ROWS))
      setBillDisc(0)
      setCustomerName('')
      setAc(null)
      setTimeout(focusFirstEmpty, 100)
    }
    prevLen.current = cartItems.length
  }, [cartItems.length]) // eslint-disable-line

  useEffect(() => {
    const load = async () => {
      try {
        const all = await db.products.toArray()
        setAllProducts(all.filter(p => p.price > 0).map(p => ({ id: p.id, name: p.name, barcode: p.barcode || '', dept: p.dept, price: p.price, stock: p.stock })))
      } catch { }
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const filledRows = useMemo(() => rows.filter(r => r.productName.trim() !== ''), [rows])

  const computeNetValue = useCallback((rate: number, qty: number, disc: number) => {
    return rate * qty * (1 - disc / 100)
  }, [])

  const appendIfNeeded = useCallback((currentRows: GridRow[]): GridRow[] => {
    const emptyCount = currentRows.filter(r => r.productName.trim() === '').length
    if (emptyCount < APPEND_THRESHOLD) {
      return [...currentRows, ...createBlankRows(3)]
    }
    return currentRows
  }, [])

  const updateRow = useCallback((index: number, partial: Partial<GridRow>) => {
    setRows(prev => {
      const updated = [...prev]
      const row = { ...updated[index], ...partial }
      if (partial.rate !== undefined || partial.qty !== undefined || partial.disc !== undefined) {
        row.netValue = computeNetValue(
          partial.rate ?? row.rate,
          partial.qty ?? row.qty,
          partial.disc ?? row.disc
        )
      }
      updated[index] = row
      return appendIfNeeded(updated)
    })
  }, [computeNetValue, appendIfNeeded])

  const syncCart = useCallback((currentRows: GridRow[]) => {
    const filled = currentRows.filter(r => r.productName.trim() !== '' && r.rate > 0)
    useCartStore.setState({ items: filled.map(r => ({
      dept: r.dept,
      name: r.productName,
      price: r.rate,
      qty: r.qty,
      total: r.netValue,
    })) })
  }, [])

  useEffect(() => {
    syncCart(rows)
  }, [rows, syncCart])

  const focusInput = useCallback((row: number, col: string) => {
    setTimeout(() => inputRefs.current.get(`${col}_${row}`)?.focus(), 0)
  }, [])

  const getCellPosition = useCallback((rowIndex: number, col: string) => {
    const input = inputRefs.current.get(`${col}_${rowIndex}`)
    if (!input) return null
    const rect = input.getBoundingClientRect()
    return { top: rect.bottom, left: rect.left, width: rect.width }
  }, [])

  const handleNameChange = useCallback((index: number, value: string) => {
    updateRow(index, { productName: value })
    if (!value.trim()) { setAc(null); return }
    const pos = getCellPosition(index, 'name')
    if (!pos) return
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(value.toLowerCase()))
    setAc({ field: 'name', rowIndex: index, query: value, results: filtered.slice(0, 8), selectedIndex: 0, position: pos })
  }, [allProducts, updateRow, getCellPosition])

  const handleCodeChange = useCallback((index: number, value: string) => {
    updateRow(index, { code: value })
    if (!value.trim()) { setAc(null); return }
    const pos = getCellPosition(index, 'code')
    if (!pos) return
    const filtered = allProducts.filter(p => p.barcode && p.barcode.toLowerCase().includes(value.toLowerCase()))
    setAc({ field: 'code', rowIndex: index, query: value, results: filtered.slice(0, 8), selectedIndex: 0, position: pos })
  }, [allProducts, updateRow, getCellPosition])

  const fillRowFromProduct = useCallback((index: number, product: ProductInfo) => {
    updateRow(index, {
      productName: product.name,
      code: product.barcode || '',
      balance: product.stock,
      rate: product.price,
      dept: product.dept,
      productId: product.id,
    })
    setAc(null)
    focusInput(index, 'code')
  }, [updateRow, focusInput])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number, col: string) => {
    if (ac && ac.rowIndex === index) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAc(prev => prev ? { ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, prev.results.length - 1) } : null); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAc(prev => prev ? { ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) } : null); return }
      if ((e.key === 'Enter' || e.key === 'Tab') && ac.results[ac.selectedIndex]) { e.preventDefault(); fillRowFromProduct(index, ac.results[ac.selectedIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); setAc(null); return }
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const tabOrder = ['name', 'code', 'rate', 'qty', 'disc']
      const idx = tabOrder.indexOf(col)
      if (idx >= 0 && idx < tabOrder.length - 1) {
        focusInput(index, tabOrder[idx + 1])
      } else {
        focusInput(index + 1, 'name')
        setFocusedRow(index + 1)
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (col === 'name' && !ac) {
        const val = rows[index].productName.trim()
        if (val) {
          const exact = allProducts.find(p => p.name.toLowerCase() === val.toLowerCase())
          if (exact) { fillRowFromProduct(index, exact); return }
        }
      }
      focusInput(index + 1, 'name')
      setFocusedRow(index + 1)
      return
    }

    if (e.key === 'Delete' && col === 'sr' && rows[index].productName.trim()) {
      updateRow(index, blankRow())
      return
    }
  }, [ac, rows, allProducts, fillRowFromProduct, updateRow, focusInput])

  const focusFirstEmpty = useCallback(() => {
    const idx = rows.findIndex(r => r.productName.trim() === '')
    if (idx >= 0) { setFocusedRow(idx); focusInput(idx, 'name') }
  }, [rows, focusInput])

  const handleNewSale = useCallback(() => {
    setRows(createBlankRows(INITIAL_ROWS))
    setBillDisc(0)
    setCustomerName('')
    setAc(null)
    clearCartStore()
    showToast('New sale started', 'inf')
    setTimeout(focusFirstEmpty, 50)
  }, [clearCartStore, showToast, focusFirstEmpty])

  const handleCheckout = useCallback(() => {
    if (filledRows.length === 0) return
    setShowCheckout(true)
  }, [filledRows, setShowCheckout])

  const handleSrClick = useCallback((index: number) => {
    if (rows[index].productName.trim()) { updateRow(index, blankRow()) }
  }, [rows, updateRow])

  const handleContextMenu = useCallback((e: React.MouseEvent, index: number) => {
    if (!rows[index].productName.trim()) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, rowIndex: index })
  }, [rows])

  useEffect(() => {
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])

  const removeRow = useCallback((index: number) => {
    updateRow(index, blankRow())
    setContextMenu(null)
  }, [updateRow])

  const subtotal = useMemo(() => filledRows.reduce((s, r) => s + r.netValue, 0), [filledRows])
  const billDiscAmt = subtotal * (billDisc / 100)
  const total = subtotal - billDiscAmt
  const totalQty = useMemo(() => filledRows.reduce((s, r) => s + r.qty, 0), [filledRows])

  const setInputRef = useCallback((key: string, el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(key, el); else inputRefs.current.delete(key)
  }, [])

  return (
    <div className="invoice-grid-area">
      <div className="grid-toolbar">
        <input placeholder="Customer name..." value={customerName} onChange={e => setCustomerName(e.target.value)} style={{ maxWidth: 200 }} />
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={handleNewSale}>New Sale (F2)</button>
      </div>

      <div className="grid-table-wrap" ref={tableWrapRef} onClick={() => setContextMenu(null)}>
        <table className="grid-table">
          <thead>
            <tr>
              <th className="col-sr">#</th>
              <th className="col-name">Product Name</th>
              <th className="col-code">Code</th>
              <th className="col-balance">Balance</th>
              <th className="col-rate">Rate</th>
              <th className="col-qty">Qty</th>
              <th className="col-disc">Disc%</th>
              <th className="col-net">Net Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className={`${row.productName.trim() ? 'filled' : ''} ${focusedRow === i ? 'focused' : ''}`}
                onClick={() => { setFocusedRow(i); if (!row.productName.trim()) focusInput(i, 'name') }}
                onContextMenu={e => handleContextMenu(e, i)}
              >
                <td className="sr-cell" onClick={() => handleSrClick(i)}>{i + 1}</td>
                <td style={{ position: 'relative' }}>
                  <input
                    ref={el => setInputRef(`name_${i}`, el)}
                    className="cell-input"
                    value={row.productName}
                    onChange={e => handleNameChange(i, e.target.value)}
                    onFocus={() => setFocusedRow(i)}
                    onKeyDown={e => handleKeyDown(e, i, 'name')}
                    onBlur={() => setTimeout(() => setAc(prev => prev?.rowIndex === i && prev.field === 'name' ? null : prev), 200)}
                  />
                  {ac && ac.field === 'name' && ac.rowIndex === i && (
                    <div className="ac-dropdown" style={{ top: ac.position.top + 2, left: Math.max(0, ac.position.left - 20), width: 320 }}>
                      {ac.results.map((p, idx) => (
                        <div key={p.id} className={`ac-item ${idx === ac.selectedIndex ? 'focused' : ''}`} onMouseDown={() => fillRowFromProduct(i, p)}>
                          <span className="ac-name">{p.name}</span>
                          <span className="ac-dept">{p.dept}</span>
                          <span className="ac-price">Rs {p.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ position: 'relative' }}>
                  <input
                    ref={el => setInputRef(`code_${i}`, el)}
                    className="cell-input"
                    value={row.code}
                    onChange={e => handleCodeChange(i, e.target.value)}
                    onFocus={() => setFocusedRow(i)}
                    onKeyDown={e => handleKeyDown(e, i, 'code')}
                    onBlur={() => setTimeout(() => setAc(prev => prev?.rowIndex === i && prev.field === 'code' ? null : prev), 200)}
                  />
                  {ac && ac.field === 'code' && ac.rowIndex === i && (
                    <div className="ac-dropdown" style={{ top: ac.position.top + 2, left: ac.position.left, width: ac.position.width + 120 }}>
                      {ac.results.map((p, idx) => (
                        <div key={p.id} className={`ac-item ${idx === ac.selectedIndex ? 'focused' : ''}`} onMouseDown={() => fillRowFromProduct(i, p)}>
                          <span className="ac-name">{p.name}</span>
                          <span className="ac-dept">{p.dept}</span>
                          <span className="ac-price">Rs {p.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td><span className="cell-readonly">{row.balance > 0 ? row.balance : ''}</span></td>
                <td>
                  <input
                    ref={el => setInputRef(`rate_${i}`, el)}
                    className="cell-input num"
                    value={row.rate || ''}
                    onChange={e => { const v = parseFloat(e.target.value) || 0; updateRow(i, { rate: v }) }}
                    onFocus={e => { setFocusedRow(i); e.target.select() }}
                    onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); focusInput(i, 'qty') } }}
                  />
                </td>
                <td>
                  <input
                    ref={el => setInputRef(`qty_${i}`, el)}
                    className="cell-input num"
                    type="number" min="1"
                    value={row.qty || ''}
                    onChange={e => { const v = Math.max(1, parseInt(e.target.value) || 1); updateRow(i, { qty: v }) }}
                    onFocus={e => { setFocusedRow(i); e.target.select() }}
                    onKeyDown={e => handleKeyDown(e, i, 'qty')}
                  />
                </td>
                <td>
                  <input
                    ref={el => setInputRef(`disc_${i}`, el)}
                    className="cell-input num"
                    type="number" min="0" max="100"
                    value={row.disc || ''}
                    onChange={e => { const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)); updateRow(i, { disc: v }) }}
                    onFocus={e => { setFocusedRow(i); e.target.select() }}
                    onKeyDown={e => handleKeyDown(e, i, 'disc')}
                  />
                </td>
                <td><span className="cell-readonly">{row.netValue.toFixed(2)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        {contextMenu && (
          <div className="grid-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <div className="item danger" onClick={() => removeRow(contextMenu.rowIndex)}>Remove line</div>
          </div>
        )}
      </div>

      <div className="grid-footer">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="stat"><span className="lbl">Items</span><span className="val">{filledRows.length}</span></div>
          <div className="stat"><span className="lbl">Qty</span><span className="val">{totalQty}</span></div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="stat"><span className="lbl">Subtotal</span><span className="val">Rs {subtotal.toFixed(2)}</span></div>
          {billDisc > 0 && <div className="stat"><span className="lbl">Disc</span><span className="val" style={{ color: 'var(--r)' }}>-Rs {billDiscAmt.toFixed(2)}</span></div>}
          <div className="stat" style={{ borderRight: 'none' }}>
            <span className="lbl">Disc %</span>
            <input className="disc-inp" type="number" min="0" max="100" value={billDisc || ''} onChange={e => setBillDisc(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} />
          </div>
          <div className="stat"><span className="lbl">Total</span><span className="val" style={{ fontSize: '.85rem' }}>Rs {total.toFixed(2)}</span></div>
          <div className="footer-actions" style={{ marginLeft: 0 }}>
            <button className="btn btn-primary btn-sm" disabled={filledRows.length === 0} onClick={handleCheckout}>
              Checkout • Rs {total.toFixed(2)}
              <span style={{ fontSize: 8, opacity: 0.6, marginLeft: 6 }}>⇧+Enter</span>
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleNewSale}>
              New Sale
              <span style={{ fontSize: 8, opacity: 0.6, marginLeft: 4 }}>F2</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
