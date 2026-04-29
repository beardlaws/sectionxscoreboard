import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function checkAuth(req: NextRequest) {
  const cookieHeader = req.cookies.get('admin_auth')?.value
  return cookieHeader === 'SectionXScoreboardTheRightWay!'
}

// POST /api/admin/db
// Body: { action: 'insert'|'update'|'upsert'|'delete', table: string, data?: any, match?: any, onConflict?: string }
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, table, data, match, onConflict } = body

  if (!table || !action) {
    return NextResponse.json({ error: 'table and action required' }, { status: 400 })
  }

  const supabase = getAdminClient()
  let result: any

  try {
    if (action === 'insert') {
      result = await supabase.from(table).insert(data)
    } else if (action === 'update') {
      let q = supabase.from(table).update(data)
      if (match) {
        for (const [k, v] of Object.entries(match)) {
          q = (q as any).eq(k, v)
        }
      }
      result = await q
    } else if (action === 'upsert') {
      result = await supabase.from(table).upsert(data, { onConflict: onConflict || 'id' })
    } else if (action === 'delete') {
      let q = supabase.from(table).delete()
      if (match) {
        for (const [k, v] of Object.entries(match)) {
          q = (q as any).eq(k, v)
        }
      }
      result = await q
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data: result.data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
