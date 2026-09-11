import { NextRequest,NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { ADMIN_SESSION_COOKIE,verifyAdminSession } from '@/lib/admin-auth'

function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}
async function auth(req:NextRequest){return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)}

export async function POST(req:NextRequest){
 if(!await auth(req))return NextResponse.json({error:'Unauthorized'},{status:401})
 const body=await req.json().catch(()=>null),id=String(body?.updateId||''),action=String(body?.action||'')
 if(!id||!['approve','reject'].includes(action))return NextResponse.json({error:'updateId and valid action required.'},{status:400})
 const db=getDb(),update:any=await db.prepare('SELECT * FROM contributor_score_updates WHERE id=? LIMIT 1').bind(id).first()
 if(!update)return NextResponse.json({error:'Contributor update not found.'},{status:404})
 if(update.publication_status!=='pending')return NextResponse.json({error:`Update is already ${update.publication_status}.`},{status:409})
 const now=new Date().toISOString()
 if(action==='reject'){
  await db.batch([
   db.prepare("UPDATE contributor_score_updates SET publication_status='rejected',reviewed_by='admin',reviewed_at=? WHERE id=?").bind(now,id),
   db.prepare('UPDATE contributor_profiles SET rejected_count=COALESCE(rejected_count,0)+1,updated_at=? WHERE id=?').bind(now,update.contributor_id),
   db.prepare('INSERT INTO contributor_activity (id,contributor_id,event_type,entity_type,entity_id,details,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),update.contributor_id,'score-rejected','game',update.game_id,JSON.stringify({updateId:id}),now)
  ])
  return NextResponse.json({ok:true,action:'rejected'})
 }
 const game:any=await db.prepare('SELECT id,status,home_score,away_score,source,verification_status FROM games WHERE id=? LIMIT 1').bind(update.game_id).first()
 if(!game)return NextResponse.json({error:'Game not found.'},{status:404})
 await db.batch([
  db.prepare("UPDATE games SET home_score=?,away_score=?,status=?,source='contributor',verification_status='Reported',updated_at=? WHERE id=?").bind(update.home_score,update.away_score,update.game_status||game.status||'Final',now,update.game_id),
  db.prepare("UPDATE contributor_score_updates SET publication_status='published',reviewed_by='admin',reviewed_at=? WHERE id=?").bind(now,id),
  db.prepare('UPDATE contributor_profiles SET verified_count=COALESCE(verified_count,0)+1,updated_at=? WHERE id=?').bind(now,update.contributor_id),
  db.prepare('INSERT INTO contributor_activity (id,contributor_id,event_type,entity_type,entity_id,details,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),update.contributor_id,'score-approved','game',update.game_id,JSON.stringify({updateId:id,before:game,after:{home_score:update.home_score,away_score:update.away_score,status:update.game_status}}),now)
 ])
 return NextResponse.json({ok:true,action:'published'})
}
