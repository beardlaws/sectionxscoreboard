import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.SUPABASE_MIGRATION_DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL');
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 20000,
  statement_timeout: 20000,
});

try {
  console.log('[Supabase migration test] Connecting with temporary read-only role...');
  await client.connect();

  const identity = await client.query(`
    SELECT
      current_user AS current_user,
      current_database() AS current_database,
      current_setting('default_transaction_read_only') AS default_transaction_read_only;
  `);

  const info = identity.rows[0];
  console.log(`[Supabase migration test] user=${info.current_user}`);
  console.log(`[Supabase migration test] database=${info.current_database}`);
  console.log(`[Supabase migration test] default_transaction_read_only=${info.default_transaction_read_only}`);

  if (!String(info.current_user).startsWith('cloudflare_migration_reader')) {
    throw new Error(`Unexpected database user: ${info.current_user}`);
  }

  if (info.default_transaction_read_only !== 'on') {
    throw new Error('Migration reader is not default_transaction_read_only=on; refusing to continue.');
  }

  await client.query('BEGIN READ ONLY');

  const counts = await client.query(`
    SELECT 'schools' AS table_name, COUNT(*)::bigint AS row_count FROM public.schools
    UNION ALL SELECT 'sports', COUNT(*)::bigint FROM public.sports
    UNION ALL SELECT 'seasons', COUNT(*)::bigint FROM public.seasons
    UNION ALL SELECT 'teams', COUNT(*)::bigint FROM public.teams
    UNION ALL SELECT 'team_seasons', COUNT(*)::bigint FROM public.team_seasons
    UNION ALL SELECT 'games', COUNT(*)::bigint FROM public.games
    UNION ALL SELECT 'external_opponents', COUNT(*)::bigint FROM public.external_opponents
    ORDER BY table_name;
  `);

  for (const row of counts.rows) {
    console.log(`[Supabase migration test] ${row.table_name}: ${row.row_count}`);
  }

  await client.query('ROLLBACK');
  console.log('[Supabase migration test] PASS: shared-pooler connection works and core tables are readable.');
} catch (error) {
  try {
    await client.query('ROLLBACK');
  } catch {}
  console.error('[Supabase migration test] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
