import PublicLayout from '@/components/layout/PublicLayout'
import ContributorClient from './ContributorClient'

export const revalidate = 0

export default function ContributorPage() {
  return (
    <PublicLayout>
      <ContributorClient />
    </PublicLayout>
  )
}
