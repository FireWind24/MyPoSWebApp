import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { db } from '@db/schema'
import { useCartStore } from '@stores/cartStore'
import { useUIStore } from '@stores/uiStore'


let rowIdCounter = 0
function newRowId() { return `r_${++rowIdCounter}` }

export interface GridRow {
  id: string
  productName: string
  stock: number
  rate: number
  qty: number
  discPct: number
  netValue: number
  dept: string
  productId: string
}

function blankRow(): GridRow {
  return { id: newRowId(), productName: '', stock: 0, rate: 0, qty: 1, discPct: 0, netValue: 0, dept: '', productId: '' }
}

function createBlankRows(n: number): GridRow[] {
  return Array.from({ length: n }, () => blankRow())
}

const EMPTY_THRESHOLD = 3

interface ProductInfo {
  id: string; name: string; dept: string; price: number; stock: number
}

interface AutocompleteState {
  rowIndex: number
  query: string
  results: ProductInfo[]
  selectedIndex: number
  position: { top: number; left: number; width: number }
}

export function InvoiceGrid() {
  const [rows, setRows] = useState<GridRow[]>(() => createBlankRows(15))
  const [focusedRow, setFocusedRow] = useState<number | null>(null)
  const [ac, setAc] = useState<AutocompleteState | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number } | null>(null)
  const [billDiscPct, setBillDiscPct] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [allProducts, setAllProducts] = useState<ProductInfo[]>([])
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const clearCartStore = useCartStore(s => s.clearCart)
  const setShowCheckout = useUIStore(s => s.setShowCheckout)
  const showToast = useUIStore(s => s.showToast)

  useEffect(() => {
    const load = async () => {
      try {
        const all = await db.products.toArray()
        setAllProducts(all.filter(p => p.price > 0).map(p => ({ id: p.id, name: p.name, dept: p.dept, price: p.price, stock: p.stock })))
      } catch { }
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const filledRows = useMemo(() => rows.filter(r => r.productName.trim() !== ''), [rows])

  const computeNetValue = useCallback((rate: number, qty: number, discPct: number) => {
    return rate * qty * (1 - discPct / 100)
  }, [])

  const ensureBlankRows = useCallback((currentRows: GridRow[]): GridRow[] => {
    const emptyCount = currentRows.filter(r => r.productName.trim() === '').length
    if (emptyCount < EMPTY_THRESHOLD) {
      return [...currentRows, ...createBlankRows(5)]
    }
    return currentRows
  }, [])

  const updateRow = useCallback((index: number, partial: Partial<GridRow>) => {
    setRows(prev => {
      const updated = [...prev]
      const row = { ...updated[index], ...partial }
      if (partial.rate !== undefined || partial.qty !== undefined || partial.discPct !== undefined) {
        row.netValue = computeNetValue(
          partial.rate ?? row.rate,
          partial.qty ?? row.qty,
          partial.discPct ?? row.discPct
        )
      }
      updated[index] = row
      return ensureBlankRows(updated)
    })
  }, [computeNetValue, ensureBlankRows])

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

  const handleProductNameChange = useCallback((index: number, value: string) => {
    updateRow(index, { productName: value })
    if (!value.trim()) {
      setAc(null)
      return
    }
    const input = inputRefs.current.get(`name_${index}`)
    if (!input) return
    const rect = input.getBoundingClientRect()
    const wrapRect = tableWrapRef.current?.getBoundingClientRect()
    if (!wrapRect) return
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(value.toLowerCase()))
    setAc({
      rowIndex: index,
      query: value,
      results: filtered.slice(0, 8),
      selectedIndex: 0,
      position: {
        top: rect.bottom - wrapRect.top + tableWrapRef.current!.scrollTop,
        left: rect.left - wrapRect.left,
        width: rect.width,
      },
    })
  }, [allProducts, updateRow])

  const selectProduct = useCallback((index: number, product: ProductInfo) => {
    updateRow(index, {
      productName: product.name,
      stock: product.stock,
      rate: product.price,
      dept: product.dept,
      productId: product.id,
    })
    setAc(null)
    setTimeout(() => {
      const qtyInput = inputRefs.current.get(`qty_${index}`)
      qtyInput?.focus()
    }, 0)
  }, [updateRow])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number, col: string) => {
    if (ac && ac.rowIndex === index) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAc(prev => prev ? { ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, prev.results.length - 1) } : null); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAc(prev => prev ? { ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) } : null); return }
      if (e.key === 'Enter' && ac.results[ac.selectedIndex]) { e.preventDefault(); selectProduct(index, ac.results[ac.selectedIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); setAc(null); return }
      if (e.key === 'Tab') {
        e.preventDefault()
        selectProduct(index, ac.results[ac.selectedIndex])
        return
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const tabOrder = ['name', 'qty', 'disc']
      const idx = tabOrder.indexOf(col)
      if (idx >= 0 && idx < tabOrder.length - 1) {
        const nextCol = tabOrder[idx + 1]
        setTimeout(() => {
          inputRefs.current.get(`${nextCol}_${index}`)?.focus()
        }, 0)
      } else if (idx === tabOrder.length - 1) {
        setTimeout(() => {
          inputRefs.current.get(`name_${index + 1}`)?.focus()
          setFocusedRow(index + 1)
        }, 0)
      }
      return
    }

    if (e.key === 'Enter' && col === 'name' && !ac) {
      e.preventDefault()
      const val = rows[index].productName.trim()
      if (!val) return
      const exact = allProducts.find(p => p.name.toLowerCase() === val.toLowerCase())
      if (exact) {
        selectProduct(index, exact)
      }
      return
    }

    if (e.key === 'Delete' && col === 'sr' && rows[index].productName.trim()) {
      updateRow(index, blankRow())
      return
    }
  }, [ac, rows, allProducts, selectProduct, updateRow])

  const focusFirstEmpty = useCallback(() => {
    const idx = rows.findIndex(r => r.productName.trim() === '')
    if (idx >= 0) {
      setFocusedRow(idx)
      setTimeout(() => inputRefs.current.get(`name_${idx}`)?.focus(), 0)
    }
  }, [rows])

  const handleNewSale = useCallback(() => {
    setRows(createBlankRows(15))
    setBillDiscPct(0)
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
    if (rows[index].productName.trim()) {
      rows[index].productName = ''
      updateRow(index, blankRow())
    }
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
  const billDiscAmt = subtotal * (billDiscPct / 100)
  const total = subtotal - billDiscAmt
  const totalQty = useMemo(() => filledRows.reduce((s, r) => s + r.qty, 0), [filledRows])

  const setInputRef = useCallback((key: string, el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(key, el); else inputRefs.current.delete(key)
  }, [])

  return (
    <div className="invoice-grid-area">
      <div className="grid-toolbar">
        <input
          placeholder="Customer name..."
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          style={{ maxWidth: 200 }}
        />
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={handleNewSale}>New Sale (F2)</button>
      </div>

      <div className="grid-table-wrap" ref={tableWrapRef} onClick={() => setContextMenu(null)}>
        <table className="grid-table">
          <thead>
            <tr>
              <th className="col-sr">#</th>
              <th className="col-name">Product Name</th>
              <th className="col-stock">Stock</th>
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
                onClick={() => {
                  setFocusedRow(i)
                  if (!row.productName.trim()) {
                    setTimeout(() => inputRefs.current.get(`name_${i}`)?.focus(), 0)
                  }
                }}
                onContextMenu={e => handleContextMenu(e, i)}
              >
                <td className="sr-cell" onClick={() => handleSrClick(i)}>{i + 1}</td>
                <td style={{ position: 'relative' }}>
                  <input
                    ref={el => setInputRef(`name_${i}`, el)}
                    className="cell-input"
                    placeholder=""
                    value={row.productName}
                    onChange={e => handleProductNameChange(i, e.target.value)}
                    onFocus={() => setFocusedRow(i)}
                    onKeyDown={e => handleKeyDown(e, i, 'name')}
                    onBlur={() => setTimeout(() => setAc(prev => prev?.rowIndex === i ? null : prev), 200)}
                  />
                  {ac && ac.rowIndex === i && (
                    <div
                      className="ac-dropdown"
                      style={{
                        top: ac.position.top + 2,
                        left: ac.position.left,
                        width: ac.position.width + 160,
                      }}
                    >
                      {ac.results.map((p, idx) => (
                        <div
                          key={p.id}
                          className={`ac-item ${idx === ac.selectedIndex ? 'focused' : ''}`}
                          onMouseDown={() => selectProduct(i, p)}
                        >
                          <span className="ac-name">{p.name}</span>
                          <span className="ac-dept">{p.dept}</span>
                          <span className="ac-price">Rs {p.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td><span className="cell-readonly">{row.stock > 0 ? row.stock : ''}</span></td>
                <td>
                  <input
                    ref={el => setInputRef(`rate_${i}`, el)}
                    className="cell-input num"
                    value={row.rate || ''}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0
                      updateRow(i, { rate: v })
                    }}
                    onFocus={() => setFocusedRow(i)}
                    onKeyDown={e => {
                      if (e.key === 'Tab') { e.preventDefault(); setTimeout(() => inputRefs.current.get(`qty_${i}`)?.focus(), 0) }
                    }}
                  />
                </td>
                <td>
                  <input
                    ref={el => setInputRef(`qty_${i}`, el)}
                    className="cell-input num"
                    type="number"
                    min="1"
                    value={row.qty || ''}
                    onChange={e => {
                      const v = Math.max(1, parseInt(e.target.value) || 1)
                      updateRow(i, { qty: v })
                    }}
                    onFocus={() => setFocusedRow(i)}
                    onKeyDown={e => handleKeyDown(e, i, 'qty')}
                  />
                </td>
                <td>
                  <input
                    ref={el => setInputRef(`disc_${i}`, el)}
                    className="cell-input num"
                    type="number"
                    min="0"
                    max="100"
                    value={row.discPct || ''}
                    onChange={e => {
                      const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                      updateRow(i, { discPct: v })
                    }}
                    onFocus={() => setFocusedRow(i)}
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
        <div className="stat"><span className="lbl">Items</span><span className="val">{filledRows.length}</span></div>
        <div className="stat"><span className="lbl">Total Qty</span><span className="val">{totalQty}</span></div>
        <div className="stat"><span className="lbl">Subtotal</span><span className="val">Rs {subtotal.toFixed(2)}</span></div>
        {billDiscPct > 0 && (
          <div className="stat"><span className="lbl">Disc</span><span className="val" style={{ color: 'var(--r)' }}>-Rs {billDiscAmt.toFixed(2)}</span></div>
        )}
        <div className="stat" style={{ borderRight: 'none' }}>
          <span className="lbl">Disc %</span>
          <input
            className="disc-inp"
            type="number"
            min="0"
            max="100"
            value={billDiscPct || ''}
            onChange={e => setBillDiscPct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
          />
        </div>
        <div className="stat"><span className="lbl">Total</span><span className="val" style={{ fontSize: '.85rem' }}>Rs {total.toFixed(2)}</span></div>
        <div className="footer-actions">
          <button className="btn btn-primary btn-sm" disabled={filledRows.length === 0} onClick={handleCheckout}>
            Checkout • Rs {total.toFixed(2)}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleNewSale}>New Sale</button>
        </div>
      </div>
    </div>
  )
}
