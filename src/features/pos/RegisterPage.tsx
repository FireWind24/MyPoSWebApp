import { VFD } from './VFD'
import { InvoiceGrid } from './InvoiceGrid'
import { ReceiptPanel } from './ReceiptPanel'
import { CheckoutModal } from './Checkout/CheckoutModal'

export function RegisterPage() {
  return (
    <div className="pos-layout">
      <div className="pos-center">
        <VFD />
        <InvoiceGrid />
      </div>
      <div className="pos-right">
        <ReceiptPanel />
      </div>
      <CheckoutModal />
    </div>
  )
}
