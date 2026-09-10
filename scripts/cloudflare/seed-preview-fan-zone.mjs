import { writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const { Client } = pg
const connectionString = process.env.SUPABASE_MIGRATION_DATABASE_URL
if (!connectionString) throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL')
const DB_NAME='sectionxscoreboard-preview', WRANGLER_CONFIG='wrangler.jsonc', CHUNK_SIZE=125
const tables=[
 {name:'fan_power_rank_ballots',columns:['id','week_start','sport_id','group_type','group_value','rankings','voter_hash','created_at','updated_at']},
 {name:'fan_power_rank_snapshots',columns:['id','week_start','sport_id','group_type','group_value','results','ballot_count','published','created_at','updated_at']},
 {name:'fan_top_play_nominations',columns:['id','week_start','athlete_name','school_id','sport_id','game_date','opponent','play_description','why_top_five','submitter_name','submitter_email','voter_hash','status','admin_notes','created_at','updated_at']},
 {name:'fan_school_support',columns:['id','week_start','school_id','voter_hash','created_at','updated_at']},
 {name:'fan_school_support_snapshots',columns:['id','week_start','school_id','votes','published','updated_at']},
 {name:'fan_game_votes',columns:['id','week_start','game_id','voter_hash','created_at','updated_at']},
 {name:'fan_game_vote_snapshots',columns:['id','week_start','game_id','votes','published','updated_at']},
 {name:'athlete_nominations',columns:['id','athlete_name','school_name','sport_name','grade','achievement','nominator_name','nominator_email','reviewed','created_at']},
]
function sqlValue(v){if(v==null)return'NULL';if(typeof v==='boolean')return v?'1':'0';if(typeof v==='number')return Number.isFinite(v)?String(v):'NULL';if(v instanceof Date)return `'${v.toISOString().replaceAll("'","''")}'`;if(typeof v==='object')v=JSON.stringify(v);return `'${String(v).replaceAll("'","''")}'`}
function upsert(t,row){const vals=t.columns.map(c=>sqlValue(row[c])),updates=t.columns.filter(c=>c!=='id').map(c=>`\"${c}\"=excluded.\"${c}\"`).join(',');return `INSERT INTO \"${t.name}\" (${t.columns.map(c=>`\"${c}\"`).join(',')}) VALUES (${vals.join(',')}) ON CONFLICT(\"id\") DO UPDATE SET ${updates};`}
function execute(path){execFileSync('npx',['wrangler','d1','execute',DB_NAME,'--remote','--config',WRANGLER_CONFIG,'--file',path,'--yes'],{stdio:'inherit',env:process.env})}
const client=new Client({connectionString,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000,query_timeout:45000,statement_timeout:45000})
try{
 console.log('[D1 fan zone] Connecting with read-only migration role...');await client.connect();const identity=await client.query(`select current_user as current_user,current_setting('default_transaction_read_only') as default_transaction_read_only`),info=identity.rows[0];if(!String(info.current_user).startsWith('cloudflare_migration_reader'))throw new Error(`Unexpected database user: ${info.current_user}`);if(info.default_transaction_read_only!=='on')throw new Error('Migration reader is not read-only; refusing to continue.');await client.query('BEGIN READ ONLY')
 for(const table of tables){const result=await client.query(`SELECT ${table.columns.map(c=>`\"${c}\"`).join(',')} FROM public.\"${table.name}\" ORDER BY \"id\" ASC`);console.log(`[D1 fan zone] ${table.name}: ${result.rows.length} rows`);for(let i=0;i<result.rows.length;i+=CHUNK_SIZE){const file=`/tmp/sectionx-fan-${table.name}-${i}.sql`;writeFileSync(file,['PRAGMA foreign_keys = ON;',...result.rows.slice(i,i+CHUNK_SIZE).map(row=>upsert(table,row))].join('\n'),'utf8');try{execute(file)}finally{try{unlinkSync(file)}catch{}}}}
 await client.query('ROLLBACK');console.log('[D1 fan zone] PASS: copied Fan Zone and nomination data into preview D1.')
}catch(error){try{await client.query('ROLLBACK')}catch{};console.error('[D1 fan zone] FAILED:',error instanceof Error?error.message:error);process.exitCode=1}finally{await client.end().catch(()=>{})}
