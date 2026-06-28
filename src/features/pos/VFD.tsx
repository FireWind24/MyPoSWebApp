import { useCartStore } from '@stores/cartStore'
import { fmt } from '@shared/utils'

export function VFD() {
  const items = useCartStore(s => s.items)
  const subtotal = useCartStore(s => s.items.reduce((sum, i) => sum + i.total, 0))
  const discPct = useCartStore(s => s.discPct)
  const discVal = useCartStore(s => s.discount)
  const taxPct = useCartStore(s => s.taxPct)
  const discAmount = discPct > 0 ? subtotal * (discPct / 100) : discVal
  const taxAmount = (subtotal - discAmount) * (taxPct / 100)
  const total = subtotal - discAmount + taxAmount

  return (
    <div className="vfd">
      <div className="vfd-row1">
        <div className="vfd-dept">{items.length} ITEMS</div>
        <div className="vfd-count">{items.reduce((s, i) => s + i.qty, 0)} UNITS</div>
      </div>
      <div className="vfd-scroll">
        {items.length === 0 && <div className="vfd-item">READY</div>}
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--g)', padding: '2px 0' }}>
            <span>{item.qty}x {item.name}</span>
            <span>{fmt(item.total)}</span>
          </div>
        ))}
      </div>
      <hr className="vfd-divider" />
      <div className="vfd-foot">
        <div className="vfd-total">{fmt(total)}</div>
        <div className="vfd-meta">
          {discAmount > 0 && <div className="vfd-cash">DISCOUNT: -{fmt(discAmount)}</div>}
          {taxPct > 0 && <div className="vfd-cash">TAX: +{fmt(taxAmount)}</div>}
        </div>
      </div>
    </div>
  )
}
