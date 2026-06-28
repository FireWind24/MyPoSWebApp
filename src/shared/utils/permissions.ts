export type Role = 'owner' | 'manager' | 'cashier' | 'stock_clerk' | 'viewer'

export type Permission =
  | 'pos:use'
  | 'pos:void'
  | 'pos:discount'
  | 'pos:price_override'
  | 'inventory:view'
  | 'inventory:edit'
  | 'inventory:delete'
  | 'invoices:view'
  | 'invoices:delete'
  | 'invoices:refund'
  | 'reports:view'
  | 'reports:export'
  | 'settings:view'
  | 'settings:edit'
  | 'settings:users'
  | 'suppliers:manage'
  | 'purchases:manage'
  | 'shifts:manage'
  | 'shifts:view_all'
  | 'audit:view'
  | 'admin:all'

const ALL_PERMISSIONS: Permission[] = [
  'pos:use', 'pos:void', 'pos:discount', 'pos:price_override',
  'inventory:view', 'inventory:edit', 'inventory:delete',
  'invoices:view', 'invoices:delete', 'invoices:refund',
  'reports:view', 'reports:export',
  'settings:view', 'settings:edit', 'settings:users',
  'suppliers:manage', 'purchases:manage',
  'shifts:manage', 'shifts:view_all',
  'audit:view',
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ['admin:all', ...ALL_PERMISSIONS],
  manager: [
    'pos:use', 'pos:void', 'pos:discount',
    'inventory:view', 'inventory:edit',
    'invoices:view', 'invoices:delete', 'invoices:refund',
    'reports:view', 'reports:export',
    'settings:view', 'settings:edit',
    'suppliers:manage', 'purchases:manage',
    'shifts:manage', 'shifts:view_all',
    'audit:view',
  ],
  cashier: [
    'pos:use', 'pos:discount',
    'inventory:view',
    'invoices:view',
    'reports:view',
  ],
  stock_clerk: [
    'inventory:view', 'inventory:edit',
    'suppliers:manage', 'purchases:manage',
  ],
  viewer: [
    'invoices:view',
    'reports:view',
  ],
}

export function hasPermission(userRole: Role | undefined, permission: Permission): boolean {
  if (!userRole) return false
  const perms = ROLE_PERMISSIONS[userRole]
  if (!perms) return false
  if (perms.includes('admin:all')) return true
  return perms.includes(permission)
}

export function useRequirePermission(permission: Permission): boolean {
  const userStr = typeof window !== 'undefined' ? sessionStorage.getItem('pos_user') : null
  if (!userStr) return false
  try {
    const user = JSON.parse(userStr)
    return hasPermission(user.role, permission)
  } catch {
    return false
  }
}
