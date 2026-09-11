import { getCloudflareContext } from '@opennextjs/cloudflare'
import AdminLayout from '@/components/layout/AdminLayout'
import ScheduleSync from './ScheduleSync'
import PersistentArbiterMappings from './PersistentArbiterMappings'
import SchoolMappingManager from './SchoolMappingManager'

export const dynamic='force-dynamic'

export default async function ScheduleSyncPage() {
  const {env}=getCloudflareContext(),db=(env as any).DB
  if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
  const [teamsR,sportsR,seasonsR,teamSeasonsR,teamMappingsR,schoolMappingsR,schoolsR]=await Promise.all([
    db.prepare(`SELECT t.id,t.team_name,t.sport_id,t.level,t.active,s.id school_id,s.school_name,s.slug school_slug,s.alias school_alias FROM teams t LEFT JOIN schools s ON s.id=t.school_id ORDER BY t.team_name`).all(),
    db.prepare(`SELECT id,sport_name,gender,season_type,active_public,slug,homepage_priority FROM sports ORDER BY sport_name`).all(),
    db.prepare(`SELECT * FROM seasons ORDER BY year DESC`).all(),
    db.prepare(`SELECT team_id,season_id,active_for_season FROM team_seasons`).all(),
    db.prepare(`SELECT team_id,school_id,schedule_url FROM arbiter_team_mappings`).all(),
    db.prepare(`SELECT school_id,school_url FROM arbiter_school_mappings`).all(),
    db.prepare(`SELECT id,school_name,arbiter_school_url,arbiter_entity_id,active,is_section_x FROM schools WHERE active=1 AND is_section_x=1 ORDER BY school_name`).all(),
  ])
  const teams=(teamsR.results||[]).map((t:any)=>({id:t.id,team_name:t.team_name,sport_id:t.sport_id,level:t.level,active:Boolean(t.active),school:t.school_id?{id:t.school_id,school_name:t.school_name,slug:t.school_slug,alias:t.school_alias}:null}))
  const teamSchoolMap=Object.fromEntries(teams.map((team:any)=>[team.id,team.school?.id||null]))
  return <AdminLayout>
    <PersistentArbiterMappings teamMappings={teamMappingsR.results||[]} schoolMappings={schoolMappingsR.results||[]} teamSchoolMap={teamSchoolMap}/>
    <SchoolMappingManager schools={schoolsR.results||[]} teams={teams} sports={sportsR.results||[]} teamMappings={teamMappingsR.results||[]}/>
    <ScheduleSync teams={teams} sports={sportsR.results||[]} seasons={seasonsR.results||[]} teamSeasons={teamSeasonsR.results||[]}/>
  </AdminLayout>
}
