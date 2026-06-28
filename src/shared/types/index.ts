export interface ProductVariant {
  name: string
  price: number
  stock: number
  sku: string
}

export interface BundleItem {
  product_id: string
  product_name: string
  quantity: number
}

export interface Product {
  id: string
  name: string
  barcode: string
  dept: string
  price: number
  cost_price?: number
  stock: number
  min_stock?: number
  unit?: string
  image_url?: string
  expiry_date?: string
  primary_supplier_id?: string
  secondary_supplier_id?: string
  variants?: ProductVariant[]
  bundle_items?: BundleItem[]
}

export interface Department {
  id: string
  name: string
  color: string
  sort_order: number
}

export interface CartItem {
  dept: string
  name: string
  price: number
  qty: number
  total: number
}

export interface Invoice {
  id: string
  store_id: string
  cashier_id: string
  date: number
  dateStr: string
  items: CartItem[]
  subtotal: number
  discount: number
  discPct: number
  tax: number
  taxPct: number
  taxAmount: number
  total: number
  payment_method: 'cash' | 'card' | 'split'
  cash: number
  cardAmount: number
  change: number
  customer_id: string
  customerName: string
  status: 'completed' | 'refunded' | 'void'
}

export interface Customer {
  id: string
  store_id: string
  name: string
  phone: string
  email: string
  total_spent: number
  visit_count: number
}

export interface User {
  id: string
  store_id: string
  role: 'owner' | 'manager' | 'cashier' | 'stock_clerk' | 'viewer'
  name: string
  pin: string
  active: boolean
}

export interface Store {
  id: string
  name: string
  address: string
  phone: string
  tax_rate: number
  currency: string
  receipt_footer: string
}

export interface StockMovement {
  id: string
  product_id: string
  delta: number
  reason: 'received' | 'damaged' | 'expired' | 'counted' | 'adjusted' | 'sale'
  invoice_id: string
  created_at: number
  notes: string
}

export interface Supplier {
  id: string
  name: string
  contact_person: string
  phone: string
  email: string
  address: string
  payment_terms: string
  notes: string
}

export interface PurchaseOrder {
  id: string
  supplier_id: string
  status: 'draft' | 'sent' | 'partially_received' | 'received' | 'archived'
  items: POItem[]
  total: number
  created_at: number
  received_at: number
}

export interface POItem {
  product_id: string
  product_name: string
  quantity: number
  received: number
  unit_price: number
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  old_value: any
  new_value: any
  created_at: number
}

export interface Shift {
  id: string
  store_id: string
  cashier_id: string
  cashier_name: string
  opened_at: number
  closed_at: number | null
  opening_float: number
  closing_float: number | null
  expected_cash: number | null
  actual_cash: number | null
  variance: number | null
  status: 'open' | 'closed' | 'archived'
  notes: string
}

export interface ShiftReport {
  shift: Shift
  transaction_count: number
  total_revenue: number
  cash_total: number
  card_total: number
  split_total: number
  refund_count: number
  refund_total: number
  top_products: { name: string; qty: number; revenue: number }[]
  hourly_breakdown: { hour: number; sales: number; count: number }[]
}

export type TabId = 'pos' | 'inv' | 'invl' | 'rep' | 'data'
export type SettingsTab = 'store' | 'data' | 'suppliers' | 'purchase-orders' | 'users' | 'shifts' | 'audit'
