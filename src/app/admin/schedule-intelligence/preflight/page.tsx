import AdminLayout from '@/components/layout/AdminLayout'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import SeasonPreflight from './SeasonPreflight'

export const revalidate=0

export default async function SeasonPreflightPage(){
  const data=await getSportsRepository().getSeasons()
  const seasons=(data||[])
    .filter((s:any)=>['Fall','Winter','Spring'].includes(s.season_type)&&Number(s.year)>=2026)
    .filter((s:any)=>s.name==='Fall 2026'||s.name==='Winter 2026-27'||s.name==='Spring 2027')
    .sort((a:any,b:any)=>Number(a.year)-Number(b.year))
  return <AdminLayout><SeasonPreflight seasons={seasons}/></AdminLayout>
}
