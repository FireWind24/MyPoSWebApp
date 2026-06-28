import { useState, useEffect } from 'react'
import { useShiftStore } from '@stores/shiftStore'
import { useUIStore } from '@stores/uiStore'
import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'
import { fmt, formatDateTime } from '@shared/utils'
import type { ShiftReport } from '@shared/types'

export function ShiftIndicator() {
  const activeShift = useShiftStore(s => s.activeShift)

  if (!activeShift) return null

  return (
    <div
      title={`Shift open since ${formatDateTime(activeShift.opened_at)}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '0 10px',
        borderLeft: '1px solid var(--bd)',
        height: 48,
        cursor: 'default',
      }}
    >
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: 'var(--g)',
        boxShadow: '0 0 6px var(--g)',
        animation: 'pulse-dot 1.5s ease-in-out infinite',
      }} />
      <span style={{ fontSize: 8, color: 'var(--t3)', fontWeight: 700, letterSpacing: '.5px' }}>
        SHIFT OPEN
      </span>
      <span style={{ fontSize: 8, color: 'var(--t2)', marginLeft: 4 }}>
        {fmt(activeShift.opening_float)}
      </span>
    </div>
  )
}

export function ShiftManagement() {
  const activeShift = useShiftStore(s => s.activeShift)
  const loadActiveShift = useShiftStore(s => s.loadActiveShift)
  const openShift = useShiftStore(s => s.openShift)
  const closeShift = useShiftStore(s => s.closeShift)
  const showToast = useUIStore(s => s.showToast)


  const [openingFloat, setOpeningFloat] = useState(0)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [actualCash, setActualCash] = useState(0)
  const [closeNotes, setCloseNotes] = useState('')
  const [report, setReport] = useState<ShiftReport | null>(null)
  const [showOpenPanel, setShowOpenPanel] = useState(false)
  const [userStr] = useState(() => sessionStorage.getItem('pos_user'))

  useEffect(() => {
    loadActiveShift('')
  }, [loadActiveShift])

  const handleOpenShift = async () => {
    if (!userStr) return
    const u = JSON.parse(userStr)
    try {
      await openShift(u.id || u.name, u.name, openingFloat)
      showToast('Shift opened', 'ok')
      setShowOpenPanel(false)
    } catch {
      showToast('Failed to open shift', 'err')
    }
  }

  const handleCloseShift = async () => {
    try {
      const r = await closeShift(actualCash, closeNotes)
      setReport(r)
      setShowCloseModal(false)
      showToast('Shift closed', 'ok')
    } catch {
      showToast('Failed to close shift', 'err')
    }
  }

  if (report) {
    return (
      <div className="section">
        <h3>Shift Report</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div className="field"><span className="label">Opened</span><span className="value">{formatDateTime(report.shift.opened_at)}</span></div>
          <div className="field"><span className="label">Closed</span><span className="value">{report.shift.closed_at ? formatDateTime(report.shift.closed_at) : '—'}</span></div>
          <div className="field"><span className="label">Cashier</span><span className="value">{report.shift.cashier_name}</span></div>
          <div className="field"><span className="label">Opening Float</span><span className="value">{fmt(report.shift.opening_float)}</span></div>
          <div className="field"><span className="label">Expected Cash</span><span className="value">{fmt(report.shift.expected_cash || 0)}</span></div>
          <div className="field"><span className="label">Actual Cash</span><span className="value">{fmt(report.shift.actual_cash || 0)}</span></div>
          <div className="field"><span className="label">Variance</span><span className="value" style={{ color: (report.shift.variance || 0) >= 0 ? 'var(--g)' : 'var(--r)' }}>
            {(report.shift.variance || 0) >= 0 ? '+' : ''}{fmt(report.shift.variance || 0)}
          </span></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div className="rep-card"><div className="num">{report.transaction_count}</div><div className="label">Transactions</div></div>
          <div className="rep-card"><div className="num">{fmt(report.total_revenue)}</div><div className="label">Total Revenue</div></div>
          <div className="rep-card"><div className="num">{fmt(report.cash_total)}</div><div className="label">Cash Sales</div></div>
          <div className="rep-card"><div className="num">{fmt(report.card_total)}</div><div className="label">Card Sales</div></div>
          <div className="rep-card"><div className="num">{fmt(report.refund_total)}</div><div className="label">Refunds</div></div>
          <div className="rep-card"><div className="num">{report.refund_count}</div><div className="label">Refund Count</div></div>
        </div>

        {report.top_products.length > 0 && (
          <>
            <h4>Top Products</h4>
            <table>
              <thead><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead>
              <tbody>
                {report.top_products.map(p => (
                  <tr key={p.name}><td>{p.name}</td><td>{p.qty}</td><td>{fmt(p.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <Button variant="primary" size="sm" onClick={() => setReport(null)} style={{ marginTop: 12 }}>
          Dismiss
        </Button>
      </div>
    )
  }

  if (!activeShift) {
    return (
      <div className="section">
        <h3>Shift Management</h3>
        <p style={{ color: 'var(--t3)', marginBottom: 12 }}>No active shift. Open a shift to start recording transactions.</p>
        {showOpenPanel ? (
          <div style={{ maxWidth: 300 }}>
            <div className="form-group">
              <label>Opening Float</label>
              <input type="number" value={openingFloat || ''} onChange={e => setOpeningFloat(parseFloat(e.target.value) || 0)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="primary" size="sm" onClick={handleOpenShift}>Open Shift</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowOpenPanel(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="primary" size="sm" onClick={() => setShowOpenPanel(true)}>Open Shift</Button>
        )}
      </div>
    )
  }

  return (
    <div className="section">
      <h3>Active Shift</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div className="field"><span className="label">Opened</span><span className="value">{formatDateTime(activeShift.opened_at)}</span></div>
        <div className="field"><span className="label">Cashier</span><span className="value">{activeShift.cashier_name}</span></div>
        <div className="field"><span className="label">Opening Float</span><span className="value">{fmt(activeShift.opening_float)}</span></div>
      </div>

      <Button variant="danger" size="sm" onClick={() => {
        setActualCash(0)
        setCloseNotes('')
        setShowCloseModal(true)
      }}>
        Close Shift
      </Button>

      <Modal open={showCloseModal} onClose={() => setShowCloseModal(false)} title="Close Shift">
        <div className="form-group">
          <label>Actual Cash in Drawer</label>
          <input type="number" value={actualCash || ''} onChange={e => setActualCash(parseFloat(e.target.value) || 0)} autoFocus />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <input value={closeNotes} onChange={e => setCloseNotes(e.target.value)} placeholder="Optional notes..." />
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setShowCloseModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCloseShift}>Close Shift & Generate Report</Button>
        </div>
      </Modal>
    </div>
  )
}
