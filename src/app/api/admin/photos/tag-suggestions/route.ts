import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const photoId = req.nextUrl.searchParams.get('photoId')
  if (!photoId) return NextResponse.json({ error: 'photoId required' }, { status: 400 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('photo_tag_suggestions')
    .select('id,athlete_id,status,source_type,contributor_id,created_at')
    .eq('photo_id', photoId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, suggestions: data || [] })
}
