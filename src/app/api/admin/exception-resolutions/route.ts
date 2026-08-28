import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { seasonId, arbiterGameId, gameId, bucket, resolution, note, evidenceFingerprint, evidence } = body || {}
    if (!seasonId || !arbiterGameId || !bucket || !evidenceFingerprint) return NextResponse.json({ ok:false, error:'Missing exception identity.' }, { status:400 })
    if (!['confirm-scrimmage','keep-quarantined'].includes(resolution)) return NextResponse.json({ ok:false, error:'Unsupported resolution.' }, { status:400 })

    const db = createAdminClient()
    await db.from('admin_exception_resolutions').update({ active:false, updated_at:new Date().toISOString() }).eq('season_id', seasonId).eq('arbiter_game_id', String(arbiterGameId)).eq('active', true)

    const { data: saved, error } = await db.from('admin_exception_resolutions').insert({
      season_id:seasonId, arbiter_game_id:String(arbiterGameId), game_id:gameId||null,
      exception_bucket:String(bucket), resolution, note:note?String(note).slice(0,500):null,
      evidence_fingerprint:String(evidenceFingerprint), evidence:evidence||{}, active:true,
    }).select('id,resolution,created_at').single()
    if (error) throw error

    if (resolution === 'confirm-scrimmage' && gameId) {
      const { error: gameError } = await db.from('games').update({ contest_type:'scrimmage' }).eq('id', gameId)
      if (gameError) throw gameError
    }

    return NextResponse.json({ ok:true, resolution:saved })
  } catch (error) {
    console.error('Exception resolution failed:', error)
    return NextResponse.json({ ok:false, error:error instanceof Error?error.message:'Resolution failed' }, { status:500 })
  }
}
