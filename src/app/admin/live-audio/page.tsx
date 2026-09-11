import AdminLayout from '@/components/layout/AdminLayout'
import LiveAudioAdmin from './LiveAudioAdmin'

export const dynamic = 'force-dynamic'

export default function LiveAudioAdminPage(){
  return <AdminLayout><LiveAudioAdmin /></AdminLayout>
}
