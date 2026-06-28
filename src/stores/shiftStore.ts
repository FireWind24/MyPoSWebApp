import { create } from 'zustand'
import { db } from '@db/schema'
import { generateId } from '@shared/utils'
import type { Shift, ShiftReport } from '@shared/types'

interface ShiftState {
  activeShift: Shift | null
  shiftHistory: ShiftReport[]
  loading: boolean
  openShift: (cashierId: string, cashierName: string, openingFloat: number) => Promise<void>
  closeShift: (actualCash: number, notes: string) => Promise<ShiftReport>
  getShiftReport: (shiftId: string) => Promise<ShiftReport>
  loadShiftHistory: () => Promise<void>
  loadActiveShift: (storeId: string) => Promise<void>
}

export const useShiftStore = create<ShiftState>()((set, get) => ({
  activeShift: null,
  shiftHistory: [],
  loading: false,

  loadActiveShift: async (storeId: string) => {
    try {
      const open = await db.table('shifts')
        .where('status')
        .equals('open')
        .filter((s: any) => s.store_id === storeId)
        .first() as Shift | undefined
      set({ activeShift: open || null })
    } catch {
      set({ activeShift: null })
    }
  },

  openShift: async (cashierId: string, cashierName: string, openingFloat: number) => {
    const shift: Shift = {
      id: generateId(),
      store_id: '',
      cashier_id: cashierId,
      cashier_name: cashierName,
      opened_at: Date.now(),
      closed_at: null,
      opening_float: openingFloat,
      closing_float: null,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: 'open',
      notes: '',
    }
    await db.table('shifts').add(shift)
    set({ activeShift: shift })
  },

  closeShift: async (actualCash: number, notes: string): Promise<ShiftReport> => {
    const { activeShift } = get()
    if (!activeShift) throw new Error('No active shift')

    const now = Date.now()
    const today = new Date(now).toISOString().slice(0, 10)
    const invoices = await db.invoices
      .filter(i => i.dateStr === today && i.cashier_id === activeShift.cashier_id)
      .toArray()

    const completed = invoices.filter(i => i.status === 'completed')
    const refunds = invoices.filter(i => i.status === 'refunded')

    const transactionCount = completed.length
    const totalRevenue = completed.reduce((s, i) => s + i.total, 0)
    const cashTotal = completed.filter(i => i.payment_method === 'cash').reduce((s, i) => s + i.total, 0)
    const cardTotal = completed.filter(i => i.payment_method === 'card').reduce((s, i) => s + i.total, 0)
    const splitTotal = completed.filter(i => i.payment_method === 'split').reduce((s, i) => s + i.total, 0)
    const refundCount = refunds.length
    const refundTotal = refunds.reduce((s, i) => s + i.total, 0)

    const expectedCash = activeShift.opening_float + cashTotal
    const variance = actualCash - expectedCash

    const productMap = new Map<string, { qty: number; revenue: number }>()
    for (const inv of completed) {
      for (const item of inv.items) {
        const existing = productMap.get(item.name)
        if (existing) {
          existing.qty += item.qty
          existing.revenue += item.total
        } else {
          productMap.set(item.name, { qty: item.qty, revenue: item.total })
        }
      }
    }
    const topProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)

    const hourlyMap = new Map<number, { sales: number; count: number }>()
    for (const inv of completed) {
      const hour = new Date(inv.date).getHours()
      const existing = hourlyMap.get(hour)
      if (existing) {
        existing.sales += inv.total
        existing.count += 1
      } else {
        hourlyMap.set(hour, { sales: inv.total, count: 1 })
      }
    }
    const hourlyBreakdown = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour - b.hour)

    const updatedShift: Shift = {
      ...activeShift,
      closed_at: now,
      closing_float: actualCash,
      expected_cash: expectedCash,
      actual_cash: actualCash,
      variance,
      status: 'closed',
      notes,
    }

    await db.table('shifts').update(activeShift.id, {
      closed_at: now,
      closing_float: actualCash,
      expected_cash: expectedCash,
      actual_cash: actualCash,
      variance,
      status: 'closed',
      notes,
    })

    const report: ShiftReport = {
      shift: updatedShift,
      transaction_count: transactionCount,
      total_revenue: totalRevenue,
      cash_total: cashTotal,
      card_total: cardTotal,
      split_total: splitTotal,
      refund_count: refundCount,
      refund_total: refundTotal,
      top_products: topProducts,
      hourly_breakdown: hourlyBreakdown,
    }

    set({ activeShift: null })
    return report
  },

  getShiftReport: async (shiftId: string): Promise<ShiftReport> => {
    const shift = await db.table('shifts').get(shiftId) as Shift | undefined
    if (!shift) throw new Error('Shift not found')

    const openedDate = new Date(shift.opened_at).toISOString().slice(0, 10)
    const invoices = await db.invoices
      .filter(i => i.dateStr === openedDate && i.cashier_id === shift.cashier_id)
      .toArray()

    const completed = invoices.filter(i => i.status === 'completed')
    const refunds = invoices.filter(i => i.status === 'refunded')

    const productMap = new Map<string, { qty: number; revenue: number }>()
    for (const inv of completed) {
      for (const item of inv.items) {
        const existing = productMap.get(item.name)
        if (existing) {
          existing.qty += item.qty
          existing.revenue += item.total
        } else {
          productMap.set(item.name, { qty: item.qty, revenue: item.total })
        }
      }
    }
    const topProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)

    return {
      shift,
      transaction_count: completed.length,
      total_revenue: completed.reduce((s, i) => s + i.total, 0),
      cash_total: completed.filter(i => i.payment_method === 'cash').reduce((s, i) => s + i.total, 0),
      card_total: completed.filter(i => i.payment_method === 'card').reduce((s, i) => s + i.total, 0),
      split_total: completed.filter(i => i.payment_method === 'split').reduce((s, i) => s + i.total, 0),
      refund_count: refunds.length,
      refund_total: refunds.reduce((s, i) => s + i.total, 0),
      top_products: topProducts,
      hourly_breakdown: [],
    }
  },

  loadShiftHistory: async () => {
    set({ loading: true })
    try {
      const shifts = await db.table('shifts')
        .orderBy('opened_at')
        .reverse()
        .toArray() as Shift[]

      const reports: ShiftReport[] = []
      for (const shift of shifts.slice(0, 50)) {
        try {
          const report = await get().getShiftReport(shift.id)
          reports.push(report)
        } catch {
          // skip invalid shifts
        }
      }
      set({ shiftHistory: reports })
    } catch {
      // ignore
    } finally {
      set({ loading: false })
    }
  },
}))
