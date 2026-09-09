import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

function norm(v:unknown){
  return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\b(central|school|academy|csd|high)\b/g,' ').replace(/\s+/g,' ').trim()
}
function slugify(v:string){return v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120)}
function parseResults(raw:unknown){
  return String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((line,index)=>{
    const cleaned=line.replace(/^#?\d+[.)-]?\s+/,'').trim()
    const m=cleaned.match(/^(.*?)\s+(\d+)$/)
    if(!m)return null
    return {name:m[1].trim(),score:Number(m[2]),place:index+1}
  }).filter(Boolean) as {name:string;score:number;place:number}[]
}
function parseDualResults(raw:unknown){
  return String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{
    const cleaned=line.replace(/^#?\d+[.)-]?\s+/,'').trim()
    const m=cleaned.match(/^(.*?)\s+(\d+|INC|T)\s*,\s*(.*?)\s+(\d+|INC|T)$/i)
    if(!m)return null
    const token=(v:string)=>/^\d+$/.test(v)?Number(v):null
    const aScore=token(m[2]),bScore=token(m[4])
    let outcome:'W'|'L'|'T'='T'
    if(aScore!=null&&bScore!=null)outcome=aScore<bScore?'W':aScore>bScore?'L':'T'
    else if(aScore!=null&&bScore==null)outcome='W'
    else if(aScore==null&&bScore!=null)outcome='L'
    return {aName:m[1].trim(),bName:m[3].trim(),aScore,bScore,outcome}
  }).filter(Boolean) as {aName:string;bName:string;aScore:number|null;bScore:number|null;outcome:'W'|'L'|'T'}[]
}

export async function POST(req:NextRequest){
  const ok=await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)
  if(!ok)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  let body:any
  try{body=await req.json()}catch{return NextResponse.json({ok:false,error:'Invalid request'},{status:400})}
  if(!body?.meetName||!body?.meetDate)return NextResponse.json({ok:false,error:'Meet name and date are required.'},{status:400})

  const db=createAdminClient()
  const [{data:season},{data:sports},{data:teams},{data:externals}]=await Promise.all([
    db.from('seasons').select('id').eq('is_active',true).single(),
    db.from('sports').select('id,slug,gender').in('slug',['boys-cross-country','girls-cross-country']),
    db.from('teams').select('id,sport_id,team_name,school:schools(id,school_name,slug)').eq('active',true),
    db.from('external_opponents').select('id,name,slug')
  ])
  if(!season)return NextResponse.json({ok:false,error:'No active season.'},{status:400})

  let meet:any=null
  if(body.id){
    const {data,error}=await db.from('cross_country_meets').update({
      meet_name:String(body.meetName).slice(0,180),
      meet_date:body.meetDate,
      location:body.location?String(body.location).slice(0,180):null,
      meet_type:body.meetType||'Invitational',
      status:body.status||'Final',
      notes:body.notes?String(body.notes).slice(0,1000):null,
      updated_at:new Date().toISOString(),
    }).eq('id',body.id).select('*').single()
    if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
    meet=data
  }else{
    const {data:existing}=await db.from('cross_country_meets').select('*').eq('meet_name',String(body.meetName)).eq('meet_date',body.meetDate).maybeSingle()
    if(existing)meet=existing
    else{
      const {data,error}=await db.from('cross_country_meets').insert({
        season_id:season.id,meet_name:String(body.meetName).slice(0,180),meet_date:body.meetDate,
        location:body.location?String(body.location).slice(0,180):null,meet_type:body.meetType||'Invitational',
        status:body.status||'Final',notes:body.notes?String(body.notes).slice(0,1000):null,source:'admin'
      }).select('*').single()
      if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
      meet=data
    }
  }

  const allTeams=(teams||[]) as any[]
  const allExternals=(externals||[]) as any[]
  const sportMap=new Map((sports||[]).map((s:any)=>[s.gender,s]))

  function findTeamByName(sportId:string,name:string){
    const target=norm(name)
    return allTeams.find((t:any)=>{
      if(t.sport_id!==sportId)return false
      const school=Array.isArray(t.school)?t.school[0]:t.school
      return norm(school?.school_name)===target||norm(t.team_name)===target||norm(school?.slug)===target
        || norm(school?.school_name).startsWith(target)||target.startsWith(norm(school?.school_name))
    })
  }

  async function saveGender(gender:'Boys'|'Girls',raw:unknown){
    const sport:any=sportMap.get(gender)
    if(!sport)return

    if(meet.meet_type==='League'){
      const dualRows=parseDualResults(raw)
      if(String(raw||'').trim()&&!dualRows.length){
        throw new Error(gender+' league results must be entered one matchup per line, for example: Canton 21, Tupper Lake 40. Use INC for an incomplete team.')
      }
      await db.from('cross_country_dual_results').delete().eq('meet_id',meet.id).eq('sport_id',sport.id)
      const dualInserts:any[]=[]
      const participantIds=new Set<string>()
      for(const row of dualRows){
        const a=findTeamByName(sport.id,row.aName)
        const b=findTeamByName(sport.id,row.bName)
        if(!a||!b)throw new Error('Could not match '+gender+' XC team in line: '+row.aName+' / '+row.bName)
        participantIds.add(a.id);participantIds.add(b.id)
        dualInserts.push({
          meet_id:meet.id,sport_id:sport.id,team_a_id:a.id,team_b_id:b.id,
          team_a_score:row.aScore,team_b_score:row.bScore,outcome_a:row.outcome,source:'admin'
        })
      }
      if(dualInserts.length){
        const {error}=await db.from('cross_country_dual_results').insert(dualInserts)
        if(error)throw error
      }
      // Keep one participant row per team so schedules/team pages remain connected to the meet.
      await db.from('cross_country_team_results').delete().eq('meet_id',meet.id).eq('sport_id',sport.id)
      if(participantIds.size){
        const {error}=await db.from('cross_country_team_results').insert([...participantIds].map(teamId=>({
          meet_id:meet.id,sport_id:sport.id,team_id:teamId,is_section_x:true
        })))
        if(error)throw error
      }
      return
    }

    const rows=parseResults(raw)
    await db.from('cross_country_team_results').delete().eq('meet_id',meet.id).eq('sport_id',sport.id)
    const inserts:any[]=[]
    for(const row of rows){
      const target=norm(row.name)
      const team=findTeamByName(sport.id,row.name)
      if(team){
        inserts.push({meet_id:meet.id,sport_id:sport.id,team_id:team.id,team_score:row.score,finish_place:row.place,is_section_x:true})
        continue
      }
      let ext=allExternals.find((e:any)=>norm(e.name)===target)
      if(!ext){
        const {data}=await db.from('external_opponents').insert({name:row.name,slug:slugify(row.name),state:'NY',is_section_x:false}).select('id,name,slug').single()
        ext=data
        if(ext)allExternals.push(ext)
      }
      if(ext)inserts.push({meet_id:meet.id,sport_id:sport.id,external_opponent_id:ext.id,team_score:row.score,finish_place:row.place,is_section_x:false})
    }
    if(inserts.length){
      const {error}=await db.from('cross_country_team_results').insert(inserts)
      if(error)throw error
    }
  }

  try{
    await saveGender('Boys',body.boysResults)
    await saveGender('Girls',body.girlsResults)
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||'Could not save results.'},{status:500})
  }
  return NextResponse.json({ok:true,meet})
}
