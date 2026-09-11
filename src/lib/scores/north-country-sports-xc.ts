import { getCloudflareContext } from '@opennextjs/cloudflare'

const BOYS_URL='https://www.northcountrysports.net/sxxcboys.html'
const GIRLS_URL='https://www.northcountrysports.net/sxxcgirls.html'

function getDb(){
  const {env}=getCloudflareContext()
  const db=(env as any).DB
  if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

function decodeHtml(value:string){return value.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&ndash;|&#8211;/gi,'–').replace(/&mdash;|&#8212;/gi,'—').replace(/&#(\d+);/g,(_,c)=>String.fromCharCode(Number(c)))}
function linesFrom(html:string){return decodeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|li|h1|h2|h3|h4|h5|h6|tr|td|section|article)>/gi,'\n').replace(/<[^>]+>/g,' ')).split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)}
function norm(v:any){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\b(central|school|academy|csd|high|varsity|boys|girls|cross|country)\b/g,' ').replace(/\s+/g,' ').trim()}
function longDate(date:string){return new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')).toUpperCase()}
function isDateHeading(line:string){return /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),\s+[A-Z]+\s+\d{1,2},\s+\d{4}$/i.test(line)}
function tokenScore(v:string){const s=v.trim().replace(/\.$/,'');if(/^\d+$/.test(s))return Number(s);if(/^inc(?:omplete)?$/i.test(s))return null;return undefined}
function parseSegments(line:string){
  return line.split(',').map(x=>x.trim()).map(seg=>{
    const m=seg.match(/^(.*?)\s+(\d+|inc\.?|incomplete)$/i)
    if(!m)return null
    const score=tokenScore(m[2]); if(score===undefined)return null
    return {name:m[1].trim(),score}
  }).filter(Boolean) as {name:string;score:number|null}[]
}
function pairsFromSegments(segments:{name:string;score:number|null}[]){
  const out:any[]=[]
  for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
    const a=segments[i],b=segments[j];let outcome:'W'|'L'|'T'='T'
    if(a.score!=null&&b.score!=null)outcome=a.score<b.score?'W':a.score>b.score?'L':'T'
    else if(a.score!=null&&b.score==null)outcome='W'
    else if(a.score==null&&b.score!=null)outcome='L'
    out.push({aName:a.name,bName:b.name,aScore:a.score,bScore:b.score,outcome,raw:null})
  }
  return out
}
function parseBlockPairs(lines:string[],expectedNames:string[]){
  const pairs:any[]=[]
  for(const line of lines){
    const sweep=line.match(/^(.*?)\s+sweeps?\s+(\d+)\s*[-–]\s*(\d+)\s+over\s+(.+?),\s*all\s+inc\.?$/i)
    if(sweep){
      const winner=sweep[1].trim(),ws=Number(sweep[2]),ls=Number(sweep[3])
      const opponents=sweep[4].split(/,|\s+&\s+/).map(x=>x.trim()).filter(Boolean)
      for(const opp of opponents)pairs.push({aName:winner,bName:opp,aScore:ws,bScore:ls,outcome:'W',raw:line})
      continue
    }
    const allOpp=line.match(/^(.*?)\s+inc\.?\s+to\s+all\s+(?:\w+\s+)?opponents$/i)
    if(allOpp){
      const loser=allOpp[1].trim()
      for(const opp of expectedNames.filter(x=>norm(x)!==norm(loser)))pairs.push({aName:loser,bName:opp,aScore:null,bScore:null,outcome:'L',raw:line})
      continue
    }
    const bothInc=line.match(/^(.*?)\s*(?:&|,)\s*(.*?)\s*,?\s*inc\.?$/i)
    if(bothInc&&!/\d/.test(line)){pairs.push({aName:bothInc[1].trim(),bName:bothInc[2].trim(),aScore:null,bScore:null,outcome:'T',raw:line});continue}
    const segs=parseSegments(line)
    if(segs.length>=2){for(const p of pairsFromSegments(segs))pairs.push({...p,raw:line})}
  }
  const mentionedInc=new Set<string>(),scoredTeams=new Set<string>()
  for(const line of lines){
    for(const seg of parseSegments(line)){if(seg.score==null)mentionedInc.add(norm(seg.name));else scoredTeams.add(norm(seg.name))}
    const incList=line.match(/^(.*?),\s*(.*?)\s+inc\.?$/i)
    if(incList&&!/\d/.test(line)){mentionedInc.add(norm(incList[1]));mentionedInc.add(norm(incList[2]))}
  }
  const expected=expectedNames.map(n=>({raw:n,norm:norm(n)})),seen=new Set(pairs.map(p=>[norm(p.aName),norm(p.bName)].sort().join('|')))
  for(let i=0;i<expected.length;i++)for(let j=i+1;j<expected.length;j++){
    const a=expected[i],b=expected[j],key=[a.norm,b.norm].sort().join('|')
    if(seen.has(key))continue
    const ai=mentionedInc.has(a.norm),bi=mentionedInc.has(b.norm)
    if(ai&&bi)pairs.push({aName:a.raw,bName:b.raw,aScore:null,bScore:null,outcome:'T',raw:'Both incomplete'})
    else if(ai&&!bi)pairs.push({aName:a.raw,bName:b.raw,aScore:null,bScore:null,outcome:'L',raw:a.raw+' incomplete'})
    else if(!ai&&bi)pairs.push({aName:a.raw,bName:b.raw,aScore:null,bScore:null,outcome:'W',raw:b.raw+' incomplete'})
  }
  return pairs
}
function sectionForDate(lines:string[],date:string){
  const target=longDate(date),start=lines.findIndex(x=>x.toUpperCase()===target)
  if(start<0)return []
  let end=lines.length
  for(let i=start+1;i<lines.length;i++){if(isDateHeading(lines[i])){end=i;break}}
  return lines.slice(start+1,end).filter(x=>!/^(NCSN|SECTION X|REGULAR-SEASON|REGULAR SEASON)/i.test(x))
}
function blocksFromSection(lines:string[]){
  const blocks:{heading:string;lines:string[]}[]=[];let current:{heading:string;lines:string[]}|null=null
  for(const line of lines){
    if(/^(Meet at|League Meet|Interdivisionals|Non League)/i.test(line)){current={heading:line,lines:[]};blocks.push(current);continue}
    if(!current){current={heading:'',lines:[]};blocks.push(current)}
    current.lines.push(line)
  }
  return blocks
}
function bestBlock(blocks:any[],meet:any){
  if(blocks.length<=1)return blocks[0]||{heading:'',lines:[]}
  const hay=[meet.meet_name,meet.location].map(norm).filter(Boolean)
  let best=blocks[0],score=-1
  for(const b of blocks){const bn=norm(b.heading);let s=0;for(const h of hay){for(const word of h.split(' ')){if(word.length>=4&&bn.includes(word))s++}}if(s>score){score=s;best=b}}
  return best
}

