import Dexie, { type EntityTable } from 'dexie'
import type { Product, Invoice, Customer, User, Store, StockMovement, Supplier, PurchaseOrder, AuditLog, Shift } from '@shared/types'

export class POSDatabase extends Dexie {
  products!: EntityTable<Product, 'id'>
  invoices!: EntityTable<Invoice, 'id'>
  customers!: EntityTable<Customer, 'id'>
  users!: EntityTable<User, 'id'>
  stores!: EntityTable<Store, 'id'>
  stockMovements!: EntityTable<StockMovement, 'id'>
  suppliers!: EntityTable<Supplier, 'id'>
  purchaseOrders!: EntityTable<PurchaseOrder, 'id'>
  auditLogs!: EntityTable<AuditLog, 'id'>
  shifts!: EntityTable<Shift, 'id'>

  constructor() {
    super('MyPoSDB')
    this.version(1).stores({
      products: 'id, name, barcode, dept, price, stock, min_stock',
      invoices: 'id, store_id, cashier_id, date, customer_id, status, payment_method',
      customers: 'id, store_id, name, phone',
      users: 'id, store_id, role, name, pin, active',
      stores: 'id, name',
      stockMovements: 'id, product_id, reason, created_at, ++',
      suppliers: 'id, name',
      purchaseOrders: 'id, supplier_id, status, created_at',
      auditLogs: 'id, user_id, action, entity_type, created_at',
      shifts: 'id, cashier_id, opened_at, status',
    })
  }
}

export const db = new POSDatabase()
