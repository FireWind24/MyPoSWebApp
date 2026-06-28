import { supabase } from '@services/supabase'
import { useSyncStore } from '@stores/syncStore'

const SYNC_INTERVAL = 30_000
const MAX_RETRIES = 5

interface PendingChange {
  id: string
  table: string
  action: 'upsert' | 'delete'
  payload: any
  retries: number
}

let syncTimer: ReturnType<typeof setInterval> | null = null
let pendingChanges: PendingChange[] = []

function getStore(): ReturnType<typeof useSyncStore.getState> {
  return useSyncStore.getState()
}

export function markDirty(table: string, action: 'upsert' | 'delete', payload: any) {
  const id = `${table}_${payload.id || Date.now()}_${Date.now()}`
  const existing = pendingChanges.findIndex(c => c.table === table && c.payload.id === payload.id)
  if (existing >= 0) {
    pendingChanges[existing] = { id, table, action, payload, retries: 0 }
  } else {
    pendingChanges.push({ id, table, action, payload, retries: 0 })
  }
  getStore().setQueueDepth(pendingChanges.length)
  getStore().setStatus('pending')
}

async function processQueue() {
  if (pendingChanges.length === 0) {
    getStore().setStatus('synced')
    return
  }

  const user = supabase ? await supabase.auth.getUser() : null
  if (!user?.data?.user) {
    getStore().setStatus('offline')
    return
  }

  const batch = [...pendingChanges]
  const failed: PendingChange[] = []

  for (const change of batch) {
    try {
      if (change.action === 'upsert') {
        const { error } = await supabase!
          .from(change.table)
          .upsert({ ...change.payload, user_id: user.data.user.id })
        if (error) throw error
      } else if (change.action === 'delete') {
        const pk = change.table === 'config' ? 'key' : 'id'
        const { error } = await supabase!
          .from(change.table)
          .delete()
          .eq(pk, change.payload.id)
        if (error) throw error
      }
    } catch (err) {
      change.retries++
      if (change.retries < MAX_RETRIES) {
        failed.push(change)
      }
    }
  }

  pendingChanges = failed
  getStore().setQueueDepth(pendingChanges.length)
  getStore().setLastSyncAt(Date.now())

  if (pendingChanges.length === 0) {
    getStore().setStatus('synced')
  }
}

function checkConnectivity() {
  const online = navigator.onLine
  const hasSupabase = !!supabase
  if (!online || !hasSupabase) {
    getStore().setStatus('offline')
  } else if (pendingChanges.length > 0) {
    getStore().setStatus('pending')
  } else {
    getStore().setStatus('synced')
  }
}

export function startSyncEngine() {
  checkConnectivity()
  processQueue()

  syncTimer = setInterval(() => {
    checkConnectivity()
    processQueue()
  }, SYNC_INTERVAL)

  window.addEventListener('online', () => {
    getStore().setStatus('pending')
    processQueue()
  })
  window.addEventListener('offline', () => {
    getStore().setStatus('offline')
  })
}

export function stopSyncEngine() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}
