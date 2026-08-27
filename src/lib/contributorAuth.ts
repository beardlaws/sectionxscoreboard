import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function getContributorUser(req: NextRequest) {
  const auth = createClient()
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  const { data: { user }, error } = token
    ? await auth.auth.getUser(token)
    : await auth.auth.getUser()
  if (error) return null
  return user || null
}
