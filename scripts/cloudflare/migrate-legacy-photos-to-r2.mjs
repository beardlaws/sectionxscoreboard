import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const { Client } = pg
const connectionString = process.env.SUPABASE_MIGRATION_DATABASE_URL
if (!connectionString) throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL')
const DB_NAME='sectionxscoreboard-preview',BUCKET='sectionxscoreboard-photos-preview',CONFIG='wrangler.jsonc'
const client=new Client({connectionString,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000,query_timeout:45000,statement_timeout:45000})
const esc=s=>String(s).replaceAll("'","''")

try{
  await client.connect()
  const identity=await client.query(`select current_user as u,current_setting('default_transaction_read_only') as ro`)
  if(!String(identity.rows[0].u).startsWith('cloudflare_migration_reader')||identity.rows[0].ro!=='on')throw new Error('Refusing to run without read-only migration role')
  await client.query('BEGIN READ ONLY')
  const {rows}=await client.query(`select id,photo_url from public.photos where approved=true and photo_url is not null order by created_at asc`)
  console.log(`[legacy photos] ${rows.length} approved photo records found`)
  mkdirSync('/tmp/sectionx-photo-migration',{recursive:true})
  let copied=0,skipped=0,failed=0
  for(const row of rows){
    try{
      if(!/^https?:\/\//i.test(row.photo_url)){skipped++;continue}
      // Deliberately overwrite every referenced legacy object during the final
      // sync. The metadata seed copies the authoritative Supabase photo_url back
      // into D1 before this step, so relying on an old storage_provider='r2'
      // flag could leave D1 pointing at Supabase or hide a missing R2 object.
      const response=await fetch(row.photo_url)
      if(!response.ok)throw new Error(`download ${response.status}`)
      const type=response.headers.get('content-type')||'image/jpeg'
      const ext=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('heic')?'heic':'jpg'
      const key=`legacy/${row.id}.${ext}`,file=`/tmp/sectionx-photo-migration/${row.id}.${ext}`
      const buffer=Buffer.from(await response.arrayBuffer())
      writeFileSync(file,buffer)
      try{execFileSync('npx',['wrangler','r2','object','put',`${BUCKET}/${key}`,'--file',file,'--remote','--config',CONFIG],{stdio:'inherit',env:process.env})}finally{try{unlinkSync(file)}catch{}}
      execFileSync('npx',['wrangler','d1','execute',DB_NAME,'--remote','--config',CONFIG,'--command',`UPDATE photos SET photo_url='/media/photos/${esc(key)}',storage_provider='r2',storage_key='${esc(key)}',mime_type='${esc(type)}',file_size_bytes=${buffer.byteLength} WHERE id='${esc(row.id)}';`],{stdio:'inherit',env:process.env})
      copied++
    }catch(error){failed++;console.error(`[legacy photos] ${row.id}:`,error instanceof Error?error.message:error)}
  }
  await client.query('ROLLBACK')
  console.log(`[legacy photos] copied=${copied} skipped=${skipped} failed=${failed}`)
  if(failed)process.exitCode=1
}catch(error){try{await client.query('ROLLBACK')}catch{};console.error('[legacy photos] FAILED:',error instanceof Error?error.message:error);process.exitCode=1}finally{await client.end().catch(()=>{})}
