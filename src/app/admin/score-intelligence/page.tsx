import AdminLayout from '@/components/layout/AdminLayout'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import ScoreIntelligence from './ScoreIntelligence'

export const revalidate = 0

export default async function ScoreIntelligencePage() {
  const repository = getSportsRepository()
  const sports = await repository.getSports()

  return (
    <AdminLayout>
      <ScoreIntelligence sports={sports || []} />
    </AdminLayout>
  )
}
