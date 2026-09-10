import { execFileSync } from 'node:child_process';

const DB_NAME = 'sectionxscoreboard-preview';
const WRANGLER_CONFIG = 'wrangler.jsonc';
const tables = ['schools','sports','seasons','external_opponents','teams','team_seasons','games'];

console.log('[D1 verify] Verifying core preview row counts...');
for (const table of tables) {
  execFileSync('npx', [
    'wrangler', 'd1', 'execute', DB_NAME,
    '--remote', '--config', WRANGLER_CONFIG,
    '--command', `SELECT '${table}' AS table_name, COUNT(*) AS row_count FROM \"${table}\";`
  ], { stdio: 'inherit', env: process.env });
}
console.log('[D1 verify] PASS: core preview tables are queryable.');
