import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const { Client } = pg
const connectionString = process.env.SUPABASE_MIGRATION_DATABASE_URL
if (!connectionString) throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL')

const DB_NAME = 'sectionxscoreboard-preview'
const BUCKET = 'sectionxscoreboard-photos-preview'
const CONFIG = 'wrangler.jsonc'
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000, query_timeout: 45000, statement_timeout: 45000 })
const esc = value => String(value).replaceAll("'", "''")

try {
  await client.connect()
  const identity = await client.query(`select current_user as u,current_setting('default_transaction_read_only') as ro`)
  if (!String(identity.rows[0].u).startsWith('cloudflare_migration_reader') || identity.rows[0].ro !== 'on') throw new Error('Refusing to run without read-only migration role')
  await client.query('BEGIN READ ONLY')

  const { rows } = await client.query(`select id,logo_url from public.schools where logo_url is not null order by school_name asc`)
  console.log(`[legacy logos] ${rows.length} school logo records found`)
  mkdirSync('/tmp/sectionx-logo-migration', { recursive: true })
  let copied = 0, skipped = 0, failed = 0

  for (const row of rows) {
    try {
      const url = String(row.logo_url || '')
      if (!/^https?:\/\//i.test(url)) { skipped++; continue }
      const current = execFileSync('npx', ['wrangler','d1','execute',DB_NAME,'--remote','--config',CONFIG,'--command',`SELECT logo_url FROM schools WHERE id='${esc(row.id)}' LIMIT 1;`], { encoding:'utf8', env:process.env })
      if (current.includes('/media/photos/logos/')) { skipped++; continue }

      const response = await fetch(url)
      if (!response.ok) throw new Error(`download ${response.status}`)
      const type = response.headers.get('content-type') || 'image/png'
      const ext = type.includes('svg') ? 'svg' : type.includes('webp') ? 'webp' : type.includes('jpeg') || type.includes('jpg') ? 'jpg' : 'png'
      const key = `logos/${row.id}.${ext}`
      const file = `/tmp/sectionx-logo-migration/${row.id}.${ext}`
      writeFileSync(file, Buffer.from(await response.arrayBuffer()))
      try {
        execFileSync('npx', ['wrangler','r2','object','put',`${BUCKET}/${key}`,'--file',file,'--remote','--config',CONFIG], { stdio:'inherit', env:process.env })
      } finally {
        try { unlinkSync(file) } catch {}
      }
      execFileSync('npx', ['wrangler','d1','execute',DB_NAME,'--remote','--config',CONFIG,'--command',`UPDATE schools SET logo_url='/media/photos/${esc(key)}' WHERE id='${esc(row.id)}';`], { stdio:'inherit', env:process.env })
      copied++
    } catch (error) {
      failed++
      console.error(`[legacy logos] ${row.id}:`, error instanceof Error ? error.message : error)
    }
  }

  await client.query('ROLLBACK')
  console.log(`[legacy logos] copied=${copied} skipped=${skipped} failed=${failed}`)
  if (failed) process.exitCode = 1
} catch (error) {
  try { await client.query('ROLLBACK') } catch {}
  console.error('[legacy logos] FAILED:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
