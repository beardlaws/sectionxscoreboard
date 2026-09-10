import { writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const { Client }=pg
const connectionString=process.env.SUPABASE_MIGRATION_DATABASE_URL
if(!connectionString) throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL')
const DB_NAME='sectionxscoreboard-preview',WRANGLER_CONFIG='wrangler.jsonc',CHUNK_SIZE=125
function q(v){if(v==null)return'NULL';if(typeof v==='boolean')return v?'1':'0';if(typeof v==='number')return Number.isFinite(v)?String(v):'NULL';if(v instanceof Date)return `'${v.toISOString().replaceAll("'","''")}'`;return `'${String(v).replaceAll("'","''")}'`}
function execute(path){execFileSync('npx',['wrangler','d1','execute',DB_NAME,'--remote','--config',WRANGLER_CONFIG,'--file',path,'--yes'],{stdio:'inherit',env:process.env})}
const client=new Client({connectionString,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000,query_timeout:45000,statement_timeout:45000})
try{
 await client.connect();const identity=await client.query(`select current_user as current_user,current_setting('default_transaction_read_only') as default_transaction_read_only`),info=identity.rows[0];if(!String(info.current_user).startsWith('cloudflare_migration_reader'))throw new Error(`Unexpected database user: ${info.current_user}`);if(info.default_transaction_read_only!=='on')throw new Error('Migration reader is not read-only');await client.query('BEGIN READ ONLY')
 const result=await client.query(`SELECT id,meet_id,sport_id,athlete_id,team_id,external_opponent_id,runner_name,finish_place,EXTRACT(EPOCH FROM finish_time)::double precision AS finish_time_seconds,scorer,displacer,created_at FROM public.cross_country_individual_results ORDER BY id`)
 console.log(`[D1 XC individuals] ${result.rows.length} rows`)
 for(let i=0;i<result.rows.length;i+=CHUNK_SIZE){const file=`/tmp/sectionx-xci-${i}.sql`,sql=['PRAGMA foreign_keys = ON;',...result.rows.slice(i,i+CHUNK_SIZE).map(r=>`INSERT INTO cross_country_individual_results (id,meet_id,sport_id,athlete_id,team_id,external_opponent_id,runner_name,finish_place,finish_time_seconds,scorer,displacer,created_at) VALUES (${q(r.id)},${q(r.meet_id)},${q(r.sport_id)},${q(r.athlete_id)},${q(r.team_id)},${q(r.external_opponent_id)},${q(r.runner_name)},${q(r.finish_place)},${q(r.finish_time_seconds)},${q(r.scorer)},${q(r.displacer)},${q(r.created_at)}) ON CONFLICT(id) DO UPDATE SET meet_id=excluded.meet_id,sport_id=excluded.sport_id,athlete_id=excluded.athlete_id,team_id=excluded.team_id,external_opponent_id=excluded.external_opponent_id,runner_name=excluded.runner_name,finish_place=excluded.finish_place,finish_time_seconds=excluded.finish_time_seconds,scorer=excluded.scorer,displacer=excluded.displacer;`)];writeFileSync(file,sql.join('\n'));try{execute(file)}finally{try{unlinkSync(file)}catch{}}}
 await client.query('ROLLBACK');console.log('[D1 XC individuals] PASS')
}catch(error){try{await client.query('ROLLBACK')}catch{};console.error('[D1 XC individuals] FAILED:',error instanceof Error?error.message:error);process.exitCode=1}finally{await client.end().catch(()=>{})}
