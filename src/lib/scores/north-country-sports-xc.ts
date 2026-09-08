import { createAdminClient } from '@/lib/supabase/server'

const SOURCE_URL='https://www.northcountrysports.net/'

function decodeHtml(value:string){return value.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&ndash;|&#8211;/gi,'–').replace(/&mdash;|&#8212;/gi,'—').replace(/&#(\d+);/g,(_,c)=>String.fromCharCode(Number(c)))}
function linesFrom(html:string){return decodeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|li|h1|h2|h3|h4|h5|h6|tr|td|section|article)>/gi,'\n').replace(/<[^>]+>/g,' ')).split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)}
function norm(v:any){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\b(central|school|academy|csd|high|varsity|boys|girls|cross|country)\b/g,' ').replace(/\s+/g,' ').trim()}
function longDate(date:string){return new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))}
function parseTeamScore(line:string){const m=line.replace(/^#?\d+[.)-]?\s+/,'').match(/^(.*?)\s+(\d+)$/);return m?{name:m[1].trim(),score:Number(m[2])}:null}
function heading(line:string){const u=line.toUpperCase();if(u.includes('BOYS')&&u.includes('CROSS')&&u.includes('COUNTRY'))return 'Boys';if(u.includes('GIRLS')&&u.includes('CROSS')&&u.includes('COUNTRY'))return 'Girls';return null}

export async function fetchNorthCountrySportsCrossCountry(date:string){
 const response=await fetch(SOURCE_URL,{cache:'no-store',headers:{'User-Agent':'SectionXScoreboard/1.0 (+https://sectionxscoreboard.com)',Accept:'text/html,application/xhtml+xml'}})
 if(!response.ok)throw new Error('North Country Sports returned HTTP '+response.status)
 const lines=linesFrom(await response.text()), marker=(longDate(date)+' SCORES').toLowerCase(), start=lines.findIndex(x=>x.toLowerCase()===marker)
 if(start<0)return {published:false,date,sourceUrl:SOURCE_URL,boys:[],girls:[],raw:[],reason:'No published score block found for '+longDate(date)+'.'}
 let gender:string|null=null;const boys:any[]=[],girls:any[]=[],raw:string[]=[]
 for(let i=start+1;i<lines.length;i++){const line=lines[i];if(/^SCORES FOR\b/i.test(line)||/^[A-Z][A-Za-z]+ \d{1,2}, \d{4} SCORES$/i.test(line))break
   const h=heading(line);if(h){gender=h;raw.push(line);continue}
   if(/^(BOYS|GIRLS)\s+[A-Z]/i.test(line)&&!heading(line)){gender=null;continue}
   if(!gender)continue;raw.push(line);const r=parseTeamScore(line);if(r)(gender==='Boys'?boys:girls).push(r)
 }
 return {published:true,date,sourceUrl:SOURCE_URL,boys,girls,raw,reason:(boys.length||girls.length)?null:'No Cross Country team scores parsed.'}
}

export async function previewNorthCountrySportsCrossCountry(date:string){
 const db=createAdminClient(),source=await fetchNorthCountrySportsCrossCountry(date)
 const [{data:meets},{data:sports},{data:teams}]=await Promise.all([
   db.from('cross_country_meets').select('*').eq('meet_date',date).order('meet_time'),
   db.from('sports').select('id,gender').in('slug',['boys-cross-country','girls-cross-country']),
   db.from('teams').select('id,sport_id,team_name,school:schools(school_name)').eq('active',true)
 ])
 const suggestions:any[]=[]
 for(const meet of meets||[]){
   const {data:participants}=await db.from('cross_country_team_results').select('sport_id,team_id,team_score').eq('meet_id',meet.id)
   const suggestion:any={meetId:meet.id,meetName:meet.meet_name,status:meet.status,boys:[],girls:[],confidence:'none',sourceUrl:SOURCE_URL}
   let matched=0,total=0
   for(const gender of ['Boys','Girls']){
     const sport:any=(sports||[]).find((s:any)=>s.gender===gender);if(!sport)continue
     const expected=(participants||[]).filter((p:any)=>p.sport_id===sport.id&&p.team_id).map((p:any)=>p.team_id)
     const pool=gender==='Boys'?source.boys:source.girls
     for(const teamId of expected){total++;const team:any=(teams||[]).find((t:any)=>t.id===teamId);const school=Array.isArray(team?.school)?team.school[0]:team?.school
       const names=[team?.team_name,school?.school_name].map(norm).filter(Boolean);const found=pool.find((x:any)=>names.some(n=>n===norm(x.name)||n.includes(norm(x.name))||norm(x.name).includes(n)))
       if(found){matched++;suggestion[gender.toLowerCase()].push({teamId,name:school?.school_name||team?.team_name,score:found.score})}
     }
   }
   const ratio=total?matched/total:0;suggestion.matched=matched;suggestion.expected=total;suggestion.confidence=ratio===1&&total>=2?'high':ratio>=.6?'review':'low';suggestions.push(suggestion)
 }
 return {...source,suggestions}
}
