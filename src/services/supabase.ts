import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

let _supabase: SupabaseClient | null = null

if (supabaseUrl && supabaseKey) {
  _supabase = createClient(supabaseUrl, supabaseKey)
}

export const supabase = _supabase

export async function dbGet<T>(store: string, key: string): Promise<T | undefined> {
  if (!supabase) return undefined
  const pk = store === 'config' ? 'key' : 'id'
  const { data, error } = await supabase
    .from(store)
    .select('*')
    .eq(pk, key)
    .maybeSingle()
  if (error) console.error('dbGet:', error.message)
  return (data as T) || undefined
}

export async function dbPut<T extends Record<string, unknown>>(store: string, val: T): Promise<T> {
  if (!supabase) return val
  const user = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from(store)
    .upsert({ ...val, user_id: user.data.user?.id })
    .select()
    .single()
  if (error) console.error('dbPut:', error.message)
  return (data as T) || val
}

export async function dbAdd<T extends Record<string, unknown>>(store: string, val: T): Promise<T> {
  if (!supabase) return val
  const user = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from(store)
    .insert({ ...val, user_id: user.data.user?.id })
    .select()
    .single()
  if (error) console.error('dbAdd:', error.message)
  return (data as T) || val
}

export async function dbDelete(store: string, key: string): Promise<void> {
  if (!supabase) return
  const pk = store === 'config' ? 'key' : 'id'
  const { error } = await supabase
    .from(store)
    .delete()
    .eq(pk, key)
  if (error) console.error('dbDelete:', error.message)
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(store)
    .select('*')
  if (error) console.error('dbGetAll:', error.message)
  return (data as T[]) || []
}

export async function dbClear(store: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from(store)
    .delete()
    .neq('id', '')
  if (error) console.error('dbClear:', error.message)
}
