import { writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const { Client } = pg
const connectionString = process.env.SUPABASE_MIGRATION_DATABASE_URL
if (!connectionString) throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL')

const DB_NAME='sectionxscoreboard-preview',WRANGLER_CONFIG='wrangler.jsonc',CHUNK_SIZE=125
const tables=[
  {name:'arbiter_team_links',key:['team_id'],columns:['team_id','arbiter_team_id','arbiter_school_id','source','confidence','observed_count','first_seen_at','last_seen_at','created_at','updated_at'],booleans:[]},
  {name:'arbiter_game_links',key:['arbiter_game_id'],columns:['arbiter_game_id','game_id','last_modified_at','last_seen_at','source_status','source_payload','created_at','updated_at'],booleans:[]},
  {name:'arbiter_sync_runs',key:['id'],columns:['id','season_id','mode','window_start','window_end','status','summary','created_at','finished_at'],booleans:[]},
  {name:'arbiter_sync_actions',key:['id'],columns:['id','run_id','arbiter_game_id','game_id','action','outcome','details','created_at'],booleans:[]},
  {name:'arbiter_health_checks',key:['id'],columns:['id','season_id','status','summary','changes','quarantines','created_at'],booleans:[]},
  {name:'arbiter_automation_runs',key:['id'],columns:['id','season_id','trigger_source','status','summary','started_at','finished_at'],booleans:[]},
  {name:'arbiter_roster_freshness',key:['team_id','season_id'],columns:['team_id','season_id','arbiter_team_id','status','verified','reason','incoming_count','previous_count','previous_overlap','evidence','checked_at'],booleans:['verified']},
  {name:'arbiter_roster_automation_runs',key:['id'],columns:['id','season_id','trigger_source','status','summary','started_at','finished_at'],booleans:[]},
  {name:'arbiter_school_mappings',key:['school_id'],columns:['school_id','school_url','entity_id','last_verified_at','created_at','updated_at'],booleans:[]},
  {name:'arbiter_team_mappings',key:['team_id'],columns:['team_id','school_id','schedule_url','arbiter_team_id','last_verified_at','created_at','updated_at'],booleans:[]},
  {name:'arbiter_shared_event_ids',key:['arbiter_game_id'],columns:['arbiter_game_id','reason','active','created_at','updated_at'],booleans:['active']},
  {name:'admin_exception_resolutions',key:['id'],columns:['id','season_id','arbiter_game_id','game_id','exception_bucket','resolution','note','evidence_fingerprint','evidence','active','created_at','updated_at'],booleans:['active']},
]
function sqlValue(v,isBoolean=false){if(v==null)return'NULL';if(isBoolean)return v?'1':'0';if(typeof v==='number'||typeof v==='bigint')return String(v);if(v instanceof Date)return `'${v.toISOString().replaceAll("'","''")}'`;if(typeof v==='object')return `'${JSON.stringify(v).replaceAll("'","''")}'`;return `'${String(v).replaceAll("'","''")}'`}
function upsert(t,row){const vals=t.columns.map(c=>sqlValue(row[c],t.booleans.includes(c))),updates=t.columns.filter(c=>!t.key.includes(c)).map(c=>`"${c}"=excluded."${c}"`).join(',');return `INSERT INTO "${t.name}" (${t.columns.map(c=>`"${c}"`).join(',')}) VALUES (${vals.join(',')}) ON CONFLICT (${t.key.map(c=>`"${c}"`).join(',')}) DO UPDATE SET ${updates};`}
function execSql(file){execFileSync('npx',['wrangler','d1','execute',DB_NAME,'--remote','--config',WRANGLER_CONFIG,'--file',file,'--yes'],{stdio:'inherit',env:process.env})}
const client=new Client({connectionString,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000,query_timeout:30000,statement_timeout:30000})
try{
 await client.connect()
 const identity=await client.query("SELECT current_user,current_setting('default_transaction_read_only') AS read_only")
 const info=identity.rows[0]
 if(!String(info.current_user).startsWith('cloudflare_migration_reader')||info.read_only!=='on')throw new Error('Refusing Arbiter seed without guarded read-only migration role')
 await client.query('BEGIN READ ONLY')
 const schools=await client.query('SELECT id,arbiter_entity_id,arbiter_school_url FROM public.schools WHERE arbiter_entity_id IS NOT NULL OR arbiter_school_url IS NOT NULL ORDER BY id')
 if(schools.rows.length){const file='/tmp/sectionx-arbiter-schools.sql';writeFileSync(file,['PRAGMA foreign_keys = ON;',...schools.rows.map(r=>`UPDATE schools SET arbiter_entity_id=${sqlValue(r.arbiter_entity_id)},arbiter_school_url=${sqlValue(r.arbiter_school_url)} WHERE id=${sqlValue(r.id)};`)].join('\n'));try{execSql(file)}finally{try{unlinkSync(file)}catch{}}}
 for(const t of tables){
  const q=`SELECT ${t.columns.map(c=>`"${c}"`).join(',')} FROM public."${t.name}"`
  const result=await client.query(q);console.log(`[D1 Arbiter seed] ${t.name}: ${result.rows.length}`)
  for(let i=0;i<result.rows.length;i+=CHUNK_SIZE){const file=`/tmp/sectionx-${t.name}-${i}.sql`;writeFileSync(file,['PRAGMA foreign_keys = ON;',...result.rows.slice(i,i+CHUNK_SIZE).map(r=>upsert(t,r))].join('\n'));try{execSql(file)}finally{try{unlinkSync(file)}catch{}}}
 }
 await client.query('ROLLBACK')
 console.log('[D1 Arbiter seed] PASS: source remained read-only; preview D1 received operational parity data.')
}catch(error){try{await client.query('ROLLBACK')}catch{};console.error('[D1 Arbiter seed] FAILED:',error instanceof Error?error.message:error);process.exitCode=1}finally{await client.end().catch(()=>{})}
