import { useState, useEffect, useCallback, useRef } from 'react'
import { AuthPage } from '@features/auth/AuthPage'
import { PinLogin } from '@features/auth/PinLogin'
import { RegisterPage } from '@features/pos/RegisterPage'
import { InventoryPage } from '@features/inventory/InventoryPage'
import { InvoicesPage } from '@features/invoices/InvoicesPage'
import { ReportsPage } from '@features/reports/ReportsPage'
import { SettingsPage } from '@features/settings/SettingsPage'
import { ToastContainer } from '@shared/ui/Toast'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { db } from '@db/schema'
import { SyncIndicator } from '@shared/ui/SyncIndicator'
import { ShiftIndicator } from '@features/shifts/ShiftManagement'
import { useUIStore } from '@stores/uiStore'
import { useCartStore } from '@stores/cartStore'
import { useSyncStore } from '@stores/syncStore'
import { useShiftStore } from '@stores/shiftStore'
import { startSyncEngine } from '@services/syncEngine'
import { loadPrinterConfig } from '@services/printer'
import type { TabId } from '@shared/types'

type UserInfo = {
  id: string
  store_id?: string
  name: string
  role: 'owner' | 'manager' | 'cashier' | 'stock_clerk' | 'viewer'
  pin?: string
  active?: boolean
} | null

