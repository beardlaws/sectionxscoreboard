// src/lib/adminDb.ts
// Small browser helper for protected Cloudflare D1 admin CRUD operations.

type SelectOptions = {
  match?: Record<string, any>
  columns?: string[]
  orderBy?: string
  direction?: 'asc' | 'desc'
  limit?: number
}

async function dbAction(action: string, table: string, data?: any, match?: Record<string, any>, onConflict?: string, extra?: Record<string, any>) {
  const res = await fetch('/api/admin/db', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, table, data, match, onConflict, ...(extra || {}) }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'DB error')
  return json
}

export const adminDb = {
  select: (table: string, options: SelectOptions = {}) => dbAction('select', table, undefined, options.match, undefined, options),
  insert: (table: string, data: any) => dbAction('insert', table, data),
  update: (table: string, data: any, match: Record<string, any>) => dbAction('update', table, data, match),
  upsert: (table: string, data: any, onConflict?: string) => dbAction('upsert', table, data, undefined, onConflict),
  delete: (table: string, match: Record<string, any>) => dbAction('delete', table, undefined, match),
}
