import { useState, useEffect, useMemo } from 'react'
import { db } from '@db/schema'
import { fmt, formatDateTime } from '@shared/utils'
import type { Invoice } from '@shared/types'

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    setLoading(true)
    try {
      const all = await db.invoices
        .orderBy('date')
        .reverse()
        .toArray()
      setInvoices(all)
    } catch { }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.dateStr < dateFrom || inv.dateStr > dateTo) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        if (!inv.id.toLowerCase().includes(q) &&
            !(inv.customerName || '').toLowerCase().includes(q) &&
            !inv.payment_method.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [invoices, dateFrom, dateTo, searchText])

  return (
    <div className="inv-page-layout">
      <div className="inv-list-panel">
        <div className="inv-list-header">
          <span>Invoices ({filtered.length})</span>
          <span style={{ fontSize: '.6rem', fontWeight: 400 }}>Today: {invoices.filter(i => i.dateStr === new Date().toISOString().slice(0, 10)).length}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--bd)', alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder="Search ID, customer..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ flex: 1, minWidth: 100, fontSize: '.65rem', padding: '4px 6px', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s2)', color: 'var(--t)' }} />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: '.6rem', padding: '3px 6px', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s2)', color: 'var(--t)' }} />
          <span style={{ color: 'var(--t3)', fontSize: '.6rem' }}>→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: '.6rem', padding: '3px 6px', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s2)', color: 'var(--t)' }} />
        </div>
        <div className="inv-list-items">
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--t3)', padding: 30, fontSize: '.7rem' }}>Loading...</div>
          ) : filtered.map(inv => (
            <div
              key={inv.id}
              className={`inv-list-item ${selected?.id === inv.id ? 'active' : ''}`}
              onClick={() => setSelected(inv)}
            >
              <div className="top">
                <span className="id">#{inv.id.slice(-6)}</span>
                <span className="total">{fmt(inv.total)}</span>
              </div>
              <div className="bottom">
                <span>{formatDateTime(inv.date)}</span>
                <span>
                  <span className={`badge ${inv.payment_method === 'cash' ? 'badge-green' : 'badge-blue'}`}>
                    {inv.payment_method}
                  </span>
                </span>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--t3)', padding: 30, fontSize: '.7rem' }}>
              {invoices.length === 0 ? 'No invoices yet' : 'No invoices match filters'}
            </div>
          )}
        </div>
      </div>
      <div className="inv-detail-panel">
        {selected ? (
          <>
            <h2 style={{ fontSize: '.9rem', marginBottom: 12 }}>Invoice #{selected.id.slice(-8)}</h2>
            <div className="field"><span className="label">Date: </span><span className="value">{formatDateTime(selected.date)}</span></div>
            <div className="field"><span className="label">Customer: </span><span className="value">{selected.customerName || 'Walk-in'}</span></div>
            <div className="field"><span className="label">Payment: </span><span className="value"><span className={`badge ${selected.payment_method === 'cash' ? 'badge-green' : 'badge-blue'}`}>{selected.payment_method}</span></span></div>
            <div className="field"><span className="label">Status: </span><span className="value"><span className={`badge ${selected.status === 'completed' ? 'badge-green' : selected.status === 'refunded' ? 'badge-red' : 'badge-yellow'}`}>{selected.status}</span></span></div>

            <table className="items-table">
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
              </thead>
              <tbody>
                {selected.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td>{item.qty}</td>
                    <td>{fmt(item.price)}</td>
                    <td>{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 3, fontSize: '.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{fmt(selected.subtotal)}</span></div>
              {selected.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--r)' }}><span>Discount ({selected.discPct > 0 ? `${selected.discPct}%` : ''})</span><span>-{fmt(selected.discount)}</span></div>
              )}
              {selected.taxAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax ({selected.taxPct}%)</span><span>{fmt(selected.taxAmount)}</span></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '.9rem', borderTop: '1px solid var(--bd)', paddingTop: 4, marginTop: 4 }}>
                <span>Total</span><span>{fmt(selected.total)}</span>
              </div>
              {selected.payment_method !== 'card' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--t3)' }}><span>Cash</span><span>{fmt(selected.cash)}</span></div>
              )}
              {selected.change > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--g)' }}><span>Change</span><span>{fmt(selected.change)}</span></div>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--t3)', padding: 60, fontSize: '.7rem' }}>
            Select an invoice to view details
          </div>
        )}
      </div>
    </div>
  )
}
