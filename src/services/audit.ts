import { db } from '@db/schema'
import { generateId } from '@shared/utils'

export async function logAudit(params: {
  userId: string
  action: string
  entityType: string
  entityId: string
  oldValue?: any
  newValue?: any
}): Promise<void> {
  try {
    await db.auditLogs.add({
      id: generateId() + '_audit',
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
      created_at: Date.now(),
    })
  } catch (err) {
    console.error('Audit log failed:', err)
  }
}
