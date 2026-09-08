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
 if(candidate.confidence!=='high')return NextResponse.json({ok:false,error:'This result needs manual review before publishing.'},{status:409})
 const db=createAdminClient(),{data:sports}=await db.from('sports').select('id,gender').in('slug',['boys-cross-country','girls-cross-country'])
 for(const gender of ['Boys','Girls']){
   const sport:any=(sports||[]).find((s:any)=>s.gender===gender),rows=candidate[gender.toLowerCase()]||[];if(!sport||!rows.length)continue
   for(let i=0;i<rows.length;i++)await db.from('cross_country_team_results').update({team_score:rows[i].score,finish_place:i+1}).eq('meet_id',meetId).eq('sport_id',sport.id).eq('team_id',rows[i].teamId)
 }
 await db.from('cross_country_meets').update({status:'Final',source:'northcountrysports',source_payload:{url:preview.sourceUrl,checked_at:new Date().toISOString(),candidate},updated_at:new Date().toISOString()}).eq('id',meetId)
 await db.from('import_logs').insert({import_type:'cross-country-score-review',raw_input:JSON.stringify(candidate),rows_parsed:candidate.matched,rows_approved:candidate.matched,rows_rejected:0,status:'complete',imported_by:'admin:northcountrysports-xc'})
 return NextResponse.json({ok:true,published:candidate.matched,meetId})
}
