import { useSyncStore } from '@stores/syncStore'
import type { SyncStatus } from '@stores/syncStore'

const dotColors: Record<SyncStatus, string> = {
  synced: 'var(--g)',
  pending: 'var(--y)',
  offline: 'var(--r)',
  error: 'var(--r)',
}

const dotLabels: Record<SyncStatus, string> = {
  synced: 'All synced',
  pending: 'Sync pending',
  offline: 'Offline',
  error: 'Sync error',
}

export function SyncIndicator() {
  const status = useSyncStore(s => s.status)
  const queueDepth = useSyncStore(s => s.queueDepth)
  const lastSyncAt = useSyncStore(s => s.lastSyncAt)

  const color = dotColors[status]
  const label = dotLabels[status]

  return (
    <div
      title={`${label}${queueDepth > 0 ? ` (${queueDepth} pending)` : ''}${lastSyncAt ? ` · Last sync: ${new Date(lastSyncAt).toLocaleTimeString()}` : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 12px',
        borderLeft: '1px solid var(--bd)',
        minHeight: 54,
        cursor: 'default',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
          transition: 'all 0.3s ease',
          animation: status === 'pending' ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '.5px', whiteSpace: 'nowrap' }}>
        {status === 'synced' ? 'SYNCED' : status === 'pending' ? `${queueDepth} PENDING` : status === 'offline' ? 'OFFLINE' : 'ERROR'}
      </span>
    </div>
  )
}
