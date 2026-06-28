import { useState, useEffect } from 'react'
import { db } from '@db/schema'
import { generateId, fmt, toCsv, parseCsv, pickFile, dlBlob } from '@shared/utils'
import { useUIStore } from '@stores/uiStore'
import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'
import type { Product, StockMovement } from '@shared/types'

const DEPT_COLORS: Record<string, string> = {
  'General': '#4d9eff',
  'Produce': '#00d68f',
  'Dairy': '#ffa941',
  'Meat': '#f05252',
  'Bakery': '#a855f7',
  'Beverages': '#06b6d4',
  'Snacks': '#f97316',
  'Frozen': '#3b82f6',
}

function getDeptColor(dept: string): string {
  return DEPT_COLORS[dept] || '#8a8a95'
}

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showStockAdj, setShowStockAdj] = useState<string | null>(null)
  const [showMovements, setShowMovements] = useState<string | null>(null)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [showLowStock, setShowLowStock] = useState(false)
  const [adjForm, setAdjForm] = useState({ delta: 0, reason: 'adjusted' as StockMovement['reason'], notes: '' })

  const [form, setForm] = useState({ name: '', barcode: '', dept: '', price: 0, cost_price: 0, stock: 0, min_stock: 0, unit: '', image_url: '', expiry_date: '' })
  const [showImportResult, setShowImportResult] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] }>({ created: 0, updated: 0, skipped: 0, errors: [] })
  const showToast = useUIStore(s => s.showToast)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const all = await db.products.toArray()
      setProducts(all)
    } catch { }
  }

  const CSV_HEADERS = ['Name', 'Barcode', 'Department', 'Price', 'Cost Price', 'Stock', 'Min Stock', 'Unit', 'Expiry Date']

  const productToRow = (p: Product): string[] => [
    p.name, p.barcode || '', p.dept || '',
    String(p.price), String(p.cost_price || ''),
    String(p.stock), String(p.min_stock || ''),
    p.unit || '', p.expiry_date || '',
  ]

  const handleExportCsv = () => {
    const rows = products.map(productToRow)
    const csv = toCsv(CSV_HEADERS, rows)
    dlBlob(csv, 'text/csv', `inventory-${new Date().toISOString().slice(0, 10)}.csv`)
    showToast('Inventory exported', 'ok')
  }

  const handleDownloadTemplate = () => {
    const csv = toCsv(CSV_HEADERS, [])
    dlBlob(csv, 'text/csv', 'inventory-template.csv')
    showToast('Template downloaded', 'ok')
  }

  const handleImportCsv = async () => {
    const file = await pickFile('.csv')
    if (!file) return
    try {
      const { headers, rows } = parseCsv(file.text)
      // Validate headers: need at least Name
      const nameIdx = headers.findIndex(h => h.toLowerCase() === 'name')
      if (nameIdx < 0) { showToast('CSV must have a "Name" column', 'err'); return }

      const barcodeIdx = headers.findIndex(h => h.toLowerCase() === 'barcode')
      const deptIdx = headers.findIndex(h => h.toLowerCase() === 'department')
      const priceIdx = headers.findIndex(h => h.toLowerCase() === 'price')
      const costIdx = headers.findIndex(h => h.toLowerCase() === 'cost price')
      const stockIdx = headers.findIndex(h => h.toLowerCase() === 'stock')
      const minStockIdx = headers.findIndex(h => h.toLowerCase() === 'min stock')
      const unitIdx = headers.findIndex(h => h.toLowerCase() === 'unit')
      const expiryIdx = headers.findIndex(h => h.toLowerCase() === 'expiry date')

      const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] }

      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri]
        try {
          const name = (row[nameIdx] || '').trim()
          if (!name) { result.skipped++; continue }

          const barcode = barcodeIdx >= 0 ? (row[barcodeIdx] || '').trim() : ''
          const dept = deptIdx >= 0 ? (row[deptIdx] || '').trim() : 'General'
          const price = priceIdx >= 0 ? parseFloat(row[priceIdx]) || 0 : 0
          const cost_price = costIdx >= 0 ? parseFloat(row[costIdx]) || 0 : 0
          const stock = stockIdx >= 0 ? parseInt(row[stockIdx]) || 0 : 0
          const min_stock = minStockIdx >= 0 ? parseInt(row[minStockIdx]) || 0 : 0
          const unit = unitIdx >= 0 ? (row[unitIdx] || '').trim() : ''
          const expiry_date = expiryIdx >= 0 ? (row[expiryIdx] || '').trim() : ''

          // Try to match by barcode first, then by name
          const existing = barcode
            ? await db.products.where('barcode').equals(barcode).first()
            : null
          const match = existing || (await db.products.where('name').equals(name).first())

          if (match) {
            await db.products.update(match.id, {
              name, barcode, dept, price, cost_price, stock, min_stock, unit,
              expiry_date: expiry_date || undefined,
            })
            result.updated++
          } else {
            await db.products.add({
              id: generateId(),
              name, barcode, dept, price, cost_price, stock, min_stock, unit,
              image_url: '', expiry_date: expiry_date || undefined,
            })
            result.created++
          }
        } catch (err) {
          result.errors.push(`Row ${ri + 2}: ${err}`)
        }
      }

      setImportResult(result)
      setShowImportResult(true)
      loadProducts()
      showToast(`Imported: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`, 'ok')
    } catch {
      showToast('Failed to parse CSV file', 'err')
    }
  }

  const filtered = search
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode.toLowerCase().includes(search.toLowerCase()) ||
        p.dept.toLowerCase().includes(search.toLowerCase())
      )
    : products

  const lowStockProducts = products.filter(p => p.min_stock && p.stock <= p.min_stock)

  const openAdd = () => {
    setEditingId(null)
    setForm({ name: '', barcode: '', dept: '', price: 0, cost_price: 0, stock: 0, min_stock: 0, unit: '', image_url: '', expiry_date: '' })
    setShowForm(true)
  }

  const openEdit = (p: Product) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      barcode: p.barcode,
      dept: p.dept,
      price: p.price,
      cost_price: p.cost_price || 0,
      stock: p.stock,
      min_stock: p.min_stock || 0,
      unit: p.unit || '',
      image_url: p.image_url || '',
      expiry_date: p.expiry_date || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Product name is required', 'err')
      return
    }
    try {
      if (editingId) {
        await db.products.update(editingId, {
          name: form.name,
          barcode: form.barcode,
          dept: form.dept || 'General',
          price: form.price,
          cost_price: form.cost_price,
          stock: form.stock,
          min_stock: form.min_stock,
          unit: form.unit,
          image_url: form.image_url,
          expiry_date: form.expiry_date || undefined,
        })
        showToast('Product updated', 'ok')
      } else {
        await db.products.add({
          id: generateId(),
          name: form.name,
          barcode: form.barcode,
          dept: form.dept || 'General',
          price: form.price,
          cost_price: form.cost_price,
          stock: form.stock,
          min_stock: form.min_stock,
          unit: form.unit,
          image_url: form.image_url,
          expiry_date: form.expiry_date || undefined,
        })
        showToast('Product added', 'ok')
      }
      setShowForm(false)
      loadProducts()
    } catch {
      showToast('Failed to save product', 'err')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await db.products.delete(id)
      showToast('Product deleted', 'ok')
      loadProducts()
    } catch {
      showToast('Failed to delete', 'err')
    }
  }

  const handleDuplicate = async (p: Product) => {
    try {
      const { id, ...rest } = p
      await db.products.add({
        ...rest,
        id: generateId(),
        name: p.name + ' (Copy)',
      })
      showToast('Product duplicated', 'ok')
      loadProducts()
    } catch {
      showToast('Failed to duplicate', 'err')
    }
  }

  const handleStockAdj = async () => {
    if (!showStockAdj || adjForm.delta === 0) {
      showToast('Delta cannot be zero', 'err')
      return
    }
    try {
      const product = await db.products.get(showStockAdj)
      if (!product) { showToast('Product not found', 'err'); return }
      const newStock = Math.max(0, product.stock + adjForm.delta)
      await db.products.update(showStockAdj, { stock: newStock })
      await db.stockMovements.add({
        id: generateId(),
        product_id: showStockAdj,
        delta: adjForm.delta,
        reason: adjForm.reason,
        invoice_id: '',
        created_at: Date.now(),
        notes: adjForm.notes,
      })
      showToast(`Stock adjusted (${adjForm.delta >= 0 ? '+' : ''}${adjForm.delta})`, 'ok')
      setShowStockAdj(null)
      setAdjForm({ delta: 0, reason: 'adjusted', notes: '' })
      loadProducts()
    } catch {
      showToast('Failed to adjust stock', 'err')
    }
  }

  const openMovements = async (productId: string) => {
    try {
      const m = await db.stockMovements
        .where('product_id')
        .equals(productId)
        .reverse()
        .sortBy('created_at')
      setMovements(m)
      setShowMovements(productId)
    } catch {
      showToast('Failed to load movements', 'err')
    }
  }

  const isExpiringSoon = (dateStr?: string) => {
    if (!dateStr) return false
    const expiry = new Date(dateStr).getTime()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    return expiry - Date.now() < thirtyDays && expiry > Date.now()
  }

  const isExpired = (dateStr?: string) => {
    if (!dateStr) return false
    return new Date(dateStr).getTime() < Date.now()
  }

  return (
    <div className="inv-page">
      <div className="inv-toolbar">
        <input
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="spacer" />
        {lowStockProducts.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowLowStock(true)} style={{ color: 'var(--r)' }}>
            ⚠ Low Stock ({lowStockProducts.length})
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={openAdd}>+ Add Product</Button>
        <Button variant="ghost" size="sm" onClick={handleExportCsv} disabled={products.length === 0}>Export CSV</Button>
        <Button variant="ghost" size="sm" onClick={handleImportCsv}>Import CSV</Button>
        <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>Template</Button>
      </div>

      <div className="inv-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Barcode</th>
              <th>Dept</th>
              <th>Price</th>
              <th>Cost</th>
              <th>Stock</th>
              <th>Min</th>
              <th>Expiry</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td>
                  {p.image_url ? (
                    <img src={p.image_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: 'var(--t3)', fontSize: '.6rem' }}>—</span>
                  )}
                </td>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: '.65rem' }}>{p.barcode || '—'}</td>
                <td>
                  <span className="badge" style={{
                    background: `${getDeptColor(p.dept)}20`,
                    color: getDeptColor(p.dept),
                  }}>
                    {p.dept}
                  </span>
                </td>
                <td style={{ fontFamily: 'var(--mono)' }}>{fmt(p.price)}</td>
                <td style={{ fontFamily: 'var(--mono)' }}>{p.cost_price ? fmt(p.cost_price) : '—'}</td>
                <td>
                  <span style={{
                    fontFamily: 'var(--mono)',
                    color: p.stock <= (p.min_stock || 0) ? 'var(--r)' : 'var(--t)',
                    fontWeight: p.stock <= (p.min_stock || 0) ? 700 : 400,
                    position: 'relative',
                  }}>
                    {p.stock}
                    {p.stock <= (p.min_stock || 0) && p.min_stock ? (
                      <span title="Low stock" style={{ marginLeft: 4, fontSize: '.55rem', color: 'var(--r)' }}>⬇</span>
                    ) : null}
                  </span>
                </td>
                <td style={{ fontFamily: 'var(--mono)' }}>{p.min_stock || '—'}</td>
                <td>
                  {p.expiry_date ? (
                    <span style={{
                      fontSize: '.6rem',
                      color: isExpired(p.expiry_date) ? 'var(--r)' : isExpiringSoon(p.expiry_date) ? 'var(--y)' : 'var(--t3)',
                    }}>
                      {isExpired(p.expiry_date) ? 'EXPIRED' : isExpiringSoon(p.expiry_date) ? '⚠ ' : ''}
                      {new Date(p.expiry_date).toLocaleDateString()}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--t3)', fontSize: '.6rem' }}>—</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', maxWidth: 180 }}>
                    <Button variant="ghost" size="xs" onClick={() => openEdit(p)}>Edit</Button>
                    <Button variant="ghost" size="xs" onClick={() => { setAdjForm({ delta: 0, reason: 'adjusted', notes: '' }); setShowStockAdj(p.id) }}>Adj</Button>
                    <Button variant="ghost" size="xs" onClick={() => openMovements(p.id)}>Hist</Button>
                    <Button variant="ghost" size="xs" onClick={() => handleDuplicate(p)}>Clone</Button>
                    <Button variant="danger" size="xs" onClick={() => handleDelete(p.id)}>Del</Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>No products found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Edit Product' : 'Add Product'} wide>
        <div className="form-group">
          <label>Product Name *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label>Barcode</label>
            <input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Department</label>
            <input value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label>Selling Price</label>
            <input type="number" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="form-group">
            <label>Cost Price</label>
            <input type="number" value={form.cost_price || ''} onChange={e => setForm(f => ({ ...f, cost_price: parseFloat(e.target.value) || 0 }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label>Stock</label>
            <input type="number" value={form.stock || ''} onChange={e => setForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="form-group">
            <label>Min Stock</label>
            <input type="number" value={form.min_stock || ''} onChange={e => setForm(f => ({ ...f, min_stock: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label>Unit</label>
            <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="pcs, kg, liter..." />
          </div>
          <div className="form-group">
            <label>Image URL</label>
            <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
          </div>
        </div>
        <div className="form-group">
          <label>Expiry Date</label>
          <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </div>
      </Modal>

      <Modal open={!!showStockAdj} onClose={() => setShowStockAdj(null)} title="Stock Adjustment" narrow>
        <div className="form-group">
          <label>Delta (+/-)</label>
          <input type="number" value={adjForm.delta || ''} onChange={e => setAdjForm(f => ({ ...f, delta: parseInt(e.target.value) || 0 }))} placeholder="e.g. 10 or -5" />
        </div>
        <div className="form-group">
          <label>Reason</label>
          <select value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value as any }))}>
            <option value="received">Received</option>
            <option value="damaged">Damaged</option>
            <option value="expired">Expired</option>
            <option value="counted">Counted</option>
            <option value="adjusted">Adjusted</option>
          </select>
        </div>
        <div className="form-group">
          <label>Notes</label>
          <input value={adjForm.notes} onChange={e => setAdjForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button variant="ghost" onClick={() => setShowStockAdj(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleStockAdj}>Apply</Button>
        </div>
      </Modal>

      <Modal open={!!showMovements} onClose={() => setShowMovements(null)} title="Stock Movement History" wide>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {movements.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>No movements recorded</div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {movements.map(m => (
                <div key={m.id} style={{
                  position: 'relative',
                  padding: '6px 0 6px 16px',
                  borderLeft: '2px solid var(--bd)',
                  marginLeft: 8,
                }}>
                  <div style={{
                    position: 'absolute',
                    left: -7,
                    top: 10,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: m.delta > 0 ? 'var(--g)' : 'var(--r)',
                    border: '2px solid var(--s1)',
                  }} />
                  <div style={{ fontSize: '.7rem', color: 'var(--t2)' }}>
                    <span style={{ fontWeight: 700, color: m.delta > 0 ? 'var(--g)' : 'var(--r)' }}>
                      {m.delta >= 0 ? '+' : ''}{m.delta}
                    </span>
                    {' '}
                    <span className="badge" style={{
                      background: 'var(--s2)',
                      color: 'var(--t2)',
                      fontSize: '.55rem',
                    }}>
                      {m.reason}
                    </span>
                    {m.notes && <span style={{ marginLeft: 8, color: 'var(--t3)' }}>— {m.notes}</span>}
                  </div>
                  <div style={{ fontSize: '.6rem', color: 'var(--t3)', marginTop: 2 }}>
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showLowStock} onClose={() => setShowLowStock(false)} title="Low Stock Products" wide>
        {lowStockProducts.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>All products are well-stocked</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Dept</th>
                <th>Stock</th>
                <th>Min Stock</th>
              </tr>
            </thead>
            <tbody>
              {lowStockProducts.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td><span className="badge badge-blue">{p.dept}</span></td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--r)', fontWeight: 700 }}>{p.stock}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{p.min_stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>

      {/* Import Result Modal */}
      <Modal open={showImportResult} onClose={() => setShowImportResult(false)} title="Import Results" narrow>
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div style={{ textAlign: 'center', flex: 1, background: 'var(--s2)', borderRadius: 6, padding: '10px 0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g)' }}>{importResult.created}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>Created</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1, background: 'var(--s2)', borderRadius: 6, padding: '10px 0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--b)' }}>{importResult.updated}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>Updated</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1, background: 'var(--s2)', borderRadius: 6, padding: '10px 0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t3)' }}>{importResult.skipped}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>Skipped</div>
            </div>
          </div>
          {importResult.errors.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--r)', marginBottom: 4 }}>Errors:</div>
              {importResult.errors.map((err, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--r)', marginBottom: 2 }}>{err}</div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
