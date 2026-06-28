import { useState, useEffect } from 'react'
import { db } from '@db/schema'
import { formatDateTime } from '@shared/utils'
import type { AuditLog } from '@shared/types'

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [actionFilter, setActionFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [fromDate, setFromDate] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      const all = await db.auditLogs
        .orderBy('created_at')
        .reverse()
        .toArray()
      setLogs(all)
    } catch { }
  }

  const filtered = logs.filter(log => {
    if (actionFilter && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) return false
    if (userFilter && !log.user_id.toLowerCase().includes(userFilter.toLowerCase())) return false
    const d = new Date(log.created_at).toISOString().slice(0, 10)
    if (fromDate && d < fromDate) return false
    if (toDate && d > toDate) return false
    return true
  })

  return (
    <div className="section">
      <h3>Audit Log</h3>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="form-group" style={{ minWidth: 150 }}>
          <label>Action</label>
          <input value={actionFilter} onChange={e => setActionFilter(e.target.value)} placeholder="Filter action..." />
        </div>
        <div className="form-group" style={{ minWidth: 150 }}>
          <label>User</label>
          <input value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="Filter user..." />
        </div>
        <div className="form-group">
          <label>From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadLogs}>Refresh</button>
      </div>

      <div className="inv-table-wrap" style={{ maxHeight: 500 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
              <th>Old Value</th>
              <th>New Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => (
              <tr key={log.id}>
                <td style={{ fontSize: '.6rem', whiteSpace: 'nowrap' }}>{formatDateTime(log.created_at)}</td>
                <td style={{ fontSize: '.6rem' }}>{log.user_id}</td>
                <td><span className="badge badge-blue">{log.action}</span></td>
                <td style={{ fontSize: '.6rem' }}>{log.entity_type}</td>
                <td style={{ fontSize: '.6rem', fontFamily: 'var(--mono)' }}>{log.entity_id.slice(-8)}</td>
                <td style={{ fontSize: '.6rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.old_value ? JSON.stringify(log.old_value).slice(0, 50) : '—'}
                </td>
                <td style={{ fontSize: '.6rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.new_value ? JSON.stringify(log.new_value).slice(0, 50) : '—'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>No audit entries found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
