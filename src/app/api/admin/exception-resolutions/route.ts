import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getDb(){
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { seasonId, arbiterGameId, gameId, bucket, resolution, note, evidenceFingerprint, evidence } = body || {}
    if (!seasonId || !arbiterGameId || !bucket || !evidenceFingerprint) return NextResponse.json({ ok:false, error:'Missing exception identity.' }, { status:400 })
    if (!['confirm-scrimmage','keep-quarantined'].includes(resolution)) return NextResponse.json({ ok:false, error:'Unsupported resolution.' }, { status:400 })

    const db = getDb()
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const statements = [
      db.prepare('UPDATE admin_exception_resolutions SET active=0, updated_at=? WHERE season_id=? AND arbiter_game_id=? AND active=1')
        .bind(createdAt, String(seasonId), String(arbiterGameId)),
      db.prepare(`INSERT INTO admin_exception_resolutions
        (id,season_id,arbiter_game_id,game_id,exception_bucket,resolution,note,evidence_fingerprint,evidence,active,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`)
        .bind(id,String(seasonId),String(arbiterGameId),gameId?String(gameId):null,String(bucket),String(resolution),note?String(note).slice(0,500):null,String(evidenceFingerprint),JSON.stringify(evidence||{}),createdAt,createdAt),
    ]
    if (resolution === 'confirm-scrimmage' && gameId) {
      statements.push(db.prepare("UPDATE games SET contest_type='scrimmage', updated_at=? WHERE id=?").bind(createdAt,String(gameId)))
    }
    await db.batch(statements)

    return NextResponse.json({ ok:true, resolution:{ id, resolution, created_at:createdAt } })
  } catch (error) {
    console.error('Exception resolution failed:', error)
    return NextResponse.json({ ok:false, error:error instanceof Error?error.message:'Resolution failed' }, { status:500 })
  }
}