function App() {
  const [user, setUser] = useState<UserInfo>(null)
  const [showPinLogin, setShowPinLogin] = useState(false)
  const [clock, setClock] = useState('')
  const [todayStats, setTodayStats] = useState({ sales: 0, revenue: 0 })
  const [lowStockCount, setLowStockCount] = useState(0)
  const [storeName, setStoreName] = useState('My Store')
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tab = useUIStore(s => s.tab)
  const setTab = useUIStore(s => s.setTab)
  const theme = useUIStore(s => s.theme)
  const toggleTheme = useUIStore(s => s.toggleTheme)
  const showToast = useUIStore(s => s.showToast)
  const setShowShortcuts = useUIStore(s => s.setShowShortcuts)
  const showShortcuts = useUIStore(s => s.showShortcuts)
  const clearCart = useCartStore(s => s.clearCart)
  const holdSale = useSyncStore(s => s.holdSale)
  const loadActiveShift = useShiftStore(s => s.loadActiveShift)

  useEffect(() => {
    document.documentElement.className = theme
  }, [theme])

  useEffect(() => {
    startSyncEngine()
    loadPrinterConfig()
  }, [])

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const loadStats = async () => {
      try {
        const stores = await db.stores.toArray()
        if (stores.length) setStoreName(stores[0].name)
        const today = new Date().toISOString().slice(0, 10)
        const todayInvs = await db.invoices.filter(i => i.dateStr === today).toArray()
        setTodayStats({
          sales: todayInvs.length,
          revenue: todayInvs.reduce((s, i) => s + i.total, 0),
        })
        const all = await db.products.toArray()
        const low = all.filter(p => p.min_stock && p.stock <= p.min_stock).length
        setLowStockCount(low)
      } catch { }
    }
    loadStats()
    const id = setInterval(loadStats, 30000)
    return () => clearInterval(id)
  }, [])

  // Auto-lock inactivity timer (5 min)
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    if (user?.pin) {
      inactivityTimer.current = setTimeout(() => {
        setShowPinLogin(true)
      }, 5 * 60 * 1000)
    }
  }, [user])

  useEffect(() => {
    if (!user?.pin) return
    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart']
    const handler = () => resetInactivityTimer()
    events.forEach(ev => window.addEventListener(ev, handler))
    resetInactivityTimer()
    return () => {
      events.forEach(ev => window.removeEventListener(ev, handler))
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    }
  }, [user, resetInactivityTimer])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'

      // F1: Shortcuts
      if (e.key === 'F1') { e.preventDefault(); setShowShortcuts(!showShortcuts); return }

      // F2: New sale (works even in inputs)
      if (e.key === 'F2') { e.preventDefault(); clearCart(); showToast('New sale started', 'inf'); return }
      // F3: Focus first empty product name cell
      if (e.key === 'F3' && !isInput) {
        e.preventDefault()
        const firstEmpty = document.querySelector<HTMLInputElement>('.grid-table input.cell-input')
        firstEmpty?.focus()
        return
      }
      // Ctrl+P: Print receipt
      if (e.ctrlKey && e.key === 'p' && !isInput) {
        e.preventDefault()
        const items = useCartStore.getState().items
        if (items.length > 0) {
          import('@services/printer').then(async ({ printViaBrowser, generateSaleReceipt }) => {
            const total = items.reduce((s, i) => s + i.total, 0)
            const stores = await import('@db/schema').then(m => m.db.stores.toArray())
            const store = stores.length ? stores[0] : undefined
            const { notes, customerName } = useCartStore.getState()
            const lines = generateSaleReceipt(items, total, { notes, customerName, store: store ? { name: store.name, address: store.address, phone: store.phone, receipt_footer: store.receipt_footer } : undefined })
            printViaBrowser(lines, 'Sale Receipt')
            useUIStore.getState().showToast('Receipt sent to printer', 'ok')
          })
        }
        return
      }

      // Shift+Enter: Initiate checkout (works even in inputs)
      if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey) {
        e.preventDefault()
        const items = useCartStore.getState().items
        if (items.length > 0) useUIStore.getState().setShowCheckout(true)
        return
      }

      // Tab shortcuts: F4-F8 or 1-5
      if (e.key === 'F4') { e.preventDefault(); setTab('pos'); return }
      if (e.key === 'F5') { e.preventDefault(); setTab('inv'); return }
      if (e.key === 'F6') { e.preventDefault(); setTab('invl'); return }
      if (e.key === 'F7') { e.preventDefault(); setTab('rep'); return }
      if (e.key === 'F8') { e.preventDefault(); setTab('data'); return }

      if (!isInput) {
        if (e.key >= '1' && e.key <= '5') {
          const map: Record<string, TabId> = { '1': 'pos', '2': 'inv', '3': 'invl', '4': 'rep', '5': 'data' }
          if (map[e.key]) setTab(map[e.key]); return
        }
      }

      // Ctrl+ shortcuts (work anywhere)
      if (e.ctrlKey && !e.shiftKey && e.key === 'h') { e.preventDefault(); holdSale(useCartStore.getState().items); clearCart(); showToast('Sale held', 'inf'); return }
      if (e.ctrlKey && !e.shiftKey && e.key === 'd') { e.preventDefault(); document.querySelector<HTMLInputElement>('.disc-input input')?.focus(); return }
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); const items = useCartStore.getState().items; if (items.length) useCartStore.getState().removeItem(items.length - 1); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'v') {
        e.preventDefault()
        showToast('Void requires manager PIN', 'inf')
        return
      }

      // Escape
      if (e.key === 'Escape') {
        if (useUIStore.getState().showCheckout) useUIStore.getState().setShowCheckout(false)
        if (useUIStore.getState().showShortcuts) useUIStore.getState().setShowShortcuts(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showShortcuts, setShowShortcuts, setTab, clearCart, holdSale, showToast])

  const handleLogin = useCallback((u: { id: string; name: string; role: 'owner' | 'manager' | 'cashier' | 'stock_clerk' | 'viewer'; pin?: string; store_id?: string; active?: boolean }) => {
    const userInfo: UserInfo = {
      id: u.id,
      name: u.name,
      role: u.role,
      pin: u.pin,
      store_id: u.store_id || '',
      active: u.active ?? true,
    }
    setUser(userInfo)
    sessionStorage.setItem('pos_user', JSON.stringify(userInfo))
    showToast(`Welcome, ${u.name}!`, 'ok')
    loadActiveShift(u.store_id || '')
    if (u.pin) {
      setShowPinLogin(true)
    }
  }, [showToast, loadActiveShift])

  const handleLogout = useCallback(() => {
    setUser(null)
    setShowPinLogin(false)
    sessionStorage.removeItem('pos_user')
  }, [])

  const handlePinSuccess = useCallback(() => {
    setShowPinLogin(false)
    resetInactivityTimer()
  }, [resetInactivityTimer])

  if (!user) {
    return (
      <>
        <AuthPage onLogin={handleLogin} />
        <ToastContainer />
      </>
    )
  }

  // Show PIN login screen if user has PIN and needs to unlock
  if (showPinLogin && user.pin) {
    return (
      <PinLogin
        user={user as any}
        onSuccess={handlePinSuccess}
        onLogout={handleLogout}
      />
    )
  }

  const tabs: { id: TabId; label: string; key: string }[] = [
    { id: 'pos', label: 'Register', key: 'F4' },
    { id: 'inv', label: 'Inventory', key: 'F5' },
    { id: 'invl', label: 'Invoices', key: 'F6' },
    { id: 'rep', label: 'Reports', key: 'F7' },
    { id: 'data', label: 'Settings', key: 'F8' },
  ]

  const renderTab = () => {
    switch (tab) {
      case 'pos': return <RegisterPage />
      case 'inv': return <InventoryPage />
      case 'invl': return <InvoicesPage />
      case 'rep': return <ReportsPage />
      case 'data': return <SettingsPage />
      default: return <RegisterPage />
    }
  }

  return (
    <div className={`shell ${theme}`}>
      <div className="topbar">
        <div className="tb-logo"><span className="tb-logo-dot"></span><span id="tb-store-name">{storeName}</span></div>
        <nav className="tb-nav">
          {tabs.map(t => (
            <button key={t.id} className={`tb-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <span className="tb-tab-icon">{t.id === 'pos' ? '🧾' : t.id === 'inv' ? '📦' : t.id === 'invl' ? '🗂' : t.id === 'rep' ? '📊' : '⚙️'}</span>
              {t.label}<span className="tb-fkey">{t.key}</span>
              {t.id === 'inv' && lowStockCount > 0 && (
                <span style={{
                  marginLeft: 4,
                  background: 'var(--r)',
                  color: '#fff',
                  fontSize: '.62rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 8,
                  lineHeight: '1.2',
                }}>{lowStockCount}</span>
              )}
            </button>
          ))}
        </nav>
          <div className="tb-right">
          <div className="tb-metric" onClick={() => { setTab('rep'); useUIStore.getState().setReportsTab('dashboard') }} style={{ cursor: 'pointer' }}>
            <span className="tb-metric-v">{todayStats.revenue.toFixed(2)}</span>
            <span className="tb-metric-l">Today's Sales</span>
          </div>
          <div className="tb-metric" onClick={() => { setTab('rep'); useUIStore.getState().setReportsTab('dashboard') }} style={{ cursor: 'pointer' }}>
            <span className="tb-metric-v">{todayStats.sales}</span>
            <span className="tb-metric-l">Transactions</span>
          </div>
          <ShiftIndicator />
          <SyncIndicator />
          <div className="tb-clock-wrap">
            <div className="tb-time">{clock}</div>
            <div className="tb-date">{new Date().toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <button id="theme-toggle" onClick={toggleTheme} title="Toggle theme"
            style={{ background: 'none', border: 'none', borderLeft: '1px solid var(--bd)', width: 48, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18, color: 'var(--t2)' }}>
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <div id="tb-user-wrap" style={{ display: 'flex', alignItems: 'center', gap: 9, borderLeft: '1px solid var(--bd)', padding: '0 14px', flexShrink: 0, minHeight: 54 }}>
            <span id="tb-user-email" style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
            <span className="dept-badge" style={{ background: 'var(--glo)', color: 'var(--g)' }}>{user.role}</span>
            {user.pin && (
              <button onClick={() => setShowPinLogin(true)} style={{ background: 'none', border: '1px solid var(--bd)', color: 'var(--t2)', borderRadius: 5, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Lock</button>
            )}
            <button onClick={handleLogout} style={{ background: 'none', border: '1px solid rgba(240,82,82,.2)', color: 'var(--r)', borderRadius: 5, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Logout</button>
          </div>
        </div>
      </div>

      <div className="main">
        <div className="tab-content">
          {renderTab()}
        </div>
      </div>

      {showShortcuts && (
        <div className="modal-bg open" onClick={() => setShowShortcuts(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
            <div className="modal-head">
              <span className="modal-title">Keyboard Shortcuts</span>
              <button className="modal-close" onClick={() => setShowShortcuts(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <div>
                <div className="sc-section-head">Register</div>
                {[['Enter','Add item'],['Shift+Enter','Checkout'],['Ctrl+Enter','Complete sale'],['Esc','Clear entry'],['F2','New sale'],['F3','Focus search'],['↑↓','Navigate suggestions']].map(([k, d]) => (
                  <div className="sc-row" key={k}><kbd>{k}</kbd><span>{d}</span></div>
                ))}
                <div className="sc-section-head" style={{ marginTop: 14 }}>Cart</div>
                {[['Ctrl+H','Hold sale'],['Ctrl+R','Recall sale'],['Ctrl+D','Focus discount'],['Ctrl+Z','Remove last item'],['Ctrl+Shift+V','Void last sale']].map(([k, d]) => (
                  <div className="sc-row" key={k}><kbd>{k}</kbd><span>{d}</span></div>
                ))}
              </div>
              <div>
                <div className="sc-section-head">Navigation</div>
                {[['F4','Register'],['F5','Inventory'],['F6','Invoices'],['F7','Reports'],['F8','Settings'],['1-5','Quick switch']].map(([k, d]) => (
                  <div className="sc-row" key={k}><kbd>{k}</kbd><span>{d}</span></div>
                ))}
                <div className="sc-section-head" style={{ marginTop: 14 }}>Other</div>
                {[['Ctrl+P','Print receipt'],['Ctrl+K','Customer search'],['Numpad *','Qty multiplier mode'],['?','Show this screen'],['Alt+1-9','Select department']].map(([k, d]) => (
                  <div className="sc-row" key={k}><kbd>{k}</kbd><span>{d}</span></div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>Press <kbd>Esc</kbd> or click outside to close</div>
          </div>
        </div>
      )}

      <ToastContainer />
      <ConfirmDialog />
    </div>
  )
}

export default App
