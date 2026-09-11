import { NextRequest,NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { ADMIN_SESSION_COOKIE,verifyAdminSession } from '@/lib/admin-auth'

function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}
async function auth(req:NextRequest){return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)}
const PROFILE_FIELDS=new Set(['status','approved_at','approved_by','trust_level','can_submit_photos','can_tag_photos','can_submit_scores','can_live_score','can_publish_photos'])

export async function POST(req:NextRequest){
 if(!await auth(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
 const body=await req.json().catch(()=>null),action=String(body?.action||''),db=getDb(),now=new Date().toISOString()
 try{
  if(action==='profile-update'){
   const id=String(body?.id||'');if(!id)return NextResponse.json({ok:false,error:'Contributor id required.'},{status:400})
   const patch=body?.patch&&typeof body.patch==='object'?body.patch:{},entries=Object.entries(patch).filter(([k])=>PROFILE_FIELDS.has(k))
   if(!entries.length)return NextResponse.json({ok:false,error:'No supported fields supplied.'},{status:400})
   const sets=entries.map(([k])=>`"${k}"=?`).join(','),values=entries.map(([k,v])=>k.startsWith('can_')?(v?1:0):v)
   await db.prepare(`UPDATE contributor_profiles SET ${sets},updated_at=? WHERE id=?`).bind(...values,now,id).run()
   return NextResponse.json({ok:true})
  }
  if(action==='assign'){
   const contributorId=String(body?.contributorId||''),gameId=String(body?.gameId||''),role=String(body?.role||'coverage');if(!contributorId||!gameId)return NextResponse.json({ok:false,error:'Contributor and game required.'},{status:400})
   const existing:any=await db.prepare('SELECT id FROM contributor_game_assignments WHERE contributor_id=? AND game_id=? AND assignment_role=? LIMIT 1').bind(contributorId,gameId,role).first()
   if(existing?.id)await db.prepare('UPDATE contributor_game_assignments SET active=1 WHERE id=?').bind(existing.id).run()
   else await db.prepare('INSERT INTO contributor_game_assignments (id,contributor_id,game_id,assignment_role,active,created_at) VALUES (?,?,?,?,1,?)').bind(crypto.randomUUID(),contributorId,gameId,role,now).run()
   return NextResponse.json({ok:true})
  }
  if(action==='unassign'){
   const id=String(body?.id||'');if(!id)return NextResponse.json({ok:false,error:'Assignment id required.'},{status:400});await db.prepare('UPDATE contributor_game_assignments SET active=0 WHERE id=?').bind(id).run();return NextResponse.json({ok:true})
  }
  if(action==='coverage-create'){
   const gameId=String(body?.gameId||''),role=String(body?.role||'coverage'),notes=body?.notes?String(body.notes).slice(0,300):null;if(!gameId)return NextResponse.json({ok:false,error:'Game required.'},{status:400})
   await db.prepare('INSERT INTO contributor_coverage_requests (id,game_id,coverage_role,status,notes,requested_by,created_at,updated_at) VALUES (?,?,?,\'open\',?,\'admin\',?,?)').bind(crypto.randomUUID(),gameId,role,notes,now,now).run();return NextResponse.json({ok:true})
  }
  if(action==='coverage-close'){
   const id=String(body?.id||'');if(!id)return NextResponse.json({ok:false,error:'Coverage request id required.'},{status:400});await db.prepare("UPDATE contributor_coverage_requests SET status='cancelled',closed_at=?,updated_at=? WHERE id=?").bind(now,now,id).run();return NextResponse.json({ok:true})
  }
  return NextResponse.json({ok:false,error:'Unknown action.'},{status:400})
 }catch(error:any){console.error('[admin/contributors]',error);return NextResponse.json({ok:false,error:error?.message||'Contributor admin action failed.'},{status:500})}
}
