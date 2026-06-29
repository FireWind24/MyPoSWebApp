import { useState, useEffect, useMemo } from 'react'
import { db } from '@db/schema'
import { fmt, dlBlob } from '@shared/utils'
import { useUIStore } from '@stores/uiStore'
import { useShiftStore } from '@stores/shiftStore'
import { DashboardPage } from './DashboardPage'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts'
import type { Invoice, Shift, Product, ShiftReport, Customer } from '@shared/types'
import type { PieLabelRenderProps } from 'recharts'

const COLORS = ['#00d68f', '#4d9eff', '#ffa941', '#f05252', '#a855f7', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6']

type TabKey = 'dashboard' | 'sales' | 'products' | 'invoices' | 'inventory' | 'shifts' | 'customers'

function getChartColors(theme: string) {
  return {
    line: theme === 'dark' ? '#b0b0bb' : '#3a3a42',
    grid: theme === 'dark' ? '#33333f' : '#d4d4db',
    tooltipBg: theme === 'dark' ? '#22222b' : '#ffffff',
    tooltipText: theme === 'dark' ? '#f0f0f3' : '#0a0a0b',
  }
}

function exportCSV(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
  dlBlob(csv, 'text/csv', filename)
}

function exportHTML(title: string, contentHtml: string) {
  const win = window.open('', '_blank')
  if (!win) return
  const theme = useUIStore.getState().theme
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
    body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 20px; color: ${theme === 'dark' ? '#f0f0f3' : '#0a0a0b'}; background: ${theme === 'dark' ? '#121217' : '#f5f5f7'}; }
    h1 { font-size: 1.2rem; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: .75rem; }
    th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid ${theme === 'dark' ? '#33333f' : '#d4d4db'}; }
    th { font-weight: 700; color: ${theme === 'dark' ? '#6a6a75' : '#8a8a95'}; }
  </style></head><body><h1>${title}</h1>${contentHtml}</body></html>`)
  win.document.close()
  win.print()
}

function SalesTab() {
  const theme = useUIStore(s => s.theme)
  const cc = getChartColors(theme)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [_products, setProducts] = useState<Product[]>([])
  const [fromDate, setFromDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [viewMode, setViewMode] = useState<'daily' | 'hourly' | 'trend'>('daily')
  const [deptFilter, setDeptFilter] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setInvoices(await db.invoices.toArray())
      setProducts(await db.products.toArray())
    })()
  }, [])

  const filtered = useMemo(() => {
    const comp = invoices.filter(i => i.status === 'completed' && i.dateStr >= fromDate && i.dateStr <= toDate)
    if (deptFilter) {
      return comp.filter(i => i.items.some(item => item.dept === deptFilter))
    }
    return comp
  }, [invoices, fromDate, toDate, deptFilter])

  const stats = useMemo(() => {
    const total = filtered.length
    const itemsSold = filtered.reduce((s, i) => s + i.items.reduce((a, it) => a + it.qty, 0), 0)
    const gross = filtered.reduce((s, i) => s + i.subtotal, 0)
    const discounts = filtered.reduce((s, i) => s + i.discount, 0)
    const net = filtered.reduce((s, i) => s + i.total, 0)
    const tax = filtered.reduce((s, i) => s + (i.taxAmount || 0), 0)
    const avg = total > 0 ? net / total : 0
    return { total, itemsSold, gross, discounts, net, tax, avg }
  }, [filtered])

  const dailyData = useMemo(() => {
    const map = new Map<string, number>()
    for (const inv of filtered) {
      map.set(inv.dateStr, (map.get(inv.dateStr) || 0) + inv.total)
    }
    return Array.from(map.entries()).map(([date, revenue]) => ({ date: date.slice(5), revenue })).sort((a, b) => a.date.localeCompare(b.date))
  }, [filtered])

  const hourlyInDay = useMemo(() => {
    const map = new Map<number, number>()
    for (let h = 0; h < 24; h++) map.set(h, 0)
    for (const inv of filtered) {
      const h = new Date(inv.date).getHours()
      map.set(h, (map.get(h) || 0) + inv.total)
    }
    return Array.from(map.entries()).map(([hour, sales]) => ({ hour: `${hour}:00`, sales }))
  }, [filtered])

  const trendData = useMemo(() => {
    const map = new Map<string, number>()
    for (const inv of filtered) {
      const key = inv.dateStr.slice(0, 7)
      map.set(key, (map.get(key) || 0) + inv.total)
    }
    return Array.from(map.entries()).map(([month, revenue]) => ({ month, revenue })).sort((a, b) => a.month.localeCompare(b.month))
  }, [filtered])

  const deptRevenue = useMemo(() => {
    const map = new Map<string, number>()
    for (const inv of filtered) {
      for (const item of inv.items) {
        if (deptFilter && item.dept !== deptFilter) continue
        map.set(item.dept || 'Other', (map.get(item.dept || 'Other') || 0) + item.total)
      }
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filtered, deptFilter])

  const deptBreakdown = useMemo(() => {
    if (!deptFilter) return []
    const map = new Map<string, { qty: number; revenue: number }>()
    for (const inv of filtered) {
      for (const item of inv.items) {
        if (item.dept !== deptFilter) continue
        const e = map.get(item.name) || { qty: 0, revenue: 0 }
        e.qty += item.qty
        e.revenue += item.total
        map.set(item.name, e)
      }
    }
    return Array.from(map.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue)
  }, [filtered, deptFilter])

  const handleExport = () => {
    const headers = ['Date', 'Invoice ID', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment']
    const rows = filtered.map(i => [
      i.dateStr, i.id,
      String(i.items.reduce((s, it) => s + it.qty, 0)),
      String(i.subtotal), String(i.discount), String(i.taxAmount || 0),
      String(i.total), i.payment_method,
    ])
    exportCSV(headers, rows, `sales-${fromDate}-to-${toDate}.csv`)
  }

  const handlePrint = () => {
    const rows = filtered.map(i => `<tr><td>${i.dateStr}</td><td>${i.id}</td><td>${i.items.reduce((s, it) => s + it.qty, 0)}</td><td>${fmt(i.subtotal)}</td><td>${fmt(i.discount)}</td><td>${fmt(i.taxAmount || 0)}</td><td>${fmt(i.total)}</td><td>${i.payment_method}</td></tr>`).join('')
    exportHTML('Sales Summary', `<table><thead><tr><th>Date</th><th>ID</th><th>Items</th><th>Subtotal</th><th>Discount</th><th>Tax</th><th>Total</th><th>Payment</th></tr></thead><tbody>${rows}</tbody></table>`)
  }

  return (
    <div className="rep-page">
      <div className="rep-date-row">
        <div className="form-group"><label>From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
        <div className="form-group"><label>To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
        <button className="btn btn-sm btn-ghost" onClick={handleExport}>CSV</button>
        <button className="btn btn-sm btn-ghost" onClick={handlePrint}>PDF</button>
      </div>

      <div className="rep-cards">
        <div className="rep-card"><div className="num">{stats.total}</div><div className="label">Transactions</div></div>
        <div className="rep-card"><div className="num">{stats.itemsSold}</div><div className="label">Items Sold</div></div>
        <div className="rep-card"><div className="num">{fmt(stats.gross)}</div><div className="label">Gross Revenue</div></div>
        <div className="rep-card"><div className="num">{fmt(stats.discounts)}</div><div className="label">Discounts</div></div>
        <div className="rep-card"><div className="num">{fmt(stats.net)}</div><div className="label">Net Revenue</div></div>
        <div className="rep-card"><div className="num">{fmt(stats.tax)}</div><div className="label">Tax</div></div>
        <div className="rep-card"><div className="num">{fmt(stats.avg)}</div><div className="label">Avg Basket</div></div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['daily', 'hourly', 'trend'] as const).map(m => (
          <button key={m} className={`btn btn-xs ${viewMode === m ? 'btn-g' : 'btn-ghost'}`}
            style={{ background: viewMode === m ? 'rgba(0,214,143,.08)' : 'transparent', color: viewMode === m ? 'var(--g)' : 'var(--t2)', border: `1px solid ${viewMode === m ? 'var(--g2)' : 'var(--bd)'}` }}
            onClick={() => setViewMode(m)}>
            {m === 'daily' ? 'Daily' : m === 'hourly' ? 'Hourly' : 'Trend'}
          </button>
        ))}
      </div>

      <div className="rep-chart">
        <h3>{viewMode === 'daily' ? 'Daily Sales' : viewMode === 'hourly' ? 'Hourly Sales' : 'Monthly Trend'}</h3>
        <ResponsiveContainer width="100%" height={220}>
          {viewMode === 'daily' ? (
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: cc.line }} />
              <YAxis tick={{ fontSize: 10, fill: cc.line }} />
              <Tooltip contentStyle={{ background: cc.tooltipBg, border: '1px solid var(--bd)', borderRadius: 6, fontSize: 12, color: cc.tooltipText }} />
              <Bar dataKey="revenue" fill="var(--g)" radius={[3, 3, 0, 0]} />
            </BarChart>
          ) : viewMode === 'hourly' ? (
            <LineChart data={hourlyInDay}>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: cc.line }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: cc.line }} />
              <Tooltip contentStyle={{ background: cc.tooltipBg, border: '1px solid var(--bd)', borderRadius: 6, fontSize: 12, color: cc.tooltipText }} />
              <Line type="monotone" dataKey="sales" stroke="var(--b)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : (
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: cc.line }} />
              <YAxis tick={{ fontSize: 10, fill: cc.line }} />
              <Tooltip contentStyle={{ background: cc.tooltipBg, border: '1px solid var(--bd)', borderRadius: 6, fontSize: 12, color: cc.tooltipText }} />
              <Area type="monotone" dataKey="revenue" stroke="var(--g)" fill="var(--g2)" />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="rep-chart">
        <h3>Department Revenue{deptFilter ? `: ${deptFilter}` : ''} <button className="btn btn-xs btn-ghost" onClick={() => setDeptFilter(null)} style={{ marginLeft: 8 }}>Clear Filter</button></h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={deptRevenue} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
              label={({ name, percent }: PieLabelRenderProps) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
              onClick={(entry: { name?: string }) => setDeptFilter(entry.name ?? null)} style={{ cursor: 'pointer' }}>
              {deptRevenue.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: cc.tooltipBg, border: '1px solid var(--bd)', borderRadius: 6, fontSize: 12, color: cc.tooltipText }} />
            <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {deptFilter && deptBreakdown.length > 0 && (
        <div className="rep-chart">
          <h3>Breakdown for {deptFilter}</h3>
          <table><thead><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>
            {deptBreakdown.map(d => <tr key={d.name}><td>{d.name}</td><td>{d.qty}</td><td>{fmt(d.revenue)}</td></tr>)}
          </tbody></table>
        </div>
      )}

      <div className="table-wrap">
        <table><thead><tr><th>Date</th><th>ID</th><th>Items</th><th>Subtotal</th><th>Discount</th><th>Tax</th><th>Total</th><th>Payment</th></tr></thead><tbody>
          {filtered.map(i => (
            <tr key={i.id}><td>{i.dateStr}</td><td style={{ fontFamily: 'var(--mono)', fontSize: '.65rem' }}>{i.id.slice(-8)}</td>
              <td>{i.items.reduce((s, it) => s + it.qty, 0)}</td><td>{fmt(i.subtotal)}</td><td>{fmt(i.discount)}</td>
              <td>{fmt(i.taxAmount || 0)}</td><td>{fmt(i.total)}</td><td><span className={`badge ${i.payment_method === 'cash' ? 'badge-green' : i.payment_method === 'card' ? 'badge-blue' : 'badge-yellow'}`}>{i.payment_method}</span></td></tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>No data</td></tr>}
        </tbody></table>
      </div>
    </div>
  )
}

function ProductPerformanceTab() {
  const theme = useUIStore(s => s.theme)
  const cc = getChartColors(theme)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [fromDate, setFromDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    ;(async () => {
      setInvoices(await db.invoices.toArray())
      setProducts(await db.products.toArray())
    })()
  }, [])

  const filtered = useMemo(() => invoices.filter(i => i.status === 'completed' && i.dateStr >= fromDate && i.dateStr <= toDate), [invoices, fromDate, toDate])

  const productData = useMemo(() => {
    const salesMap = new Map<string, { qty: number; revenue: number; dept: string }>()
    for (const inv of filtered) {
      for (const item of inv.items) {
        const e = salesMap.get(item.name) || { qty: 0, revenue: 0, dept: item.dept || '' }
        e.qty += item.qty
        e.revenue += item.total
        if (item.dept) e.dept = item.dept
        salesMap.set(item.name, e)
      }
    }
    const totalRevenue = Array.from(salesMap.values()).reduce((s, v) => s + v.revenue, 0)
    const prodMap = new Map(products.map(p => [p.name, p]))
    return Array.from(salesMap.entries()).map(([name, data]) => {
      const prod = prodMap.get(name)
      const avgPrice = data.qty > 0 ? data.revenue / data.qty : 0
      const costPrice = prod?.cost_price || 0
      const cost = costPrice * data.qty
      const margin = data.revenue > 0 ? ((data.revenue - cost) / data.revenue) * 100 : 0
      return { name, dept: data.dept, qty: data.qty, revenue: data.revenue, pct: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0, avgPrice, cost, margin }
    }).sort((a, b) => b.revenue - a.revenue)
  }, [filtered, products])

  const chartData = productData.slice(0, 10)

  const handleExport = () => {
    const headers = ['Product', 'Dept', 'Units Sold', 'Revenue', '% of Total', 'Avg Price']
    const rows = productData.map(p => [p.name, p.dept, String(p.qty), String(p.revenue), `${p.pct.toFixed(1)}%`, String(p.avgPrice)])
    exportCSV(headers, rows, `products-${fromDate}-to-${toDate}.csv`)
  }

  const handlePrint = () => {
    const rows = productData.map(p => `<tr><td>${p.name}</td><td>${p.dept}</td><td>${p.qty}</td><td>${fmt(p.revenue)}</td><td>${p.pct.toFixed(1)}%</td><td>${fmt(p.avgPrice)}</td></tr>`).join('')
    exportHTML('Product Performance', `<table><thead><tr><th>Product</th><th>Dept</th><th>Units</th><th>Revenue</th><th>%</th><th>Avg Price</th></tr></thead><tbody>${rows}</tbody></table>`)
  }

  return (
    <div className="rep-page">
      <div className="rep-date-row">
        <div className="form-group"><label>From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
        <div className="form-group"><label>To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
        <button className="btn btn-sm btn-ghost" onClick={handleExport}>CSV</button>
        <button className="btn btn-sm btn-ghost" onClick={handlePrint}>PDF</button>
      </div>

      <div className="rep-chart">
        <h3>Revenue vs Cost (Top 10)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: cc.line }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10, fill: cc.line }} />
            <Tooltip contentStyle={{ background: cc.tooltipBg, border: '1px solid var(--bd)', borderRadius: 6, fontSize: 12, color: cc.tooltipText }} />
            <Bar dataKey="revenue" fill="var(--g)" name="Revenue" radius={[3, 3, 0, 0]} />
            <Bar dataKey="cost" fill="var(--r)" name="Cost" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rep-chart">
        <h3>Margin %</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: cc.line }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10, fill: cc.line }} domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={{ background: cc.tooltipBg, border: '1px solid var(--bd)', borderRadius: 6, fontSize: 12, color: cc.tooltipText }} formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
            <Bar dataKey="margin" fill="var(--b)" name="Margin %" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="table-wrap">
        <table><thead><tr><th>Product</th><th>Dept</th><th>Units Sold</th><th>Revenue</th><th>% of Total</th><th>Avg Price</th></tr></thead><tbody>
          {productData.map(p => <tr key={p.name}><td>{p.name}</td><td>{p.dept}</td><td>{p.qty}</td><td>{fmt(p.revenue)}</td><td>{p.pct.toFixed(1)}%</td><td>{fmt(p.avgPrice)}</td></tr>)}
          {productData.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>No data</td></tr>}
        </tbody></table>
      </div>
    </div>
  )
}

function InvoiceDetailTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Invoice | null>(null)

  useEffect(() => {
    ;(async () => setInvoices(await db.invoices.toArray()))()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return []
    const q = search.toLowerCase()
    return invoices.filter(i =>
      i.id.toLowerCase().includes(q) ||
      i.dateStr.includes(q) ||
      String(i.total).includes(q) ||
      (i.customerName || '').toLowerCase().includes(q)
    ).slice(0, 20)
  }, [invoices, search])

  const handlePrint = () => {
    if (!selected) return
    const itemsRows = selected.items.map(it => `<tr><td>${it.name}</td><td>${it.qty}</td><td>${fmt(it.price)}</td><td>${fmt(it.total)}</td></tr>`).join('')
    exportHTML(`Invoice ${selected.id.slice(-8)}`, `
      <div style="margin-bottom:16px"><strong>Date:</strong> ${selected.dateStr}<br><strong>Cashier:</strong> ${selected.cashier_id}<br><strong>Customer:</strong> ${selected.customerName || 'Walk-in'}<br><strong>Payment:</strong> ${selected.payment_method}</div>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${itemsRows}</tbody></table>
      <div style="margin-top:12px"><strong>Subtotal:</strong> ${fmt(selected.subtotal)}<br><strong>Discount:</strong> ${fmt(selected.discount)}<br><strong>Tax:</strong> ${fmt(selected.taxAmount || 0)}<br><strong>Total:</strong> ${fmt(selected.total)}</div>
    `)
  }

  return (
    <div className="rep-page">
      <div className="form-group">
        <label>Search by Invoice ID, Date, Amount, or Customer</label>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Type to search..." />
      </div>
      {selected && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '.65rem', color: 'var(--t3)' }}>Invoice: {selected.id.slice(-8)}</span>
          <button className="btn btn-xs btn-ghost" onClick={() => setSelected(null)}>Close</button>
          <button className="btn btn-xs btn-ghost" onClick={handlePrint}>PDF</button>
        </div>
      )}
      {selected ? (
        <div className="inv-detail-panel" style={{ border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--s1)' }}>
          <div className="field"><span className="label">Date:</span> <span className="value">{selected.dateStr}</span></div>
          <div className="field"><span className="label">Cashier:</span> <span className="value">{selected.cashier_id}</span></div>
          <div className="field"><span className="label">Customer:</span> <span className="value">{selected.customerName || 'Walk-in'}</span></div>
          <div className="field"><span className="label">Payment:</span> <span className="value"><span className={`badge ${selected.payment_method === 'cash' ? 'badge-green' : selected.payment_method === 'card' ? 'badge-blue' : 'badge-yellow'}`}>{selected.payment_method}</span></span></div>
          <div className="field"><span className="label">Status:</span> <span className={`badge ${selected.status === 'completed' ? 'badge-green' : 'badge-red'}`}>{selected.status}</span></div>
          <table className="items-table" style={{ marginTop: 12 }}>
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>{selected.items.map((it, i) => <tr key={i}><td>{it.name}</td><td>{it.qty}</td><td>{fmt(it.price)}</td><td>{fmt(it.total)}</td></tr>)}</tbody>
          </table>
          <div style={{ marginTop: 12, fontSize: '.75rem' }}>
            <div className="field"><span className="label">Subtotal:</span> <span className="value">{fmt(selected.subtotal)}</span></div>
            <div className="field"><span className="label">Discount:</span> <span className="value">{fmt(selected.discount)}</span></div>
            <div className="field"><span className="label">Tax:</span> <span className="value">{fmt(selected.taxAmount || 0)}</span></div>
            <div className="field" style={{ fontWeight: 800 }}><span className="label">Total:</span> <span className="value" style={{ color: 'var(--g)' }}>{fmt(selected.total)}</span></div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table><thead><tr><th>Date</th><th>ID</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>
            {filtered.map(i => <tr key={i.id} onClick={() => setSelected(i)} style={{ cursor: 'pointer' }}>
              <td>{i.dateStr}</td><td style={{ fontFamily: 'var(--mono)', fontSize: '.65rem' }}>{i.id.slice(-8)}</td>
              <td>{i.customerName || 'Walk-in'}</td><td>{fmt(i.total)}</td>
              <td><span className={`badge ${i.payment_method === 'cash' ? 'badge-green' : i.payment_method === 'card' ? 'badge-blue' : 'badge-yellow'}`}>{i.payment_method}</span></td>
              <td><span className={`badge ${i.status === 'completed' ? 'badge-green' : 'badge-red'}`}>{i.status}</span></td>
            </tr>)}
            {filtered.length === 0 && search && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>No results</td></tr>}
          </tbody></table>
        </div>
      )}
    </div>
  )
}

function InventoryValuationTab() {
  const theme = useUIStore(s => s.theme)
  const cc = getChartColors(theme)
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    ;(async () => setProducts(await db.products.toArray()))()
  }, [])

  const data = useMemo(() => {
    return products.map(p => {
      const stockQty = p.stock || 0
      const costPrice = p.cost_price || 0
      const retailPrice = p.price || 0
      const stockValueCost = stockQty * costPrice
      const stockValueRetail = stockQty * retailPrice
      const margin = retailPrice > 0 ? ((retailPrice - costPrice) / retailPrice) * 100 : 0
      const ratio = (p.min_stock && p.min_stock > 0) ? stockQty / p.min_stock : 999
      return { name: p.name, dept: p.dept, stockQty, costPrice, retailPrice, stockValueCost, stockValueRetail, margin, ratio, minStock: p.min_stock || 0 }
    }).sort((a, b) => a.ratio - b.ratio)
  }, [products])

  const chartData = data.slice(0, 20)

  const colorForRatio = (ratio: number) => {
    if (ratio >= 2) return 'var(--g)'
    if (ratio >= 1) return 'var(--y)'
    return 'var(--r)'
  }

  const handleExport = () => {
    const headers = ['Product', 'Dept', 'Stock Qty', 'Cost Price', 'Retail Price', 'Stock Value (Cost)', 'Stock Value (Retail)', 'Margin %']
    const rows = data.map(d => [d.name, d.dept, String(d.stockQty), String(d.costPrice), String(d.retailPrice), String(d.stockValueCost), String(d.stockValueRetail), `${d.margin.toFixed(1)}%`])
    exportCSV(headers, rows, 'inventory-valuation.csv')
  }

  const handlePrint = () => {
    const rows = data.map(d => `<tr><td>${d.name}</td><td>${d.dept}</td><td>${d.stockQty}</td><td>${fmt(d.costPrice)}</td><td>${fmt(d.retailPrice)}</td><td>${fmt(d.stockValueCost)}</td><td>${fmt(d.stockValueRetail)}</td><td>${d.margin.toFixed(1)}%</td></tr>`).join('')
    exportHTML('Inventory Valuation', `<table><thead><tr><th>Product</th><th>Dept</th><th>Stock</th><th>Cost</th><th>Retail</th><th>Value (Cost)</th><th>Value (Retail)</th><th>Margin</th></tr></thead><tbody>${rows}</tbody></table>`)
  }

  return (
    <div className="rep-page">
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button className="btn btn-sm btn-ghost" onClick={handleExport}>CSV</button>
        <button className="btn btn-sm btn-ghost" onClick={handlePrint}>PDF</button>
      </div>

      <div className="rep-chart">
        <h3>Stock Levels (Stock / Min Stock Ratio)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
            <XAxis type="number" tick={{ fontSize: 10, fill: cc.line }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: cc.line }} width={110} />
            <Tooltip contentStyle={{ background: cc.tooltipBg, border: '1px solid var(--bd)', borderRadius: 6, fontSize: 12, color: cc.tooltipText }} formatter={(v: any) => Number(v).toFixed(1)} />
            <Bar dataKey="ratio" radius={[0, 3, 3, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={colorForRatio(d.ratio)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="table-wrap">
        <table><thead><tr><th>Product</th><th>Dept</th><th>Stock Qty</th><th>Cost Price</th><th>Retail Price</th><th>Value (Cost)</th><th>Value (Retail)</th><th>Margin %</th></tr></thead><tbody>
          {data.map(d => <tr key={d.name}>
            <td>{d.name}</td><td>{d.dept}</td><td>{d.stockQty}</td><td>{fmt(d.costPrice)}</td><td>{fmt(d.retailPrice)}</td>
            <td>{fmt(d.stockValueCost)}</td><td>{fmt(d.stockValueRetail)}</td>
            <td><span style={{ color: d.margin >= 20 ? 'var(--g)' : d.margin >= 10 ? 'var(--y)' : 'var(--r)' }}>{d.margin.toFixed(1)}%</span></td>
          </tr>)}
          {data.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>No products</td></tr>}
        </tbody></table>
      </div>
    </div>
  )
}

function ShiftSummaryTab() {
  const theme = useUIStore(s => s.theme)
  const cc = getChartColors(theme)
  const { getShiftReport } = useShiftStore()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState('')
  const [report, setReport] = useState<ShiftReport | null>(null)

  useEffect(() => {
    ;(async () => {
      const all = await db.table('shifts').orderBy('opened_at').reverse().toArray() as Shift[]
      setShifts(all)
      if (all.length > 0) setSelectedShiftId(all[0].id)
    })()
  }, [])

  useEffect(() => {
    if (!selectedShiftId) return
    ;(async () => {
      try {
        const r = await getShiftReport(selectedShiftId)
        setReport(r)
      } catch { setReport(null) }
    })()
  }, [selectedShiftId, getShiftReport])

  const chartData = report?.hourly_breakdown || []

  const handlePrint = () => {
    if (!report) return
    const itemsRows = report.top_products.map((p: { name: string; qty: number; revenue: number }) => `<tr><td>${p.name}</td><td>${p.qty}</td><td>${fmt(p.revenue)}</td></tr>`).join('')
    exportHTML('Shift Summary', `
      <div style="margin-bottom:16px">
        <strong>Cashier:</strong> ${report.shift.cashier_name}<br>
        <strong>Opened:</strong> ${new Date(report.shift.opened_at).toLocaleString()}<br>
        <strong>Closed:</strong> ${report.shift.closed_at ? new Date(report.shift.closed_at).toLocaleString() : 'Open'}<br>
        <strong>Status:</strong> ${report.shift.status}<br>
        <strong>Transactions:</strong> ${report.transaction_count}<br>
        <strong>Revenue:</strong> ${fmt(report.total_revenue)}
      </div>
      <table><thead><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>${itemsRows}</tbody></table>
    `)
  }

  return (
    <div className="rep-page">
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ minWidth: 250 }}>
          <label>Select Shift</label>
          <select value={selectedShiftId} onChange={e => setSelectedShiftId(e.target.value)}>
            {shifts.map(s => (
              <option key={s.id} value={s.id}>
                {s.cashier_name} - {new Date(s.opened_at).toLocaleDateString()} ({s.status})
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={handlePrint}>PDF</button>
      </div>

      {report ? (
        <>
          <div className="rep-cards">
            <div className="rep-card"><div className="num">{report.transaction_count}</div><div className="label">Transactions</div></div>
            <div className="rep-card"><div className="num">{fmt(report.total_revenue)}</div><div className="label">Revenue</div></div>
            <div className="rep-card"><div className="num">{fmt(report.cash_total)}</div><div className="label">Cash</div></div>
            <div className="rep-card"><div className="num">{fmt(report.card_total)}</div><div className="label">Card</div></div>
            <div className="rep-card"><div className="num">{fmt(report.split_total)}</div><div className="label">Split</div></div>
            {report.shift.variance !== null && (
              <div className="rep-card"><div className="num" style={{ color: (report.shift.variance || 0) >= 0 ? 'var(--g)' : 'var(--r)' }}>{fmt(report.shift.variance)}</div><div className="label">Variance</div></div>
            )}
          </div>

          {chartData.length > 0 && (
            <div className="rep-chart">
              <h3>Hourly Breakdown</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: cc.line }} tickFormatter={(h: number) => `${h}:00`} />
                  <YAxis tick={{ fontSize: 10, fill: cc.line }} />
                  <Tooltip contentStyle={{ background: cc.tooltipBg, border: '1px solid var(--bd)', borderRadius: 6, fontSize: 12, color: cc.tooltipText }} />
                  <Bar dataKey="sales" fill="var(--g)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="rep-chart">
            <h3>Top Products</h3>
            <table><thead><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>
              {report.top_products.map((p: { name: string; qty: number; revenue: number }) => <tr key={p.name}><td>{p.name}</td><td>{p.qty}</td><td>{fmt(p.revenue)}</td></tr>)}
              {report.top_products.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>No products</td></tr>}
            </tbody></table>
          </div>

          <div className="rep-chart">
            <h3>Shift Details</h3>
            <div style={{ fontSize: '.75rem', color: 'var(--t2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><strong>Cashier:</strong> {report.shift.cashier_name}</div>
              <div><strong>Opened:</strong> {new Date(report.shift.opened_at).toLocaleString()}</div>
              <div><strong>Closed:</strong> {report.shift.closed_at ? new Date(report.shift.closed_at).toLocaleString() : '—'}</div>
              <div><strong>Opening Float:</strong> {fmt(report.shift.opening_float)}</div>
              <div><strong>Expected Cash:</strong> {report.shift.expected_cash !== null ? fmt(report.shift.expected_cash) : '—'}</div>
              <div><strong>Actual Cash:</strong> {report.shift.actual_cash !== null ? fmt(report.shift.actual_cash) : '—'}</div>
              <div><strong>Refunds:</strong> {report.refund_count} ({fmt(report.refund_total)})</div>
              <div><strong>Notes:</strong> {report.shift.notes || '—'}</div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)' }}>Select a shift to view report</div>
      )}
    </div>
  )
}

function CustomerSpendTab() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    ;(async () => {
      setCustomers(await db.customers.toArray())
      setInvoices(await db.invoices.toArray())
    })()
  }, [])

  const data = useMemo(() => {
    const completed = invoices.filter(i => i.status === 'completed')
    return customers.map(c => {
      const invs = completed.filter(i => i.customer_id === c.id)
      const totalSpent = invs.reduce((s, i) => s + i.total, 0)
      const visits = invs.length
      const avgBasket = visits > 0 ? totalSpent / visits : 0
      const lastVisit = invs.length > 0 ? Math.max(...invs.map(i => i.date)) : 0
      return { name: c.name, phone: c.phone, visits, totalSpent, avgBasket, lastVisit }
    }).sort((a, b) => b.totalSpent - a.totalSpent)
  }, [customers, invoices])

  const handleExport = () => {
    const headers = ['Customer', 'Phone', 'Visits', 'Total Spent', 'Avg Basket', 'Last Visit']
    const rows = data.map(d => [d.name, d.phone, String(d.visits), String(d.totalSpent), String(d.avgBasket), d.lastVisit > 0 ? new Date(d.lastVisit).toLocaleDateString() : ''])
    exportCSV(headers, rows, 'customer-spend.csv')
  }

  const handlePrint = () => {
    const rows = data.map(d => `<tr><td>${d.name}</td><td>${d.phone}</td><td>${d.visits}</td><td>${fmt(d.totalSpent)}</td><td>${fmt(d.avgBasket)}</td><td>${d.lastVisit > 0 ? new Date(d.lastVisit).toLocaleDateString() : '—'}</td></tr>`).join('')
    exportHTML('Customer Spend', `<table><thead><tr><th>Customer</th><th>Phone</th><th>Visits</th><th>Total Spent</th><th>Avg Basket</th><th>Last Visit</th></tr></thead><tbody>${rows}</tbody></table>`)
  }

  return (
    <div className="rep-page">
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button className="btn btn-sm btn-ghost" onClick={handleExport}>CSV</button>
        <button className="btn btn-sm btn-ghost" onClick={handlePrint}>PDF</button>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>Customer</th><th>Phone</th><th>Visits</th><th>Total Spent</th><th>Avg Basket</th><th>Last Visit</th></tr></thead><tbody>
          {data.map(d => <tr key={d.name}>
            <td>{d.name}</td><td>{d.phone}</td><td>{d.visits}</td><td>{fmt(d.totalSpent)}</td>
            <td>{fmt(d.avgBasket)}</td>
            <td>{d.lastVisit > 0 ? new Date(d.lastVisit).toLocaleDateString() : '—'}</td>
          </tr>)}
          {data.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>No customers</td></tr>}
        </tbody></table>
      </div>
    </div>
  )
}

function generateDeptReportHtml(invoices: Invoice[]): string {
  const deptMap = new Map<string, { qty: number; revenue: number }>()
  for (const inv of invoices) {
    for (const item of inv.items) {
      const d = deptMap.get(item.dept || 'Other') || { qty: 0, revenue: 0 }
      d.qty += item.qty
      d.revenue += item.total
      deptMap.set(item.dept || 'Other', d)
    }
  }
  const depts = Array.from(deptMap.entries()).sort((a, b) => b[1].revenue - a[1].revenue)
  const totalQty = depts.reduce((s, d) => s + d[1].qty, 0)
  const totalRev = depts.reduce((s, d) => s + d[1].revenue, 0)
  const invCount = invoices.length
  const rows = depts.map(([name, d]) =>
    `<tr><td>${name}</td><td style="text-align:right">${d.qty}</td><td style="text-align:right">${fmt(d.revenue)}</td><td style="text-align:right">${totalRev > 0 ? (d.revenue / totalRev * 100).toFixed(1) : '0.0'}%</td></tr>`
  ).join('')
  return `<table><thead><tr><th>Department</th><th style="text-align:right">Qty</th><th style="text-align:right">Revenue</th><th style="text-align:right">%</th></tr></thead><tbody>${rows}<tr style="font-weight:700;border-top:2px solid currentColor"><td>Total (${invCount} invoices)</td><td style="text-align:right">${totalQty}</td><td style="text-align:right">${fmt(totalRev)}</td><td style="text-align:right">100%</td></tr></tbody></table>`
}

export function ReportsPage() {
  const reportsTab = useUIStore(s => s.reportsTab)
  const setReportsTab = useUIStore(s => s.setReportsTab)
  const [zDateFrom, setZDateFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [zDateTo, setZDateTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [showZPicker, setShowZPicker] = useState(false)

  const handleDailyReport = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const invoices = await db.invoices.filter(i => i.status === 'completed' && i.dateStr === today).toArray()
    const html = generateDeptReportHtml(invoices)
    exportHTML(`Daily Report – ${today}`, html)
  }

  const handleZReport = async () => {
    const invoices = await db.invoices.filter(i => i.status === 'completed' && i.dateStr >= zDateFrom && i.dateStr <= zDateTo).toArray()
    const html = generateDeptReportHtml(invoices)
    exportHTML(`Z Report – ${zDateFrom} to ${zDateTo}`, html)
  }

  const tabs: { id: TabKey; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sales', label: 'Sales Summary' },
    { id: 'products', label: 'Product Performance' },
    { id: 'invoices', label: 'Invoice Detail' },
    { id: 'inventory', label: 'Inventory Valuation' },
    { id: 'shifts', label: 'Shift Summary' },
    { id: 'customers', label: 'Customer Spend' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--bd)', flexWrap: 'wrap', flexShrink: 0, background: 'var(--s1)', alignItems: 'center' }}>
        {tabs.map(t => (
          <button key={t.id}
            className={`btn btn-sm ${reportsTab === t.id ? 'btn-g' : 'btn-ghost'}`}
            onClick={() => setReportsTab(t.id)}
            style={{
              background: reportsTab === t.id ? 'rgba(0,214,143,.08)' : 'transparent',
              color: reportsTab === t.id ? 'var(--g)' : 'var(--t2)',
              border: `1px solid ${reportsTab === t.id ? 'var(--g2)' : 'var(--bd)'}`,
            }}>
            {t.label}
          </button>
        ))}
        <div className="spacer" />
        <button className="btn btn-sm btn-ghost" onClick={handleDailyReport}>📋 Daily Report</button>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowZPicker(!showZPicker)}>📊 Z Report</button>
          {showZPicker && (
            <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 6, padding: 8, display: 'flex', gap: 6, alignItems: 'center', zIndex: 50, marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,.15)' }}>
              <label style={{ fontSize: '.65rem', color: 'var(--t2)' }}>From</label>
              <input type="date" value={zDateFrom} onChange={e => setZDateFrom(e.target.value)} style={{ fontSize: '.7rem', padding: '3px 6px', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s2)', color: 'var(--t)' }} />
              <label style={{ fontSize: '.65rem', color: 'var(--t2)' }}>To</label>
              <input type="date" value={zDateTo} onChange={e => setZDateTo(e.target.value)} style={{ fontSize: '.7rem', padding: '3px 6px', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s2)', color: 'var(--t)' }} />
              <button className="btn btn-sm btn-g" onClick={() => { handleZReport(); setShowZPicker(false) }}>Run</button>
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {reportsTab === 'dashboard' && <DashboardPage />}
        {reportsTab === 'sales' && <SalesTab />}
        {reportsTab === 'products' && <ProductPerformanceTab />}
        {reportsTab === 'invoices' && <InvoiceDetailTab />}
        {reportsTab === 'inventory' && <InventoryValuationTab />}
        {reportsTab === 'shifts' && <ShiftSummaryTab />}
        {reportsTab === 'customers' && <CustomerSpendTab />}
      </div>
    </div>
  )
}
