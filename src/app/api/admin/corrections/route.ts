import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function cleanStatus(value: string | null) {
  if (value === 'resolved' || value === 'dismissed' || value === 'open') return value
  return 'all'
}

export async function GET(req: NextRequest) {
  try {
    const status = cleanStatus(req.nextUrl.searchParams.get('status'))
    const { env } = getCloudflareContext()
    const db = (env as any).DB
    if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

    let sql = `
      SELECT c.*,
             g.game_date,
             s.sport_name,
             ht.team_name AS home_team_name,
             at.team_name AS away_team_name,
             he.name AS external_home_name,
             ae.name AS external_away_name
      FROM correction_requests c
      LEFT JOIN games g ON g.id = c.game_id
      LEFT JOIN sports s ON s.id = g.sport_id
      LEFT JOIN teams ht ON ht.id = g.home_team_id
      LEFT JOIN teams at ON at.id = g.away_team_id
      LEFT JOIN external_opponents he ON he.id = g.external_home_opponent_id
      LEFT JOIN external_opponents ae ON ae.id = g.external_away_opponent_id
    `
    const binds:any[]=[]
    if (status !== 'all') { sql += ' WHERE c.status = ?'; binds.push(status) }
    sql += ' ORDER BY c.created_at DESC LIMIT 300'
    const result = await db.prepare(sql).bind(...binds).all()
    const rows=(result.results||[]).map((r:any)=>({
      id:r.id,game_id:r.game_id,submitter_name:r.submitter_name,submitter_email:r.submitter_email,
      correction_text:r.correction_text,status:r.status,created_at:r.created_at,
      game:r.game_id?{id:r.game_id,game_date:r.game_date,sport:{sport_name:r.sport_name},home_team:{team_name:r.home_team_name||r.external_home_name||'TBD'},away_team:{team_name:r.away_team_name||r.external_away_name||'TBD'}}:null,
    }))
    return NextResponse.json({ok:true,rows})
  } catch (error:any) {
    console.error('[admin/corrections GET]',error)
    return NextResponse.json({ok:false,error:error?.message||'Could not load corrections.'},{status:500})
  }
}

export async function POST(req: NextRequest) {
  try {
    const body=await req.json().catch(()=>null)
    const id=String(body?.id||'').trim()
    const status=String(body?.status||'').trim()
    if(!id||!['resolved','dismissed'].includes(status)) return NextResponse.json({ok:false,error:'Invalid correction update.'},{status:400})
    const { env }=getCloudflareContext()
    const db=(env as any).DB
    if(!db) throw new Error('Cloudflare D1 binding DB is unavailable')
    const existing:any=await db.prepare('SELECT id,status FROM correction_requests WHERE id=? LIMIT 1').bind(id).first()
    if(!existing) return NextResponse.json({ok:false,error:'Correction not found.'},{status:404})
    await db.prepare('UPDATE correction_requests SET status=? WHERE id=?').bind(status,id).run()
    return NextResponse.json({ok:true})
  } catch(error:any){
    console.error('[admin/corrections POST]',error)
    return NextResponse.json({ok:false,error:error?.message||'Could not update correction.'},{status:500})
  }
}
