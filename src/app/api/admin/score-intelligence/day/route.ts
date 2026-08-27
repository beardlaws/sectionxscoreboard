import { NextRequest,NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic='force-dynamic'
const dateOnly=(v:string|null)=>{if(v&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;return new Date().toISOString().slice(0,10)}

export async function GET(req:NextRequest){
  const date=dateOnly(req.nextUrl.searchParams.get('date')),db=createAdminClient()
  try{
    const [{data:games,error:ge},{data:teams,error:te},{data:schools,error:se},{data:sports,error:spe},{data:ext,error:ee}]=await Promise.all([
      db.from('games').select('id,game_date,game_time,sport_id,home_team_id,away_team_id,external_home_opponent_id,external_away_opponent_id,home_score,away_score,status,source,verification_status').eq('game_date',date).order('game_time'),
      db.from('teams').select('id,team_name,school_id'),db.from('schools').select('id,school_name'),db.from('sports').select('id,sport_name,gender'),db.from('external_opponents').select('id,name')])
    const err=ge||te||se||spe||ee;if(err)throw new Error(err.message)
    const teamById=new Map((teams||[]).map((x:any)=>[x.id,x])),schoolById=new Map((schools||[]).map((x:any)=>[x.id,x])),sportById=new Map((sports||[]).map((x:any)=>[x.id,x])),extById=new Map((ext||[]).map((x:any)=>[x.id,x]))
    const side=(g:any,h:boolean)=>{const tid=h?g.home_team_id:g.away_team_id,eid=h?g.external_home_opponent_id:g.external_away_opponent_id;if(tid){const t=teamById.get(tid) as any,s=schoolById.get(t?.school_id) as any;return s?.school_name||t?.team_name||'Unknown'}return eid?((extById.get(eid) as any)?.name||'External'):'TBA'}
    const rows=(games||[]).map((g:any)=>{const s=sportById.get(g.sport_id) as any;const scored=g.home_score!=null&&g.away_score!=null,final=String(g.status||'').toLowerCase()==='final';return{id:g.id,date:g.game_date,time:g.game_time,sport:s?.sport_name||'Unknown',gender:s?.gender||null,home:side(g,true),away:side(g,false),homeScore:g.home_score,awayScore:g.away_score,status:g.status,source:g.source,verificationStatus:g.verification_status,resultState:final&&scored?'final':scored?'score-reported':'missing-result'}})
    const count=(x:string)=>rows.filter((r:any)=>r.resultState===x).length
    return NextResponse.json({ok:true,date,summary:{games:rows.length,final:count('final'),reported:count('score-reported'),missing:count('missing-result')},rows})
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Daily results lookup failed'},{status:500})}
}
