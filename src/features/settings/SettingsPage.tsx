import { useState, useEffect } from 'react'
import { db } from '@db/schema'
import { generateId, dlBlob } from '@shared/utils'
import { useUIStore } from '@stores/uiStore'
import { Button } from '@shared/ui/Button'
import { SuppliersPage } from './SuppliersPage'
import { PurchaseOrdersPage } from './PurchaseOrdersPage'
import { ShiftManagement } from '@features/shifts/ShiftManagement'
import { AuditLogPage } from './AuditLogPage'
import type { SettingsTab } from '@shared/types'

export function SettingsPage() {
  const [storeName, setStoreName] = useState('My Store')
  const [storeAddress, setStoreAddress] = useState('')
  const [storePhone, setStorePhone] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('')
  const [taxRate, setTaxRate] = useState(0)
  const [currency, setCurrency] = useState('Rs')
  const [subTab, setSubTab] = useState<SettingsTab>('store')
  const showToast = useUIStore(s => s.showToast)
  const showConfirm = useUIStore(s => s.showConfirm)

  useEffect(() => {
    ;(async () => {
      try {
        const stores = await db.stores.toArray()
        if (stores.length) {
          setStoreName(stores[0].name)
          setStoreAddress(stores[0].address || '')
          setStorePhone(stores[0].phone || '')
          setReceiptFooter(stores[0].receipt_footer || '')
          setTaxRate(stores[0].tax_rate)
          setCurrency(stores[0].currency)
        }
      } catch { }
    })()
  }, [])

  const handleSaveStore = async () => {
    try {
      const stores = await db.stores.toArray()
      if (stores.length) {
        await db.stores.update(stores[0].id, { name: storeName, address: storeAddress, phone: storePhone, receipt_footer: receiptFooter, tax_rate: taxRate, currency })
      } else {
        await db.stores.add({
          id: generateId(),
          name: storeName,
          address: storeAddress,
          phone: storePhone,
          tax_rate: taxRate,
          currency,
          receipt_footer: receiptFooter,
        })
      }
      showToast('Settings saved', 'ok')
    } catch {
      showToast('Failed to save', 'err')
    }
  }

  const handleExport = async () => {
    try {
      const products = await db.products.toArray()
      const invoices = await db.invoices.toArray()
      const customers = await db.customers.toArray()
      const data = JSON.stringify({ products, invoices, customers, exportedAt: new Date().toISOString() }, null, 2)
      dlBlob(data, 'application/json', `pos-backup-${new Date().toISOString().slice(0, 10)}.json`)
      showToast('Data exported', 'ok')
    } catch {
      showToast('Export failed', 'err')
    }
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (data.products) {
          for (const p of data.products) {
            const exists = await db.products.where('id').equals(p.id).first()
            if (!exists) await db.products.add(p)
          }
        }
        if (data.invoices) {
          for (const inv of data.invoices) {
            const exists = await db.invoices.where('id').equals(inv.id).first()
            if (!exists) await db.invoices.add(inv)
          }
        }
        if (data.customers) {
          for (const c of data.customers) {
            const exists = await db.customers.where('id').equals(c.id).first()
            if (!exists) await db.customers.add(c)
          }
        }
        showToast('Data imported successfully', 'ok')
      } catch {
        showToast('Import failed - invalid file', 'err')
      }
    }
    input.click()
  }

  const handleClearData = () => {
    showConfirm('Delete ALL data? This cannot be undone.', async () => {
      try {
        await db.products.clear()
        await db.invoices.clear()
        await db.customers.clear()
        await db.stockMovements.clear()
        showToast('All data cleared', 'ok')
      } catch {
        showToast('Failed to clear data', 'err')
      }
    })
  }

  const subTabs: { id: SettingsTab; label: string }[] = [
    { id: 'store', label: 'Store Settings' },
    { id: 'shifts', label: 'Shifts' },
    { id: 'users', label: 'Users' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'data', label: 'Data Management' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'purchase-orders', label: 'Purchase Orders' },
  ]

  const renderSubTab = () => {
    switch (subTab) {
      case 'suppliers':
        return <SuppliersPage />
      case 'purchase-orders':
        return <PurchaseOrdersPage />
      case 'shifts':
        return <ShiftManagement />
      case 'audit':
        return <AuditLogPage />
      case 'users':
        return <div className="section"><h3>User Management</h3><p style={{ color: 'var(--t3)' }}>User management coming soon.</p></div>
      case 'store':
      case 'data':
      default:
        return (
          <>
            {subTab === 'store' && (
                <div className="section">
                  <h3>Store Settings</h3>
                  <div className="form-group">
                    <label>Store Name</label>
                    <input value={storeName} onChange={e => setStoreName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <input value={storeAddress} onChange={e => setStoreAddress(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input value={storePhone} onChange={e => setStorePhone(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div className="form-group">
                      <label>Tax Rate (%)</label>
                      <input type="number" value={taxRate || ''} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="form-group">
                      <label>Currency Symbol</label>
                      <input value={currency} onChange={e => setCurrency(e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Receipt Footer</label>
                    <input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} placeholder="Thank you for your visit!" />
                  </div>
                  <Button variant="primary" size="sm" onClick={handleSaveStore}>Save Settings</Button>
                </div>
            )}
            {subTab === 'data' && (
              <div className="section">
                <h3>Data Management</h3>
                <div className="desc">Export your data as JSON backup or import from a previous backup.</div>
                <div className="actions">
                  <Button variant="primary" size="sm" onClick={handleExport}>Export Data</Button>
                  <Button variant="ghost" size="sm" onClick={handleImport}>Import Data</Button>
                  <Button variant="danger" size="sm" onClick={handleClearData}>Clear All Data</Button>
                </div>
              </div>
            )}
          </>
        )
    }
  }

  return (
    <div className="data-page">
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {subTabs.map(t => (
          <button
            key={t.id}
            className={`btn btn-sm ${subTab === t.id ? 'btn-g' : 'btn-ghost'}`}
            onClick={() => setSubTab(t.id)}
            style={{
              padding: '4px 12px',
              borderRadius: 5,
              border: `1px solid ${subTab === t.id ? 'var(--g2)' : 'var(--bd)'}`,
              background: subTab === t.id ? 'rgba(0,214,143,.08)' : 'transparent',
              color: subTab === t.id ? 'var(--g)' : 'var(--t2)',
              fontSize: '.65rem',
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '.3px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {renderSubTab()}

      {subTab === 'store' && (
        <div className="section">
          <h3>Keyboard Shortcuts</h3>
          <div className="shortcuts-grid">
            {[
              ['Ctrl+F', 'Search products'],
              ['F1', 'Toggle shortcuts'],
              ['1-5', 'Switch tabs'],
              ['Esc', 'Close modals'],
              ['F5', 'Refresh'],
            ].map(([key, desc]) => (
              <div className="shortcut-row" key={key}>
                <span className="key">{key}</span>
                <span className="desc">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
