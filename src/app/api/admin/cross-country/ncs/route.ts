import { NextRequest,NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE,verifyAdminSession } from '@/lib/admin-auth'
import { previewNorthCountrySportsCrossCountry } from '@/lib/scores/north-country-sports-xc'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic='force-dynamic'
export const maxDuration=60

async function auth(req:NextRequest){return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)}

export async function GET(req:NextRequest){
 if(!await auth(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
 const date=req.nextUrl.searchParams.get('date')||new Date().toISOString().slice(0,10)
 try{return NextResponse.json({ok:true,...await previewNorthCountrySportsCrossCountry(date)})}
 catch(e:any){return NextResponse.json({ok:false,error:e?.message||'NCS check failed'},{status:500})}
}

export async function POST(req:NextRequest){
 if(!await auth(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
 const body=await req.json(),meetId=String(body.meetId||''),date=String(body.date||'')
 if(!meetId||!date)return NextResponse.json({ok:false,error:'Meet and date required'},{status:400})
 const preview=await previewNorthCountrySportsCrossCountry(date),candidate=preview.suggestions.find((x:any)=>x.meetId===meetId)
 if(!candidate)return NextResponse.json({ok:false,error:'No matching scheduled meet found.'},{status:404})
 if(candidate.confidence!=='high')return NextResponse.json({ok:false,error:'North Country Sports did not resolve every scheduled dual. Review the remaining matchups manually.'},{status:409})

 const db=createAdminClient(),{data:sports}=await db.from('sports').select('id,gender').in('slug',['boys-cross-country','girls-cross-country'])
 let published=0
 for(const gender of ['Boys','Girls']){
   const sport:any=(sports||[]).find((s:any)=>s.gender===gender),rows=candidate[gender.toLowerCase()]||[]
   if(!sport||!rows.length)continue
   await db.from('cross_country_dual_results').delete().eq('meet_id',meetId).eq('sport_id',sport.id)
   const inserts=rows.map((r:any)=>({
     meet_id:meetId,sport_id:sport.id,team_a_id:r.teamAId,team_b_id:r.teamBId,
     team_a_score:r.teamAScore,team_b_score:r.teamBScore,outcome_a:r.outcomeA,
     source:'northcountrysports',notes:'Imported from North Country Sports season page'
   }))
   const {error}=await db.from('cross_country_dual_results').insert(inserts)
   if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
   published+=inserts.length
 }
 await db.from('cross_country_meets').update({status:'Final',source:'northcountrysports',source_payload:{urls:preview.sourceUrls,checked_at:new Date().toISOString(),candidate},updated_at:new Date().toISOString()}).eq('id',meetId)
 await db.from('import_logs').insert({import_type:'cross-country-dual-results',raw_input:JSON.stringify(candidate),rows_parsed:candidate.matched,rows_approved:published,rows_rejected:0,status:'complete',imported_by:'admin:northcountrysports-xc'})
 return NextResponse.json({ok:true,published,meetId})
}
