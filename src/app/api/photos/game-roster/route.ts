import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const gameId = new URL(request.url).searchParams.get('gameId')?.trim() || ''
  if (!gameId) return Response.json({ok:false,error:'Game is required.'},{status:400})
  try {
    const { env } = getCloudflareContext()
    const db = (env as any).DB
    if (!db) throw new Error('D1 binding DB is unavailable')
    const game:any = await db.prepare('SELECT home_team_id,away_team_id,season_id FROM games WHERE id=? LIMIT 1').bind(gameId).first()
    if (!game) return Response.json({ok:false,error:'Game not found.'},{status:404})
    const teamIds = [game.home_team_id,game.away_team_id].filter(Boolean)
    if (!teamIds.length) return Response.json({ok:true,rows:[]})
    const placeholders = teamIds.map(()=>'?').join(',')
    const sql = `SELECT r.athlete_id,r.jersey_number,r.team_id,a.display_name FROM roster_entries r JOIN athletes a ON a.id=r.athlete_id WHERE r.team_id IN (${placeholders}) AND r.active=1 AND a.active=1 ${game.season_id?'AND r.season_id=?':''} ORDER BY a.display_name ASC`
    const binds = game.season_id ? [...teamIds,game.season_id] : teamIds
    const result = await db.prepare(sql).bind(...binds).all()
    const seen = new Set<string>()
    const rows = (result.results||[]).filter((r:any)=>r.athlete_id&&!seen.has(r.athlete_id)&&seen.add(r.athlete_id)).map((r:any)=>({athlete_id:r.athlete_id,jersey_number:r.jersey_number,team_id:r.team_id,athlete:{id:r.athlete_id,display_name:r.display_name}}))
    return Response.json({ok:true,rows})
  } catch (error) {
    console.error('[photos/game-roster]',error)
    return Response.json({ok:false,error:'Could not load roster.'},{status:500})
  }
}
