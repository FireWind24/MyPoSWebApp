import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TabId } from '@shared/types'

export type ReportsTab = 'dashboard' | 'sales' | 'products' | 'invoices' | 'inventory' | 'shifts' | 'customers'

interface UIState {
  tab: TabId
  theme: 'dark' | 'light'
  toast: { msg: string; type: 'ok' | 'err' | 'inf' } | null
  confirm: { msg: string; onOk: () => void } | null
  showShortcuts: boolean
  showCheckout: boolean
  showInvForm: boolean
  editingProductId: string | null
  customerSearch: string
  currentDept: string
  reportsTab: ReportsTab
  setTab: (t: TabId) => void
  setCurrentDept: (d: string) => void
  toggleTheme: () => void
  setTheme: (t: 'dark' | 'light') => void
  showToast: (msg: string, type: 'ok' | 'err' | 'inf') => void
  hideToast: () => void
  showConfirm: (msg: string, onOk: () => void) => void
  hideConfirm: () => void
  setShowShortcuts: (v: boolean) => void
  setShowCheckout: (v: boolean) => void
  setShowInvForm: (v: boolean) => void
  setEditingProductId: (id: string | null) => void
  setCustomerSearch: (v: string) => void
  setReportsTab: (t: ReportsTab) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      tab: 'pos',
      theme: 'dark',
      toast: null,
      confirm: null,
      showShortcuts: false,
      showCheckout: false,
      showInvForm: false,
      editingProductId: null,
      customerSearch: '',
      currentDept: '',
      reportsTab: 'dashboard',
      setTab: (t: TabId) => set({ tab: t }),
      setCurrentDept: (d: string) => set({ currentDept: d }),
      toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (t: 'dark' | 'light') => set({ theme: t }),
      showToast: (msg: string, type: 'ok' | 'err' | 'inf') => set({ toast: { msg, type } }),
      hideToast: () => set({ toast: null }),
      showConfirm: (msg: string, onOk: () => void) => set({ confirm: { msg, onOk } }),
      hideConfirm: () => set({ confirm: null }),
      setShowShortcuts: (v: boolean) => set({ showShortcuts: v }),
      setShowCheckout: (v: boolean) => set({ showCheckout: v }),
      setShowInvForm: (v: boolean) => set({ showInvForm: v }),
      setEditingProductId: (id: string | null) => set({ editingProductId: id }),
      setCustomerSearch: (v: string) => set({ customerSearch: v }),
      setReportsTab: (t: ReportsTab) => set({ reportsTab: t }),
    }),
    { name: 'pos-ui' }
  )
)
