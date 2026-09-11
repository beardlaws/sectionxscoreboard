import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}
function norm(v:unknown){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\b(central|school|academy|csd|high)\b/g,' ').replace(/\s+/g,' ').trim()}
function slugify(v:string){return v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120)}
function parseResults(raw:unknown){return String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((line,index)=>{const cleaned=line.replace(/^#?\d+[.)-]?\s+/,'').trim(),m=cleaned.match(/^(.*?)\s+(\d+)$/);if(!m)return null;return{name:m[1].trim(),score:Number(m[2]),place:index+1}}).filter(Boolean) as {name:string;score:number;place:number}[]}
function parseDualResults(raw:unknown){return String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{const cleaned=line.replace(/^#?\d+[.)-]?\s+/,'').trim(),m=cleaned.match(/^(.*?)\s+(\d+|INC|T)\s*,\s*(.*?)\s+(\d+|INC|T)$/i);if(!m)return null;const token=(v:string)=>/^\d+$/.test(v)?Number(v):null,aScore=token(m[2]),bScore=token(m[4]);let outcome:'W'|'L'|'T'='T';if(aScore!=null&&bScore!=null)outcome=aScore<bScore?'W':aScore>bScore?'L':'T';else if(aScore!=null&&bScore==null)outcome='W';else if(aScore==null&&bScore!=null)outcome='L';return{aName:m[1].trim(),bName:m[3].trim(),aScore,bScore,outcome}}).filter(Boolean) as {aName:string;bName:string;aScore:number|null;bScore:number|null;outcome:'W'|'L'|'T'}[]}

export async function POST(req:NextRequest){
  const ok=await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)
  if(!ok)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  let body:any
  try{body=await req.json()}catch{return NextResponse.json({ok:false,error:'Invalid request'},{status:400})}
  if(!body?.meetName||!body?.meetDate)return NextResponse.json({ok:false,error:'Meet name and date are required.'},{status:400})

  try{
    const db=getDb(),now=new Date().toISOString()
    const [season,sportsResult,teamsResult,externalsResult]=await Promise.all([
      db.prepare('SELECT id FROM seasons WHERE is_active=1 LIMIT 1').first(),
      db.prepare("SELECT id,slug,gender FROM sports WHERE slug IN ('boys-cross-country','girls-cross-country')").all(),
      db.prepare(`SELECT t.id,t.sport_id,t.team_name,s.id AS school_id,s.school_name,s.slug AS school_slug FROM teams t LEFT JOIN schools s ON s.id=t.school_id WHERE t.active=1`).all(),
      db.prepare('SELECT id,name,slug FROM external_opponents').all(),
    ])
    if(!season)return NextResponse.json({ok:false,error:'No active season.'},{status:400})
    const sports:any[]=sportsResult.results||[],allTeams:any[]=teamsResult.results||[],allExternals:any[]=externalsResult.results||[]

    let meet:any=null
    if(body.id){
      await db.prepare(`UPDATE cross_country_meets SET meet_name=?,meet_date=?,location=?,meet_type=?,status=?,notes=?,updated_at=? WHERE id=?`)
        .bind(String(body.meetName).slice(0,180),body.meetDate,body.location?String(body.location).slice(0,180):null,body.meetType||'Invitational',body.status||'Final',body.notes?String(body.notes).slice(0,1000):null,now,String(body.id)).run()
      meet=await db.prepare('SELECT * FROM cross_country_meets WHERE id=? LIMIT 1').bind(String(body.id)).first()
    }else{
      meet=await db.prepare('SELECT * FROM cross_country_meets WHERE meet_name=? AND meet_date=? LIMIT 1').bind(String(body.meetName),body.meetDate).first()
      if(!meet){
        const id=crypto.randomUUID()
        await db.prepare(`INSERT INTO cross_country_meets (id,season_id,meet_name,meet_date,location,meet_type,status,notes,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id,(season as any).id,String(body.meetName).slice(0,180),body.meetDate,body.location?String(body.location).slice(0,180):null,body.meetType||'Invitational',body.status||'Final',body.notes?String(body.notes).slice(0,1000):null,'admin',now,now).run()
        meet=await db.prepare('SELECT * FROM cross_country_meets WHERE id=? LIMIT 1').bind(id).first()
      }
    }
    if(!meet)return NextResponse.json({ok:false,error:'Could not create or load meet.'},{status:500})

    const sportMap=new Map(sports.map((s:any)=>[s.gender,s]))
    function findTeamByName(sportId:string,name:string){const target=norm(name);return allTeams.find((t:any)=>t.sport_id===sportId&&(norm(t.school_name)===target||norm(t.team_name)===target||norm(t.school_slug)===target||norm(t.school_name).startsWith(target)||target.startsWith(norm(t.school_name))))}

    async function saveGender(gender:'Boys'|'Girls',raw:unknown){
      const sport:any=sportMap.get(gender);if(!sport)return
      if(meet.meet_type==='League'){
        const dualRows=parseDualResults(raw)
        if(String(raw||'').trim()&&!dualRows.length)throw new Error(gender+' league results must be entered one matchup per line, for example: Canton 21, Tupper Lake 40. Use INC for an incomplete team.')
        const statements:any[]=[
          db.prepare('DELETE FROM cross_country_dual_results WHERE meet_id=? AND sport_id=?').bind(meet.id,sport.id),
          db.prepare('DELETE FROM cross_country_team_results WHERE meet_id=? AND sport_id=?').bind(meet.id,sport.id),
        ]
        const participantIds=new Set<string>()
        for(const row of dualRows){
          const a=findTeamByName(sport.id,row.aName),b=findTeamByName(sport.id,row.bName)
          if(!a||!b)throw new Error('Could not match '+gender+' XC team in line: '+row.aName+' / '+row.bName)
          participantIds.add(a.id);participantIds.add(b.id)
          statements.push(db.prepare(`INSERT INTO cross_country_dual_results (id,meet_id,sport_id,team_a_id,team_b_id,team_a_score,team_b_score,outcome_a,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),meet.id,sport.id,a.id,b.id,row.aScore,row.bScore,row.outcome,'admin',now,now))
        }
        for(const teamId of participantIds){statements.push(db.prepare(`INSERT INTO cross_country_team_results (id,meet_id,sport_id,team_id,is_section_x,created_at) VALUES (?,?,?,?,1,?)`).bind(crypto.randomUUID(),meet.id,sport.id,teamId,now))}
        await db.batch(statements);return
      }

      const rows=parseResults(raw),statements:any[]=[db.prepare('DELETE FROM cross_country_team_results WHERE meet_id=? AND sport_id=?').bind(meet.id,sport.id)]
      for(const row of rows){
        const target=norm(row.name),team=findTeamByName(sport.id,row.name)
        if(team){statements.push(db.prepare(`INSERT INTO cross_country_team_results (id,meet_id,sport_id,team_id,team_score,finish_place,is_section_x,created_at) VALUES (?,?,?,?,?,?,1,?)`).bind(crypto.randomUUID(),meet.id,sport.id,team.id,row.score,row.place,now));continue}
        let ext=allExternals.find((e:any)=>norm(e.name)===target)
        if(!ext){
          const id=crypto.randomUUID(),slug=slugify(row.name)
          await db.prepare(`INSERT INTO external_opponents (id,name,slug,state,is_section_x,created_at,updated_at) VALUES (?,?,?,?,0,?,?)`).bind(id,row.name,slug,'NY',now,now).run()
          ext={id,name:row.name,slug};allExternals.push(ext)
        }
        statements.push(db.prepare(`INSERT INTO cross_country_team_results (id,meet_id,sport_id,external_opponent_id,team_score,finish_place,is_section_x,created_at) VALUES (?,?,?,?,?,?,0,?)`).bind(crypto.randomUUID(),meet.id,sport.id,ext.id,row.score,row.place,now))
      }
      await db.batch(statements)
    }

    await saveGender('Boys',body.boysResults)
    await saveGender('Girls',body.girlsResults)
    return NextResponse.json({ok:true,meet})
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'Could not save results.'},{status:500})}
}
