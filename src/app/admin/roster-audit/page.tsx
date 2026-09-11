// src/app/admin/roster-audit/page.tsx

import { getCloudflareContext } from '@opennextjs/cloudflare'
import AdminLayout from '@/components/layout/AdminLayout'
import RosterAudit from './RosterAudit'

export const revalidate = 0

async function all(db:any,sql:string,...values:any[]){const r=await db.prepare(sql).bind(...values).all();return r.results||[]}

export default async function RosterAuditPage() {
  const {env}=getCloudflareContext(),db=(env as any).DB
  if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')

  const [schools,rawTeams,sports,seasons,teamSeasons,rosterEntries,coachEntries]=await Promise.all([
    all(db,`SELECT id,school_name,slug,alias,active,arbiter_entity_id,arbiter_school_url FROM schools WHERE active=1 ORDER BY school_name`),
    all(db,`SELECT id,school_id,sport_id,team_name,slug,level,active FROM teams WHERE active=1 ORDER BY team_name`),
    all(db,`SELECT id,sport_name,gender,season_type,slug FROM sports ORDER BY sport_name`),
    all(db,`SELECT id,name,season_type,year,is_active FROM seasons ORDER BY year DESC`),
    all(db,`SELECT id,team_id,season_id,active_for_season,division,class FROM team_seasons`),
    all(db,`SELECT id,team_id,season_id,athlete_id,active,imported_at,source FROM roster_entries WHERE active=1`),
    all(db,`SELECT id,team_id,season_id,coach_id,active,imported_at,source FROM team_coaches WHERE active=1`)
  ])

  return (
    <AdminLayout>
      <RosterAudit
        schools={schools}
        teams={rawTeams}
        sports={sports}
        seasons={seasons}
        teamSeasons={teamSeasons}
        rosterEntries={rosterEntries}
        coachEntries={coachEntries}
      />
    </AdminLayout>
  )
}
