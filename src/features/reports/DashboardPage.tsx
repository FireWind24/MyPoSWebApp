import { useState, useEffect, useMemo } from 'react'
import { db } from '@db/schema'
import { fmt } from '@shared/utils'
import { useUIStore } from '@stores/uiStore'
import { useShiftStore } from '@stores/shiftStore'
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import type { PieLabelRenderProps } from 'recharts'

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

const COLORS = ['#00d68f', '#4d9eff', '#ffa941', '#f05252', '#a855f7', '#06b6d4', '#f97316', '#84cc16']

export function DashboardPage() {
  const theme = useUIStore(s => s.theme)
  const activeShift = useShiftStore(s => s.activeShift)
  const [todayInvs, setTodayInvs] = useState<any[]>([])
  const [yesterdayInvs, setYesterdayInvs] = useState<any[]>([])
  const [lastWeekInvs, setLastWeekInvs] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [allInvs, setAllInvs] = useState<any[]>([])

  const now = new Date()
  const todayStr = dateStr(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = dateStr(yesterday)
  const lastWeek = new Date(now)
  lastWeek.setDate(lastWeek.getDate() - 7)
  const lastWeekStr = dateStr(lastWeek)

  const tenDaysAgo = new Date(now)
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

  useEffect(() => {
    ;(async () => {
      const all = await db.invoices.toArray()
      const comp = all.filter(i => i.status === 'completed')
      setAllInvs(comp)
      setTodayInvs(comp.filter(i => i.dateStr === todayStr))
      setYesterdayInvs(comp.filter(i => i.dateStr === yesterdayStr))
      setLastWeekInvs(comp.filter(i => i.dateStr === lastWeekStr))
      setProducts(await db.products.toArray())
    })()
  }, [])

  const todayRevenue = todayInvs.reduce((s, i) => s + i.total, 0)
  const yesterdayRevenue = yesterdayInvs.reduce((s, i) => s + i.total, 0)
  const lastWeekRevenue = lastWeekInvs.reduce((s, i) => s + i.total, 0)

  const hourlyData = useMemo(() => {
    const map = new Map<number, number>()
    for (let h = 0; h < 24; h++) map.set(h, 0)
    for (const inv of todayInvs) {
      const h = new Date(inv.date).getHours()
      map.set(h, (map.get(h) || 0) + inv.total)
    }
    return Array.from(map.entries()).map(([hour, sales]) => ({ hour: `${hour}:00`, sales }))
  }, [todayInvs])

  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>()
    for (const inv of todayInvs) {
      for (const item of inv.items) {
        const e = map.get(item.name) || { qty: 0, revenue: 0 }
        e.qty += item.qty
        e.revenue += item.total
        map.set(item.name, e)
      }
    }
    return Array.from(map.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [todayInvs])

  const lowStockCount = products.filter(p => p.min_stock && p.stock <= p.min_stock).length

  const paymentMethodData = useMemo(() => {
    const cash = todayInvs.filter(i => i.payment_method === 'cash').reduce((s, i) => s + i.total, 0)
    const card = todayInvs.filter(i => i.payment_method === 'card').reduce((s, i) => s + i.total, 0)
    const split = todayInvs.filter(i => i.payment_method === 'split').reduce((s, i) => s + i.total, 0)
    return [
      { name: 'Cash', value: cash },
      { name: 'Card', value: card },
      { name: 'Split', value: split },
    ].filter(d => d.value > 0)
  }, [todayInvs])

  const currentDayAvg = todayInvs.length > 0 ? todayRevenue / todayInvs.length : 0
  const thirtyDayInvs = allInvs.filter(i => i.date >= tenDaysAgo.getTime())
  const rollingAvg = thirtyDayInvs.length > 0
    ? thirtyDayInvs.reduce((s, i) => s + i.total, 0) / thirtyDayInvs.length
    : 0

  const activeShiftData = activeShift ? {
    cashier: activeShift.cashier_name,
    opened: new Date(activeShift.opened_at).toLocaleTimeString(),
    count: todayInvs.length,
    revenue: todayRevenue,
  } : null

  const chartColors = {
    line: theme === 'dark' ? 'var(--t3)' : 'var(--t2)',
    tooltipBg: theme === 'dark' ? 'var(--s2)' : 'var(--s1)',
    tooltipText: theme === 'dark' ? 'var(--t)' : 'var(--t)',
    grid: theme === 'dark' ? '#33333f' : '#d4d4db',
  }

  function KpiCard({ label, value, prev, format }: { label: string; value: number; prev: number; format?: (v: number) => string }) {
    const diff = prev > 0 ? ((value - prev) / prev) * 100 : value > 0 ? 100 : 0
    const isUp = diff >= 0
    const f = format || ((v: number) => fmt(v))
    return (
      <div className="rep-card">
        <div className="num">{f(value)}</div>
        <div className="label">{label}</div>
        <div style={{ fontSize: '.6rem', marginTop: 4, color: isUp ? 'var(--g)' : 'var(--r)' }}>
          {isUp ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% vs yesterday
        </div>
      </div>
    )
  }

  return (
    <div className="dash-grid">
      <div className="dash-kpis">
        <KpiCard label="Today's Revenue" value={todayRevenue} prev={yesterdayRevenue} />
        <KpiCard label="Yesterday's Revenue" value={yesterdayRevenue} prev={lastWeekRevenue} format={v => fmt(v)} />
        <KpiCard label="Transactions Today" value={todayInvs.length} prev={yesterdayInvs.length} format={v => String(v)} />
        <div className="rep-card" style={{ position: 'relative' }}>
          <div className="num">{fmt(currentDayAvg)}</div>
          <div className="label">Avg Transaction Today</div>
          <div style={{ fontSize: '.55rem', marginTop: 2, color: 'var(--t3)' }}>
            30d rolling: {fmt(rollingAvg)}
          </div>
        </div>
      </div>

      <div className="dash-two-col">
        <div className="rep-chart">
          <h3>Hourly Sales Today</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: chartColors.line }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: chartColors.line }} />
              <Tooltip
                contentStyle={{ background: chartColors.tooltipBg, border: '1px solid var(--bd)', borderRadius: 6, fontSize: 12, color: chartColors.tooltipText }}
              />
              <Line type="monotone" dataKey="sales" stroke="var(--g)" strokeWidth={2} dot={{ fill: 'var(--g)', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rep-chart">
          <h3>Payment Methods</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={paymentMethodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }: PieLabelRenderProps) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {paymentMethodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: chartColors.tooltipBg, border: '1px solid var(--bd)', borderRadius: 6, fontSize: 12, color: chartColors.tooltipText }} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dash-two-col">
        <div className="rep-chart">
          <h3>Top 5 Products Today</h3>
          {topProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)' }}>No sales today</div>
          ) : (
            <table>
              <thead>
                <tr><th>#</th><th>Product</th><th>Units</th><th>Revenue</th></tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.name}>
                    <td>{i + 1}</td>
                    <td>{p.name}</td>
                    <td>{p.qty}</td>
                    <td>{fmt(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rep-chart">
          <h3>Stock & Shift Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 8 }}>
            <div>
              <span style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--t3)' }}>Low Stock Items </span>
              <span className={`badge ${lowStockCount > 5 ? 'badge-red' : lowStockCount > 0 ? 'badge-yellow' : 'badge-green'}`}>
                {lowStockCount}
              </span>
            </div>
            {activeShiftData ? (
              <div style={{ fontSize: '.7rem', color: 'var(--t2)' }}>
                <div><strong>Cashier:</strong> {activeShiftData.cashier}</div>
                <div><strong>Opened:</strong> {activeShiftData.opened}</div>
                <div><strong>Sales:</strong> {activeShiftData.count}</div>
                <div><strong>Revenue:</strong> {fmt(activeShiftData.revenue)}</div>
              </div>
            ) : (
              <div style={{ fontSize: '.7rem', color: 'var(--t3)' }}>No active shift</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
