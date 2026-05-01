// src/lib/adminDb.ts
// Use this instead of supabase client for all writes in admin pages.
// Routes through /api/admin/db which uses the service role key (bypasses RLS).

async function dbAction(action: string, table: string, data?: any, match?: Record<string, any>, onConflict?: string) {
  const res = await fetch('/api/admin/db', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, table, data, match, onConflict }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'DB error')
  return json
}

export const adminDb = {
  insert: (table: string, data: any) => dbAction('insert', table, data),
  update: (table: string, data: any, match: Record<string, any>) => dbAction('update', table, data, match),
  upsert: (table: string, data: any, onConflict?: string) => dbAction('upsert', table, data, undefined, onConflict),
  delete: (table: string, match: Record<string, any>) => dbAction('delete', table, undefined, match),
}
