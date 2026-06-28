import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Product } from '@shared/types'
interface CartState {
  items: CartItem[]
  discount: number
  discPct: number
  taxPct: number
  paymentMethod: 'cash' | 'card' | 'split'
  cash: number
  cardAmount: number
  customerName: string
  notes: string
  addItem: (product: Product, qty?: number) => void
  updateQty: (index: number, qty: number) => void
  updatePrice: (index: number, price: number) => void
  removeItem: (index: number) => void
  clearCart: () => void
  setDiscount: (v: number) => void
  setDiscPct: (v: number) => void
  setTaxPct: (v: number) => void
  setPaymentMethod: (v: 'cash' | 'card' | 'split') => void
  setCash: (v: number) => void
  setCardAmount: (v: number) => void
  setCustomerName: (v: string) => void
  setNotes: (v: string) => void
  getSubtotal: () => number
  getDiscountAmount: () => number
  getTaxAmount: (subtotal: number, discAmt: number) => number
  getTotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      discount: 0,
      discPct: 0,
      taxPct: 0,
      paymentMethod: 'cash',
      cash: 0,
      cardAmount: 0,
      customerName: '',
      notes: '',
      addItem: (product: Product, qty?: number) => {
        const items = get().items
        const quantity = qty || 1
        const idx = items.findIndex(i => i.name === product.name)
        if (idx >= 0) {
          const updated = [...items]
          const newQty = updated[idx].qty + quantity
          updated[idx] = { ...updated[idx], qty: newQty, total: newQty * updated[idx].price }
          set({ items: updated })
        } else {
          set({ items: [...items, { dept: product.dept, name: product.name, price: product.price, qty: quantity, total: product.price * quantity }] })
        }
      },
      updatePrice: (index: number, price: number) => {
        const items = get().items
        const updated = [...items]
        updated[index] = { ...updated[index], price, total: updated[index].qty * price }
        set({ items: updated })
      },
      updateQty: (index: number, qty: number) => {
        const items = get().items
        if (qty <= 0) {
          set({ items: items.filter((_, i) => i !== index) })
        } else {
          const updated = [...items]
          updated[index] = { ...updated[index], qty, total: qty * updated[index].price }
          set({ items: updated })
        }
      },
      removeItem: (index: number) => {
        set({ items: get().items.filter((_, i) => i !== index) })
      },
      clearCart: () => set({ items: [], discount: 0, discPct: 0, cash: 0, cardAmount: 0, customerName: '', notes: '' }),
      setDiscount: (v: number) => set({ discount: v }),
      setDiscPct: (v: number) => set({ discPct: v }),
      setTaxPct: (v: number) => set({ taxPct: v }),
      setPaymentMethod: (v: 'cash' | 'card' | 'split') => set({ paymentMethod: v }),
      setCash: (v: number) => set({ cash: v }),
      setCardAmount: (v: number) => set({ cardAmount: v }),
      setCustomerName: (v: string) => set({ customerName: v }),
      setNotes: (v: string) => set({ notes: v }),
      getSubtotal: () => get().items.reduce((s, i) => s + i.total, 0),
      getDiscountAmount: () => {
        const st = get().getSubtotal()
        const { discount, discPct } = get()
        return discPct > 0 ? st * (discPct / 100) : discount
      },
      getTaxAmount: (subtotal: number, discAmt: number) => {
        return (subtotal - discAmt) * (get().taxPct / 100)
      },
      getTotal: () => {
        const st = get().getSubtotal()
        const da = get().getDiscountAmount()
        const tx = get().getTaxAmount(st, da)
        return st - da + tx
      },
    }),
    { name: 'pos-cart' }
  )
)
