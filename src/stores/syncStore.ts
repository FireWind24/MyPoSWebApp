import { create } from 'zustand'

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'error'

interface SyncState {
  status: SyncStatus
  queueDepth: number
  lastSyncAt: number | null
  heldSales: import('@shared/types').CartItem[][] // up to 5 held sales
  setStatus: (s: SyncStatus) => void
  setQueueDepth: (n: number) => void
  setLastSyncAt: (t: number) => void
  holdSale: (items: import('@shared/types').CartItem[]) => void
  recallSale: (index: number) => import('@shared/types').CartItem[] | null
  clearHeldSale: (index: number) => void
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'offline',
  queueDepth: 0,
  lastSyncAt: null,
  heldSales: [],

  setStatus: (status) => set({ status }),
  setQueueDepth: (queueDepth) => set({ queueDepth }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),

  holdSale: (items) => set((state) => {
    const held = [...state.heldSales, items].slice(-5)
    return { heldSales: held }
  }),

  recallSale: (index) => {
    const held = get().heldSales[index]
    if (!held) return null
    return held
  },

  clearHeldSale: (index) => set((state) => ({
    heldSales: state.heldSales.filter((_, i) => i !== index)
  })),
}))
