import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic='force-dynamic'

function getDb(){const {env}=getCloudflareContext();const db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

export async function GET(req:NextRequest){
  try{
    const photoId=String(req.nextUrl.searchParams.get('photoId')||'').trim()
    const gameId=String(req.nextUrl.searchParams.get('gameId')||'').trim()
    if(!photoId||!gameId)return NextResponse.json({ok:false,error:'photoId and gameId required'},{status:400})
    const db=getDb()
    const game=await db.prepare('SELECT home_team_id,away_team_id,season_id FROM games WHERE id=?').bind(gameId).first()
    if(!game)return NextResponse.json({ok:false,error:'Game not found'},{status:404})
    const [tags,suggestions]=await Promise.all([
      db.prepare('SELECT athlete_id FROM photo_athletes WHERE photo_id=?').bind(photoId).all(),
      db.prepare("SELECT id,athlete_id,status,source_type,contributor_id,created_at FROM photo_tag_suggestions WHERE photo_id=? AND status='pending' ORDER BY created_at ASC").bind(photoId).all(),
    ])
    const teamIds=[(game as any).home_team_id,(game as any).away_team_id].filter(Boolean)
    let athletes:any[]=[]
    if(teamIds.length){
      const placeholders=teamIds.map(()=>'?').join(',')
      const sql=`SELECT r.athlete_id,r.jersey_number,r.team_id,a.display_name FROM roster_entries r JOIN athletes a ON a.id=r.athlete_id WHERE r.team_id IN (${placeholders}) AND r.active=1${(game as any).season_id?' AND r.season_id=?':''} ORDER BY a.display_name ASC`
      const binds=(game as any).season_id?[...teamIds,(game as any).season_id]:teamIds
      const rows=await db.prepare(sql).bind(...binds).all()
      const seen=new Set<string>()
      athletes=(rows.results||[]).filter((r:any)=>r.athlete_id&&!seen.has(r.athlete_id)&&seen.add(r.athlete_id)).map((r:any)=>({...r,athlete:{id:r.athlete_id,display_name:r.display_name}}))
    }
    return NextResponse.json({ok:true,athletes,tagged:(tags.results||[]).map((x:any)=>x.athlete_id),suggestions:suggestions.results||[]})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not load athlete tags'},{status:500})}
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json(),photoId=String(body?.photoId||'').trim(),action=String(body?.action||'').trim()
    if(!photoId)return NextResponse.json({ok:false,error:'photoId required'},{status:400})
    const db=getDb()
    const athleteId=String(body?.athleteId||'').trim()
    if(action==='add'){
      if(!athleteId)return NextResponse.json({ok:false,error:'athleteId required'},{status:400})
      await db.prepare("INSERT OR IGNORE INTO photo_athletes (photo_id,athlete_id,created_at) VALUES (?,?,datetime('now'))").bind(photoId,athleteId).run()
      await db.prepare("UPDATE photo_tag_suggestions SET status='approved',reviewed_at=datetime('now'),reviewed_by='admin' WHERE photo_id=? AND athlete_id=? AND status='pending'").bind(photoId,athleteId).run()
    }else if(action==='remove'){
      if(!athleteId)return NextResponse.json({ok:false,error:'athleteId required'},{status:400})
      await db.prepare('DELETE FROM photo_athletes WHERE photo_id=? AND athlete_id=?').bind(photoId,athleteId).run()
    }else if(action==='approveSuggestion'){
      if(!athleteId)return NextResponse.json({ok:false,error:'athleteId required'},{status:400})
      await db.prepare("UPDATE photo_tag_suggestions SET status='approved',reviewed_at=datetime('now'),reviewed_by='admin' WHERE photo_id=? AND athlete_id=?").bind(photoId,athleteId).run()
    }else if(action==='approveAll'){
      const ids=Array.isArray(body?.athleteIds)?body.athleteIds.map((x:any)=>String(x||'').trim()).filter(Boolean):[]
      for(const id of ids){
        await db.prepare("INSERT OR IGNORE INTO photo_athletes (photo_id,athlete_id,created_at) VALUES (?,?,datetime('now'))").bind(photoId,id).run()
        await db.prepare("UPDATE photo_tag_suggestions SET status='approved',reviewed_at=datetime('now'),reviewed_by='admin' WHERE photo_id=? AND athlete_id=?").bind(photoId,id).run()
      }
    }else return NextResponse.json({ok:false,error:'Invalid action'},{status:400})
    return NextResponse.json({ok:true})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not update athlete tags'},{status:500})}
}
