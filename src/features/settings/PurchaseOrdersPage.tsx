import { useState, useEffect } from 'react'
import { db } from '@db/schema'
import { generateId, fmt } from '@shared/utils'
import { useUIStore } from '@stores/uiStore'
import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'
import type { PurchaseOrder, Supplier, Product } from '@shared/types'

const STATUS_ORDER: PurchaseOrder['status'][] = ['draft', 'sent', 'partially_received', 'received', 'archived']

export function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [showReceive, setShowReceive] = useState<string | null>(null)
  const [form, setForm] = useState({ supplier_id: '', items: [] as { product_id: string; product_name: string; quantity: number; unit_price: number }[] })
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const showToast = useUIStore(s => s.showToast)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [o, s, p] = await Promise.all([
        db.purchaseOrders.toArray(),
        db.suppliers.toArray(),
        db.products.toArray(),
      ])
      setOrders(o)
      setSuppliers(s)
      setProducts(p)
    } catch { }
  }

  const lowStockItems = products.filter(p => p.min_stock && p.stock <= p.min_stock)

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)

  const openCreate = () => {
    setForm({ supplier_id: '', items: [] })
    setShowForm(true)
  }

  const addLowStockItem = (p: Product) => {
    const exists = form.items.find(i => i.product_id === p.id)
    if (exists) {
      setForm(f => ({
        ...f,
        items: f.items.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i),
      }))
    } else {
      setForm(f => ({
        ...f,
        items: [...f.items, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: p.cost_price || p.price }],
      }))
    }
  }

  const searchProducts = search
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode.toLowerCase().includes(search.toLowerCase())
      )
    : []

  const handleCreatePO = async () => {
    if (!form.supplier_id) {
      showToast('Select a supplier', 'err')
      return
    }
    if (form.items.length === 0) {
      showToast('Add at least one item', 'err')
      return
    }
    try {
      const total = form.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
      await db.purchaseOrders.add({
        id: generateId(),
        supplier_id: form.supplier_id,
        status: 'draft',
        items: form.items.map(i => ({ ...i, received: 0 })),
        total,
        created_at: Date.now(),
        received_at: 0,
      })
      showToast('Purchase order created', 'ok')
      setShowForm(false)
      loadData()
    } catch {
      showToast('Failed to create PO', 'err')
    }
  }

  const advanceStatus = async (order: PurchaseOrder) => {
    const idx = STATUS_ORDER.indexOf(order.status)
    if (idx >= STATUS_ORDER.length - 1) return
    const next = STATUS_ORDER[idx + 1]
    try {
      await db.purchaseOrders.update(order.id, { status: next })
      showToast(`PO status → ${next}`, 'ok')
      loadData()
    } catch {
      showToast('Failed to update status', 'err')
    }
  }

  const openReceive = (order: PurchaseOrder) => {
    const init: Record<string, number> = {}
    for (const item of order.items) {
      init[item.product_id] = item.quantity - item.received
    }
    setReceiveQtys(init)
    setShowReceive(order.id)
  }

  const handleReceive = async () => {
    if (!showReceive) return
    try {
      const order = await db.purchaseOrders.get(showReceive)
      if (!order) { showToast('PO not found', 'err'); return }

      const now = Date.now()
      const updatedItems = order.items.map(item => {
        const qtyToReceive = receiveQtys[item.product_id] || 0
        return { ...item, received: item.received + qtyToReceive }
      })

      const allReceived = updatedItems.every(i => i.received >= i.quantity)
      const anyReceived = updatedItems.some(i => i.received > 0)
      const status: PurchaseOrder['status'] = allReceived ? 'received' : anyReceived ? 'partially_received' : order.status

      // Update stock for each item
      for (const item of updatedItems) {
        const qtyToReceive = receiveQtys[item.product_id] || 0
        if (qtyToReceive > 0) {
          const product = await db.products.get(item.product_id)
          if (product) {
            await db.products.update(item.product_id, { stock: product.stock + qtyToReceive })
          }
          await db.stockMovements.add({
            id: generateId(),
            product_id: item.product_id,
            delta: qtyToReceive,
            reason: 'received',
            invoice_id: showReceive,
            created_at: now,
            notes: `PO receipt: ${order.id}`,
          })
        }
      }

      await db.purchaseOrders.update(showReceive, {
        items: updatedItems,
        status,
        received_at: status === 'received' ? now : order.received_at,
      })

      showToast('Goods received', 'ok')
      setShowReceive(null)
      loadData()
    } catch {
      showToast('Failed to receive goods', 'err')
    }
  }

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'Unknown'

  const statusBadge = (status: PurchaseOrder['status']) => {
    const colors: Record<string, string> = {
      draft: 'var(--t3)',
      sent: 'var(--b)',
      partially_received: 'var(--y)',
      received: 'var(--g)',
      archived: 'var(--t3)',
    }
    return (
      <span className="badge" style={{ background: `${colors[status]}20`, color: colors[status] }}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  return (
    <div className="data-page">
      <div className="inv-toolbar" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', ...STATUS_ORDER].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '4px 10px',
                borderRadius: 5,
                border: `1px solid ${statusFilter === s ? 'var(--b)' : 'var(--bd)'}`,
                background: statusFilter === s ? 'var(--b2)' : 'var(--s2)',
                color: statusFilter === s ? 'var(--b)' : 'var(--t2)',
                fontSize: '.6rem',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '.3px',
              }}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <Button variant="primary" size="sm" onClick={openCreate}>+ New PO</Button>
      </div>

      <div className="inv-table-wrap">
        <table>
          <thead>
            <tr>
              <th>PO ID</th>
              <th>Supplier</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: '.6rem' }}>{o.id.slice(0, 12)}...</td>
                <td style={{ fontWeight: 600 }}>{getSupplierName(o.supplier_id)}</td>
                <td style={{ fontSize: '.65rem' }}>{o.items.length} item{o.items.length !== 1 ? 's' : ''}</td>
                <td style={{ fontFamily: 'var(--mono)' }}>{fmt(o.total)}</td>
                <td>{statusBadge(o.status)}</td>
                <td style={{ fontSize: '.6rem' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', maxWidth: 160 }}>
                    {o.status === 'draft' && (
                      <Button variant="ghost" size="xs" onClick={() => advanceStatus(o)}>Send</Button>
                    )}
                    {o.status === 'sent' && (
                      <Button variant="ghost" size="xs" onClick={() => openReceive(o)}>Receive</Button>
                    )}
                    {o.status === 'partially_received' && (
                      <Button variant="ghost" size="xs" onClick={() => openReceive(o)}>Receive More</Button>
                    )}
                    {(o.status === 'received' || o.status === 'partially_received') && (
                      <Button variant="ghost" size="xs" onClick={() => advanceStatus(o)}>Archive</Button>
                    )}
                    {o.status === 'draft' && (
                      <Button variant="danger" size="xs" onClick={async () => { await db.purchaseOrders.delete(o.id); loadData(); }}>Del</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>No purchase orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Purchase Order" wide>
        <div className="form-group">
          <label>Supplier</label>
          <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
            <option value="">Select supplier...</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Search Products to Add</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type to search..." />
          {search && searchProducts.length > 0 && (
            <div style={{ border: '1px solid var(--bd)', borderRadius: 5, marginTop: 4, maxHeight: 150, overflowY: 'auto' }}>
              {searchProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => { addLowStockItem(p); setSearch('') }}
                  style={{ padding: '4px 8px', fontSize: '.7rem', cursor: 'pointer', color: 'var(--t2)', display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>{p.name}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '.6rem', color: 'var(--t3)' }}>{fmt(p.cost_price || p.price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {lowStockItems.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--r)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>
              ⚠ Low Stock Items
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {lowStockItems.map(p => (
                <button
                  key={p.id}
                  onClick={() => addLowStockItem(p)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '.6rem',
                    border: '1px solid var(--r2)',
                    borderRadius: 4,
                    background: 'transparent',
                    color: 'var(--r)',
                    cursor: 'pointer',
                  }}
                >
                  {p.name} ({p.stock}/{p.min_stock})
                </button>
              ))}
            </div>
          </div>
        )}

        {form.items.length > 0 && (
          <div style={{ border: '1px solid var(--bd)', borderRadius: 5, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => (
                  <tr key={item.product_id}>
                    <td style={{ fontSize: '.7rem' }}>{item.product_name}</td>
                    <td style={{ width: 80 }}>
                      <input
                        type="number"
                        value={item.quantity || ''}
                        onChange={e => {
                          const qty = parseInt(e.target.value) || 0
                          setForm(f => ({ ...f, items: f.items.map((i, j) => j === idx ? { ...i, quantity: qty } : i) }))
                        }}
                        style={{ width: 60, padding: '3px 6px', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s2)', color: 'var(--t)', fontSize: '.7rem' }}
                      />
                    </td>
                    <td style={{ width: 100 }}>
                      <input
                        type="number"
                        value={item.unit_price || ''}
                        onChange={e => {
                          const up = parseFloat(e.target.value) || 0
                          setForm(f => ({ ...f, items: f.items.map((i, j) => j === idx ? { ...i, unit_price: up } : i) }))
                        }}
                        style={{ width: 80, padding: '3px 6px', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s2)', color: 'var(--t)', fontSize: '.7rem' }}
                      />
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '.7rem' }}>{fmt(item.quantity * item.unit_price)}</td>
                    <td>
                      <button
                        onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== idx) }))}
                        style={{ background: 'none', border: 'none', color: 'var(--r)', cursor: 'pointer', fontSize: '.7rem' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreatePO}>Create PO</Button>
        </div>
      </Modal>

      <Modal open={!!showReceive} onClose={() => setShowReceive(null)} title="Receive Goods" wide>
        {showReceive && (() => {
          const order = orders.find(o => o.id === showReceive)
          if (!order) return null
          return (
            <>
              <div style={{ fontSize: '.7rem', color: 'var(--t2)', marginBottom: 12 }}>
                PO: {order.id.slice(0, 12)}... | Supplier: {getSupplierName(order.supplier_id)}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>To Receive</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map(item => (
                    <tr key={item.product_id}>
                      <td style={{ fontSize: '.7rem', fontWeight: 600 }}>{item.product_name}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '.7rem' }}>{item.quantity}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '.7rem' }}>{item.received}</td>
                      <td style={{ width: 100 }}>
                        <input
                          type="number"
                          value={receiveQtys[item.product_id] || 0}
                          onChange={e => setReceiveQtys(r => ({ ...r, [item.product_id]: parseInt(e.target.value) || 0 }))}
                          style={{ width: 70, padding: '3px 6px', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s2)', color: 'var(--t)', fontSize: '.7rem' }}
                          max={item.quantity - item.received}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                <Button variant="ghost" onClick={() => setShowReceive(null)}>Cancel</Button>
                <Button variant="primary" onClick={handleReceive}>Receive Goods</Button>
              </div>
            </>
          )
        })()}
      </Modal>
    </div>
  )
}