async function fetchPage(url:string){
  const response=await fetch(url,{cache:'no-store',headers:{'User-Agent':'SectionXScoreboard/1.0 (+https://sectionxscoreboard.com)',Accept:'text/html,application/xhtml+xml'}})
  if(!response.ok)throw new Error('North Country Sports returned HTTP '+response.status)
  return linesFrom(await response.text())
}

export async function previewNorthCountrySportsCrossCountry(date:string){
  const db=getDb()
  const [boysLines,girlsLines]=await Promise.all([fetchPage(BOYS_URL),fetchPage(GIRLS_URL)])
  const boysBlocks=blocksFromSection(sectionForDate(boysLines,date)),girlsBlocks=blocksFromSection(sectionForDate(girlsLines,date))
  const [meetQ,sportQ,teamQ]=await Promise.all([
    db.prepare(`SELECT * FROM cross_country_meets WHERE meet_date=? ORDER BY meet_time`).bind(date).all(),
    db.prepare(`SELECT id,gender,slug FROM sports WHERE slug IN ('boys-cross-country','girls-cross-country')`).all(),
    db.prepare(`SELECT t.id,t.sport_id,t.team_name,t.slug,s.school_name,s.slug AS school_slug FROM teams t LEFT JOIN schools s ON s.id=t.school_id WHERE COALESCE(t.active,1)=1`).all(),
  ])
  const meets=meetQ.results||[],sports=sportQ.results||[],teams=teamQ.results||[]
  const suggestions:any[]=[]
  for(const meet of meets){
    const participantQ=await db.prepare(`SELECT sport_id,team_id FROM cross_country_team_results WHERE meet_id=?`).bind(meet.id).all()
    const participants=participantQ.results||[]
    const suggestion:any={meetId:meet.id,meetName:meet.meet_name,status:meet.status,boys:[],girls:[],confidence:'none',sourceUrl:BOYS_URL,sourceUrls:{boys:BOYS_URL,girls:GIRLS_URL}}
    let matchedPairs=0,expectedPairs=0
    for(const gender of ['Boys','Girls']){
      const sport:any=sports.find((s:any)=>s.gender===gender);if(!sport)continue
      const expectedIds=participants.filter((p:any)=>p.sport_id===sport.id&&p.team_id).map((p:any)=>p.team_id)
      const expectedTeams=expectedIds.map((id:string)=>teams.find((t:any)=>t.id===id)).filter(Boolean) as any[]
      const expectedNames=expectedTeams.map((t:any)=>t.school_name||t.team_name)
      expectedPairs+=expectedIds.length*(expectedIds.length-1)/2
      const block=bestBlock(gender==='Boys'?boysBlocks:girlsBlocks,meet)
      const rawPairs=parseBlockPairs(block?.lines||[],expectedNames)
      const mapped:any[]=[],seen=new Set<string>()
      for(const p of rawPairs){
        const find=(name:string)=>expectedTeams.find((t:any)=>{const aliases=[t.school_name,t.school_slug,t.team_name,t.slug].map(norm).filter(Boolean);const n=norm(name);return aliases.some(a=>a===n||a.startsWith(n)||n.startsWith(a))})
        const a=find(p.aName),b=find(p.bName);if(!a||!b||a.id===b.id)continue
        const key=[a.id,b.id].sort().join('|');if(seen.has(key))continue;seen.add(key)
        mapped.push({teamAId:a.id,teamBId:b.id,teamA:a.school_name||a.team_name,teamB:b.school_name||b.team_name,teamAScore:p.aScore,teamBScore:p.bScore,outcomeA:p.outcome,summary:(a.school_name||a.team_name)+' '+(p.aScore??'INC')+', '+(b.school_name||b.team_name)+' '+(p.bScore??'INC')})
      }
      matchedPairs+=mapped.length;suggestion[gender.toLowerCase()]=mapped;suggestion[gender.toLowerCase()+'Block']=block?.heading||''
    }
    const ratio=expectedPairs?matchedPairs/expectedPairs:0;suggestion.matched=matchedPairs;suggestion.expected=expectedPairs;suggestion.confidence=ratio===1&&expectedPairs>=1?'high':ratio>=.6?'review':'low';suggestions.push(suggestion)
  }
  return {published:boysBlocks.length>0||girlsBlocks.length>0,date,sourceUrl:BOYS_URL,sourceUrls:{boys:BOYS_URL,girls:GIRLS_URL},suggestions,reason:boysBlocks.length||girlsBlocks.length?null:'No North Country Sports XC results found for '+date}
}
