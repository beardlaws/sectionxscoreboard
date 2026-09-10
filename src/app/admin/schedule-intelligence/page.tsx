import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import ScheduleIntelligence from './ScheduleIntelligence'

export const dynamic='force-dynamic'
export default async function ScheduleIntelligencePage(){
 const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
 const result=await db.prepare("SELECT id,name,year,season_type,is_active FROM seasons WHERE season_type IN ('Fall','Winter','Spring') ORDER BY year DESC").all(),rows=result.results||[]
 const active=rows.find((s:any)=>Boolean(s.is_active))||rows[0]||null;let seasons:any[]=rows as any[]
 if(active){const y=Number((active as any).year),type=String((active as any).season_type),schoolYearStart=type==='Spring'?y-1:y;seasons=rows.filter((s:any)=>(s.season_type==='Fall'&&Number(s.year)===schoolYearStart)||(s.season_type==='Winter'&&Number(s.year)===schoolYearStart)||(s.season_type==='Spring'&&Number(s.year)===schoolYearStart+1))}
 const rank:Record<string,number>={Fall:0,Winter:1,Spring:2};seasons=[...seasons].sort((a:any,b:any)=>(rank[a.season_type]??9)-(rank[b.season_type]??9))
 return <AdminLayout><div className="px-4 pt-4 max-w-6xl"><Link href="/admin/schedule-intelligence/preflight" className="admin-action-btn inline-flex">Season Adoption Preflight →</Link></div><ScheduleIntelligence seasons={seasons}/></AdminLayout>
}
