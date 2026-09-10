import { writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const { Client } = pg
const connectionString = process.env.SUPABASE_MIGRATION_DATABASE_URL
if (!connectionString) throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL')

const DB_NAME='sectionxscoreboard-preview', WRANGLER_CONFIG='wrangler.jsonc', CHUNK_SIZE=150
const columns=['recap','recap_author','is_playoff','playoff_round','playoff_game_id','result_exempt','result_exempt_reason','league_designation','league_designation_override','league_designation_note','league_designation_updated_at','schedule_override','schedule_override_note','schedule_override_updated_at']
const booleans=new Set(['is_playoff','result_exempt','league_designation_override','schedule_override'])

function sqlValue(value,isBoolean=false){
  if(value===null||value===undefined)return'NULL'
  if(isBoolean)return value?'1':'0'
  if(value instanceof Date)return `'${value.toISOString().replaceAll("'","''")}'`
  return `'${String(value).replaceAll("'","''")}'`
}
function execute(path){
  execFileSync('npx',['wrangler','d1','execute',DB_NAME,'--remote','--config',WRANGLER_CONFIG,'--file',path,'--yes'],{stdio:'inherit',env:process.env})
}

const client=new Client({connectionString,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000,query_timeout:30000,statement_timeout:30000})
try{
  console.log('[D1 game ops seed] Connecting with read-only migration role...')
  await client.connect()
  const identity=await client.query("SELECT current_user AS current_user,current_setting('default_transaction_read_only') AS default_transaction_read_only")
  const info=identity.rows[0]
  if(!String(info.current_user).startsWith('cloudflare_migration_reader'))throw new Error(`Unexpected database user: ${info.current_user}`)
  if(info.default_transaction_read_only!=='on')throw new Error('Migration reader is not read-only; refusing to seed.')
  await client.query('BEGIN READ ONLY')
  const result=await client.query(`SELECT id,${columns.map(c=>`"${c}"`).join(',')} FROM public.games ORDER BY id`)
  console.log(`[D1 game ops seed] fetched ${result.rows.length} games`)
  for(let i=0;i<result.rows.length;i+=CHUNK_SIZE){
    const chunk=result.rows.slice(i,i+CHUNK_SIZE)
    const sql=['PRAGMA foreign_keys = ON;',...chunk.map(row=>{
      const sets=columns.map(c=>`"${c}"=${sqlValue(row[c],booleans.has(c))}`).join(',')
      return `UPDATE games SET ${sets} WHERE id=${sqlValue(row.id)};`
    })].join('\n')
    const file=`/tmp/sectionx-game-ops-${i}.sql`
    writeFileSync(file,sql,'utf8')
    try{execute(file)}finally{try{unlinkSync(file)}catch{}}
    console.log(`[D1 game ops seed] copied ${Math.min(i+CHUNK_SIZE,result.rows.length)}/${result.rows.length}`)
  }
  await client.query('ROLLBACK')
  console.log('[D1 game ops seed] PASS: source stayed read-only; preview D1 updated.')
}catch(error){
  try{await client.query('ROLLBACK')}catch{}
  console.error('[D1 game ops seed] FAILED:',error instanceof Error?error.message:error)
  process.exitCode=1
}finally{await client.end().catch(()=>{})}
