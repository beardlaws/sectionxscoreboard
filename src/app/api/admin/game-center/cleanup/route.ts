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

  const { gameId } = await req.json()
  if (!gameId) return NextResponse.json({ error: 'gameId required' }, { status: 400 })

  const supabase = getAdminClient()

  const { data: photos, error: photoLookupError } = await supabase
    .from('photos')
    .select('id, photo_url')
    .eq('game_id', gameId)

  if (photoLookupError) {
    return NextResponse.json({ error: photoLookupError.message }, { status: 500 })
  }

  const storagePaths = (photos || [])
    .map(photo => storagePathFromPublicUrl(photo.photo_url))
    .filter((path): path is string => Boolean(path))

  if (storagePaths.length) {
    const { error: storageError } = await supabase.storage.from('photos').remove(storagePaths)
    if (storageError) {
      return NextResponse.json({ error: `Photo storage cleanup failed: ${storageError.message}` }, { status: 500 })
    }
  }

  if ((photos || []).length) {
    const { error: photoDeleteError } = await supabase.from('photos').delete().eq('game_id', gameId)
    if (photoDeleteError) {
      return NextResponse.json({ error: photoDeleteError.message }, { status: 500 })
    }
  }

  const { error: correctionDeleteError } = await supabase.from('correction_requests').delete().eq('game_id', gameId)
  if (correctionDeleteError) {
    return NextResponse.json({ error: correctionDeleteError.message }, { status: 500 })
  }

  const { error: shoutoutUpdateError } = await supabase.from('shoutouts').update({ game_id: null }).eq('game_id', gameId)
  if (shoutoutUpdateError) {
    return NextResponse.json({ error: shoutoutUpdateError.message }, { status: 500 })
  }

  const { error: gameDeleteError } = await supabase.from('games').delete().eq('id', gameId)
  if (gameDeleteError) {
    return NextResponse.json({ error: gameDeleteError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    removedPhotos: (photos || []).length,
    cascaded: ['game_period_scores', 'game_team_stats', 'game_athlete_stats', 'game_import_sources'],
  })
}
