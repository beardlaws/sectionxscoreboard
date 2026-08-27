import AdminLayout from '@/components/layout/AdminLayout'
import DailyResults from './DailyResults'

export const revalidate=0
export default function TodayResultsPage(){return <AdminLayout><DailyResults/></AdminLayout>}
