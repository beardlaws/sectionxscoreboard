import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest,NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE,verifyAdminSession } from '@/lib/admin-auth'
import { previewNorthCountrySportsCrossCountry } from '@/lib/scores/north-country-sports-xc'

export const dynamic='force-dynamic'
export const maxDuration=60

async function auth(req:NextRequest){return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)}
function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

export async function GET(req:NextRequest){
 if(!await auth(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
 const date=req.nextUrl.searchParams.get('date')||new Date().toISOString().slice(0,10)
 try{return NextResponse.json({ok:true,...await previewNorthCountrySportsCrossCountry(date)})}
 catch(e:any){return NextResponse.json({ok:false,error:e?.message||'NCS check failed'},{status:500})}
}

export async function POST(req:NextRequest){
 if(!await auth(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
 try{
  const body=await req.json(),meetId=String(body.meetId||''),date=String(body.date||'')
  if(!meetId||!date)return NextResponse.json({ok:false,error:'Meet and date required'},{status:400})
  const preview=await previewNorthCountrySportsCrossCountry(date),candidate=preview.suggestions.find((x:any)=>x.meetId===meetId)
  if(!candidate)return NextResponse.json({ok:false,error:'No matching scheduled meet found.'},{status:404})
  if(candidate.confidence!=='high')return NextResponse.json({ok:false,error:'North Country Sports did not resolve every scheduled dual. Review the remaining matchups manually.'},{status:409})

  const db=getDb()
  const sportsResult=await db.prepare("SELECT id,gender FROM sports WHERE slug IN ('boys-cross-country','girls-cross-country')").all()
  const sports:any[]=sportsResult.results||[]
  let published=0
  for(const gender of ['Boys','Girls']){
    const sport:any=sports.find((s:any)=>s.gender===gender),rows=candidate[gender.toLowerCase()]||[]
    if(!sport||!rows.length)continue
    const statements:any[]=[db.prepare('DELETE FROM cross_country_dual_results WHERE meet_id=? AND sport_id=?').bind(meetId,sport.id)]
    for(const r of rows){
      statements.push(db.prepare(`INSERT INTO cross_country_dual_results
        (id,meet_id,sport_id,team_a_id,team_b_id,team_a_score,team_b_score,outcome_a,source,notes,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`)
        .bind(crypto.randomUUID(),meetId,sport.id,r.teamAId,r.teamBId,r.teamAScore,r.teamBScore,r.outcomeA,'northcountrysports','Imported from North Country Sports season page'))
    }
    await db.batch(statements)
    published+=rows.length
  }
  const now=new Date().toISOString()
  await db.batch([
    db.prepare('UPDATE cross_country_meets SET status=?,source=?,source_payload=?,updated_at=? WHERE id=?')
      .bind('Final','northcountrysports',JSON.stringify({urls:preview.sourceUrls,checked_at:now,candidate}),now,meetId),
    db.prepare(`INSERT INTO import_logs (id,import_type,raw_input,rows_parsed,rows_approved,rows_rejected,status,imported_by,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(),'cross-country-dual-results',JSON.stringify(candidate),candidate.matched,published,0,'complete','admin:northcountrysports-xc',now),
  ])
  return NextResponse.json({ok:true,published,meetId})
 }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not publish North Country Sports results.'},{status:500})}
}
