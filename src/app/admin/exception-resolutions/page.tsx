import AdminLayout from '@/components/layout/AdminLayout'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import ResolutionClient from './ResolutionClient'

export const revalidate = 0

export default async function ExceptionResolutionsPage() {
  const repository = getSportsRepository()
  const seasons = await repository.getSeasons()
  const active = (seasons || []).find((season: any) => season.is_active) || (seasons || [])[0] || null

  return (
    <AdminLayout>
      <div className="p-4 max-w-6xl">
        <ResolutionClient season={active} />
      </div>
    </AdminLayout>
  )
}
