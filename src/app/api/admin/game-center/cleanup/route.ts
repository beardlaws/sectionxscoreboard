// Cloudflare-native Game Center cleanup
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function tableExists(db:any,name:string){
  const row:any=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").bind(name).first()
  return Boolean(row)
}
async function countWhere(db:any,table:string,column:string,value:string){
  if(!await tableExists(db,table))return 0
  const row:any=await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column}=?`).bind(value).first()
  return Number(row?.count||0)
}
async function getPreview(db:any,gameId:string){
  const game:any=await db.prepare('SELECT id,game_date,status,home_score,away_score FROM games WHERE id=? LIMIT 1').bind(gameId).first()
  if(!game)return null
  const photoResult=await db.prepare('SELECT id,photo_url,storage_provider,storage_key FROM photos WHERE game_id=?').bind(gameId).all()
  const photos:any[]=photoResult.results||[]
  const photoIds=photos.map(p=>p.id)
  let photoAthletes=0
  if(photoIds.length&&await tableExists(db,'photo_athletes')){
    const marks=photoIds.map(()=>'?').join(',')
    const row:any=await db.prepare(`SELECT COUNT(*) AS count FROM photo_athletes WHERE photo_id IN (${marks})`).bind(...photoIds).first()
    photoAthletes=Number(row?.count||0)
  }
  const [periodScores,teamStats,athleteStats,importSources,corrections,shoutouts]=await Promise.all([
    countWhere(db,'game_period_scores','game_id',gameId),
    countWhere(db,'game_team_stats','game_id',gameId),
    countWhere(db,'game_athlete_stats','game_id',gameId),
    countWhere(db,'game_import_sources','game_id',gameId),
    countWhere(db,'correction_requests','game_id',gameId),
    countWhere(db,'shoutouts','game_id',gameId),
  ])
  return {game,counts:{periodScores,teamStats,athleteStats,importSources,photos:photos.length,photoAthletes,corrections,shoutouts},photos}
}

export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>null)
  const gameId=String(body?.gameId||'').trim(),action=String(body?.action||'delete')
  if(!gameId)return NextResponse.json({error:'gameId required'},{status:400})
  try{
    const {env}=getCloudflareContext(),db=(env as any).DB,bucket=(env as any).PHOTOS
    if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
    const preview=await getPreview(db,gameId)
    if(!preview)return NextResponse.json({error:'Game not found'},{status:404})
    if(action==='preview')return NextResponse.json({ok:true,preview})

    const r2Keys=preview.photos.filter((p:any)=>p.storage_provider==='r2'&&p.storage_key).map((p:any)=>String(p.storage_key))
    if(r2Keys.length){
      if(!bucket)throw new Error('R2 PHOTOS binding is unavailable')
      await Promise.all(r2Keys.map((key:string)=>bucket.delete(key)))
    }

    const photoIds=preview.photos.map((p:any)=>p.id)
    if(photoIds.length){
      const marks=photoIds.map(()=>'?').join(',')
      if(await tableExists(db,'photo_tag_suggestions'))await db.prepare(`DELETE FROM photo_tag_suggestions WHERE photo_id IN (${marks})`).bind(...photoIds).run()
      if(await tableExists(db,'photo_athletes'))await db.prepare(`DELETE FROM photo_athletes WHERE photo_id IN (${marks})`).bind(...photoIds).run()
      await db.prepare('DELETE FROM photos WHERE game_id=?').bind(gameId).run()
    }
    if(await tableExists(db,'correction_requests'))await db.prepare('DELETE FROM correction_requests WHERE game_id=?').bind(gameId).run()
    if(await tableExists(db,'shoutouts'))await db.prepare('UPDATE shoutouts SET game_id=NULL WHERE game_id=?').bind(gameId).run()
    for(const table of ['game_period_scores','game_team_stats','game_athlete_stats','game_import_sources']){
      if(await tableExists(db,table))await db.prepare(`DELETE FROM ${table} WHERE game_id=?`).bind(gameId).run()
    }
    await db.prepare('DELETE FROM games WHERE id=?').bind(gameId).run()

    const remaining=await countWhere(db,'games','id',gameId)
      +await countWhere(db,'game_period_scores','game_id',gameId)
      +await countWhere(db,'game_team_stats','game_id',gameId)
      +await countWhere(db,'game_athlete_stats','game_id',gameId)
      +await countWhere(db,'game_import_sources','game_id',gameId)
      +await countWhere(db,'photos','game_id',gameId)
      +await countWhere(db,'correction_requests','game_id',gameId)
      +await countWhere(db,'shoutouts','game_id',gameId)

    return NextResponse.json({ok:remaining===0,deleted:preview.counts,removedStorageFiles:r2Keys.length,verifiedClean:remaining===0,remainingReferences:remaining})
  }catch(error:any){
    console.error('[game-center-cleanup]',error)
    return NextResponse.json({error:error?.message||'Cleanup failed'},{status:500})
  }
}
