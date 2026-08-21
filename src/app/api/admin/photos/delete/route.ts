import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function isAuthorized(req: NextRequest) {
  return req.cookies.get('admin_auth')?.value === 'SectionXScoreboardTheRightWay!'
}

function storagePathFromPublicUrl(url: string | null) {
  if (!url) return null
  const marker = '/storage/v1/object/public/photos/'
  const index = url.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marker.length))
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { photoId } = await req.json()
  if (!photoId) return NextResponse.json({ error: 'photoId required' }, { status: 400 })

  const supabase = getAdminClient()
  const { data: photo, error: lookupError } = await supabase
    .from('photos')
    .select('id, photo_url')
    .eq('id', photoId)
    .single()

  if (lookupError || !photo) {
    return NextResponse.json({ error: lookupError?.message || 'Photo not found' }, { status: 404 })
  }

  const path = storagePathFromPublicUrl(photo.photo_url)
  if (path) {
    const { error: storageError } = await supabase.storage.from('photos').remove([path])
    if (storageError) {
      return NextResponse.json({ error: `Storage delete failed: ${storageError.message}` }, { status: 500 })
    }
  }

  const { error: deleteError } = await supabase.from('photos').delete().eq('id', photoId)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
