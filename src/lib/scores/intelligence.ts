import { createAdminClient } from '@/lib/supabase/server'

export type ScoreSource='manual-batch'|'highschoolsportstats'|'northcountrysports'|'other'
export type ScoreRecord={date:string,sport?:string|null,away:string,awayScore:number,home:string,homeScore:number,status?:string|null,sourceKey?:string|null,sourceUrl?:string|null}

const clean=(v:unknown)=>String(v??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()
const scoreNum=(v:unknown)=>Number.isFinite(Number(v))?Number(v):null
const dateOnly=(v:unknown)=>{const s=String(v??'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const d=new Date(s);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)}
const suffixes=['central school district','central high school','central school','high school','junior senior high school','jr sr high school','academy']
function schoolKey(v:unknown){let c=clean(v);c=c.replace(/\bogdensburg free academy\b/g,'ogdensburg').replace(/\bofa\b/g,'ogdensburg').replace(/\bst[ .]?lawrence\b/g,'st lawrence');for(const s of suffixes)c=c.replace(new RegExp(`\\b${s.replace(/ /g,'\\s+')}\\b`,'g'),' ');return c.replace(/\b(boys|girls|varsity|soccer|football|volleyball|basketball|hockey|softball|baseball|lacrosse|swimming|cross country)\b/g,' ').replace(/\s+/g,' ').trim()}
function sportIdentity(name:unknown,gender?:unknown){const raw=clean(name),g=clean(gender);const inferred=raw.includes('girls')||raw.includes('womens')?'girls':raw.includes('boys')||raw.includes('mens')?'boys':g.includes('girl')||g.includes('women')?'girls':g.includes('boy')||g.includes('men')?'boys':'';const base=raw.replace(/\b(boys|girls|mens|womens|varsity)\b/g,'').replace(/\s+/g,' ').trim();return`${inferred}:${base}`}

export function parseScoreText(text:string):{records:ScoreRecord[],errors:string[]}{
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),records:ScoreRecord[]=[],errors:string[]=[]
  if(!lines.length)return{records,errors:['No score rows were provided.']}
  const delim=(line:string)=>line.includes('\t')?'\t':line.includes('|')?'|':','
  const firstParts=lines[0].split(delim(lines[0])).map(x=>clean(x)),hasHeader=firstParts.some(x=>['date','sport','away','away team','away score','home','home team','home score'].includes(x));let header:Record<string,number>={},start=0
  if(hasHeader){firstParts.forEach((x,i)=>header[x]=i);start=1}
  const pick=(parts:string[],names:string[],fallback:number)=>{for(const n of names){if(header[n]!=null)return parts[header[n]]??''}return parts[fallback]??''}
  for(let i=start;i<lines.length;i++){
    const parts=lines[i].split(delim(lines[i])).map(x=>x.trim());let date='',sport='',away='',home='',awayRaw='',homeRaw=''
    if(hasHeader){date=pick(parts,['date'],0);sport=pick(parts,['sport'],1);away=pick(parts,['away','away team'],2);awayRaw=pick(parts,['away score'],3);home=pick(parts,['home','home team'],4);homeRaw=pick(parts,['home score'],5)}
    else{if(parts.length<6){errors.push(`Line ${i+1}: expected Date, Sport, Away, Away Score, Home, Home Score.`);continue};[date,sport,away,awayRaw,home,homeRaw]=parts}
    const normalizedDate=dateOnly(date),as=scoreNum(awayRaw),hs=scoreNum(homeRaw);if(!normalizedDate||!away||!home||as===null||hs===null){errors.push(`Line ${i+1}: could not parse a complete final score.`);continue}
    records.push({date:normalizedDate,sport:sport||null,away,awayScore:as,home,homeScore:hs,status:'Final'})
  }
  return{records,errors}
}

export async function previewScores(records:ScoreRecord[],source:ScoreSource){
  const db=createAdminClient(),dates=records.map(r=>r.date).filter(Boolean).sort();if(!dates.length)return{source,summary:{received:0,matched:0,safe:0,verified:0,conflicts:0,ambiguous:0,unmatched:0},rows:[]}
  const [{data:games,error:ge},{data:teams,error:te},{data:schools,error:se},{data:sports,error:spe},{data:ext,error:ee}]=await Promise.all([
    db.from('games').select('id,game_date,game_time,sport_id,home_team_id,away_team_id,external_home_opponent_id,external_away_opponent_id,home_score,away_score,status,source,verification_status').gte('game_date',dates[0]).lte('game_date',dates[dates.length-1]),
    db.from('teams').select('id,team_name,school_id,sport_id'),db.from('schools').select('id,school_name,alias,slug'),db.from('sports').select('id,sport_name,gender,slug'),db.from('external_opponents').select('id,name,slug')])
  const err=ge||te||se||spe||ee;if(err)throw new Error(`Score Intelligence lookup failed: ${err.message}`)
  const schoolById=new Map((schools||[]).map((x:any)=>[x.id,x])),teamById=new Map((teams||[]).map((x:any)=>[x.id,x])),sportById=new Map((sports||[]).map((x:any)=>[x.id,x])),extById=new Map((ext||[]).map((x:any)=>[x.id,x]))
  const sideName=(g:any,home:boolean)=>{const tid=home?g.home_team_id:g.away_team_id,eid=home?g.external_home_opponent_id:g.external_away_opponent_id;if(tid){const t=teamById.get(tid) as any,s=schoolById.get(t?.school_id) as any;return s?.school_name||t?.team_name||''}if(eid)return (extById.get(eid) as any)?.name||'';return''}
  const rows=records.map((r,index)=>{
    const aKey=schoolKey(r.away),hKey=schoolKey(r.home),srcSport=r.sport?sportIdentity(r.sport):''
    const candidates=(games||[]).filter((g:any)=>g.game_date===r.date).filter((g:any)=>{
      if(srcSport){const s=sportById.get(g.sport_id) as any;if(s&&sportIdentity(s.sport_name,s.gender)!==srcSport)return false}
      const dbH=schoolKey(sideName(g,true)),dbA=schoolKey(sideName(g,false));return(dbH===hKey&&dbA===aKey)||(dbH===aKey&&dbA===hKey)
    })
    if(candidates.length!==1)return{index,...r,bucket:candidates.length?'ambiguous':'unmatched',safeToApply:false,candidateGameIds:candidates.map((g:any)=>g.id)}
    const g=candidates[0],dbHomeName=sideName(g,true),dbAwayName=sideName(g,false),sameOrientation=schoolKey(dbHomeName)===hKey&&schoolKey(dbAwayName)===aKey,desiredHome=sameOrientation?r.homeScore:r.awayScore,desiredAway=sameOrientation?r.awayScore:r.homeScore,dbHome=g.home_score==null?null:Number(g.home_score),dbAway=g.away_score==null?null:Number(g.away_score),blank=dbHome===null&&dbAway===null,same=dbHome===desiredHome&&dbAway===desiredAway
    let bucket='conflict',safeToApply=false;if(same)bucket='verified';else if(blank){bucket='safe-fill';safeToApply=true}else if(clean(g.source)===clean(source)){bucket='safe-update';safeToApply=true}
    const sport=sportById.get(g.sport_id) as any
    return{index,...r,gameId:g.id,bucket,safeToApply,matched:{home:dbHomeName,away:dbAwayName,sport:sport?.sport_name||null,gender:sport?.gender||null,currentHome:dbHome,currentAway:dbAway,currentStatus:g.status,currentSource:g.source},desired:{home:desiredHome,away:desiredAway,status:'Final'}}
  })
  const count=(b:string)=>rows.filter((r:any)=>r.bucket===b).length
  return{source,summary:{received:rows.length,matched:rows.filter((r:any)=>r.gameId).length,safe:count('safe-fill')+count('safe-update'),verified:count('verified'),conflicts:count('conflict'),ambiguous:count('ambiguous'),unmatched:count('unmatched')},rows}
}

export async function applyPreviewRows(rows:any[],source:ScoreSource){
  const db=createAdminClient();let updated=0,skipped=0,failed=0;const actions:any[]=[]
  for(const row of rows){if(!row?.gameId||!row?.safeToApply||!['safe-fill','safe-update'].includes(row.bucket)){skipped++;continue}
    try{const {data:game,error:readError}=await db.from('games').select('id,home_score,away_score,source').eq('id',row.gameId).single();if(readError||!game)throw new Error(readError?.message||'Game not found');const currentBlank=game.home_score==null&&game.away_score==null,sourceOwned=clean(game.source)===clean(source);if(!currentBlank&&!sourceOwned){skipped++;actions.push({gameId:row.gameId,outcome:'conflict-protected'});continue}
      const {error}=await db.from('games').update({home_score:Number(row.desired.home),away_score:Number(row.desired.away),status:'Final',verification_status:'Reported',source,updated_at:new Date().toISOString()}).eq('id',row.gameId);if(error)throw new Error(error.message);updated++;actions.push({gameId:row.gameId,outcome:'updated'})
    }catch(error){failed++;actions.push({gameId:row.gameId,outcome:'failed',error:error instanceof Error?error.message:String(error)})}}
  return{updated,skipped,failed,actions}
}
