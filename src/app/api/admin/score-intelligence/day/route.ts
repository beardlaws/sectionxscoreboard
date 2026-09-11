import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'
import { sectionXDate } from '@/lib/sectionx-time'

export const dynamic = 'force-dynamic'

const dateOnly = (v: string | null) => {
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return sectionXDate()
}
function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

export async function GET(req: NextRequest) {
  const date = dateOnly(req.nextUrl.searchParams.get('date'))
  try {
    const db=getDb()
    const result=await db.prepare(`
      SELECT g.id,g.game_date,g.game_time,g.home_score,g.away_score,g.status,g.source,g.verification_status,g.contest_type,g.result_exempt,g.result_exempt_reason,
        sp.sport_name,sp.gender,
        COALESCE(hs.school_name,ht.team_name,eh.name,'TBA') AS home_name,
        COALESCE(aschool.school_name,at.team_name,ea.name,'TBA') AS away_name
      FROM games g
      LEFT JOIN sports sp ON sp.id=g.sport_id
      LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN schools hs ON hs.id=ht.school_id
      LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN schools aschool ON aschool.id=at.school_id
      LEFT JOIN external_opponents eh ON eh.id=g.external_home_opponent_id
      LEFT JOIN external_opponents ea ON ea.id=g.external_away_opponent_id
      WHERE g.game_date=? ORDER BY g.game_time ASC
    `).bind(date).all()

    const rows=(result.results||[]).map((g:any)=>{
      const scored=g.home_score!=null&&g.away_score!=null,status=String(g.status||'').toLowerCase(),final=status==='final',scrimmage=String(g.contest_type||'').toLowerCase()==='scrimmage',excluded=['canceled','cancelled','postponed'].includes(status)
      return {id:g.id,date:g.game_date,time:g.game_time,sport:g.sport_name||'Unknown',gender:g.gender||null,home:g.home_name,away:g.away_name,homeScore:g.home_score,awayScore:g.away_score,status:g.status,source:g.source,verificationStatus:g.verification_status,contestType:g.contest_type,resultExempt:Boolean(g.result_exempt),resultExemptReason:g.result_exempt_reason||null,resultState:scrimmage?'scrimmage':excluded?'excluded':g.result_exempt?'exempt':final&&scored?'final':scored?'score-reported':'missing-result'}
    })
    const officialRows=rows.filter((r:any)=>!['scrimmage','excluded'].includes(r.resultState)),final=officialRows.filter((r:any)=>r.resultState==='final').length,reported=officialRows.filter((r:any)=>r.resultState==='score-reported').length,exempt=officialRows.filter((r:any)=>r.resultState==='exempt').length,missing=officialRows.filter((r:any)=>r.resultState==='missing-result').length,complete=final+reported,accounted=complete+exempt,officialGames=officialRows.length
    return NextResponse.json({ok:true,date,summary:{games:rows.length,officialGames,final,reported,exempt,missing,scrimmages:rows.filter((r:any)=>r.resultState==='scrimmage').length,excluded:rows.filter((r:any)=>r.resultState==='excluded').length,coverage:officialGames?Math.round((complete/officialGames)*100):100,accountedFor:officialGames?Math.round((accounted/officialGames)*100):100},rows})
  } catch (error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Daily results lookup failed'},{status:500})
  }
}
