import { execFileSync } from 'node:child_process'

const DB_NAME = 'sectionxscoreboard-preview'
const CONFIG = 'wrangler.jsonc'
const marker = `migration-probe-${Date.now()}`

function run(command) {
  return execFileSync('npx', [
    'wrangler', 'd1', 'execute', DB_NAME,
    '--remote', '--config', CONFIG,
    '--command', command,
    '--yes',
  ], { encoding: 'utf8', env: process.env })
}

try {
  run('CREATE TABLE IF NOT EXISTS __migration_write_probe (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);')
  run(`INSERT INTO __migration_write_probe (id, created_at) VALUES ('${marker}', datetime('now'));`)
  const read = run(`SELECT id FROM __migration_write_probe WHERE id='${marker}';`)
  if (!read.includes(marker)) throw new Error('Probe row could not be read back from D1')
  run(`DELETE FROM __migration_write_probe WHERE id='${marker}';`)
  run('DROP TABLE __migration_write_probe;')
  console.log('[D1 write probe] PASS: create/insert/read/delete/drop all succeeded on remote D1.')
} catch (error) {
  try { run('DROP TABLE IF EXISTS __migration_write_probe;') } catch {}
  console.error('[D1 write probe] FAILED:', error instanceof Error ? error.message : error)
  process.exit(1)
}
