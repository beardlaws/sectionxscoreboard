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

async function countRows(supabase: any, table: string, gameId: string) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)
  if (error) throw error
  return count || 0
}

async function getPreview(supabase: any, gameId: string) {
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id, game_date, status, home_score, away_score')
    .eq('id', gameId)
    .maybeSingle()

  if (gameError) throw gameError
  if (!game) return null

  const { data: photos, error: photoError } = await supabase
    .from('photos')
    .select('id, photo_url')
    .eq('game_id', gameId)
  if (photoError) throw photoError

  const photoIds = (photos || []).map((p: any) => p.id)
  let photoAthletes = 0
  if (photoIds.length) {
    const { count, error } = await supabase
      .from('photo_athletes')
      .select('*', { count: 'exact', head: true })
      .in('photo_id', photoIds)
    if (error) throw error
    photoAthletes = count || 0
  }

  const [periodScores, teamStats, athleteStats, importSources, corrections, shoutouts] = await Promise.all([
    countRows(supabase, 'game_period_scores', gameId),
    countRows(supabase, 'game_team_stats', gameId),
    countRows(supabase, 'game_athlete_stats', gameId),
    countRows(supabase, 'game_import_sources', gameId),
    countRows(supabase, 'correction_requests', gameId),
    countRows(supabase, 'shoutouts', gameId),
  ])

  return {
    game,
    counts: {
      periodScores,
      teamStats,
      athleteStats,
      importSources,
      photos: (photos || []).length,
      photoAthletes,
      corrections,
      shoutouts,
    },
    photos: photos || [],
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { gameId, action = 'delete' } = await req.json()
  if (!gameId) return NextResponse.json({ error: 'gameId required' }, { status: 400 })

  const supabase = getAdminClient()

  try {
    const preview = await getPreview(supabase, gameId)
    if (!preview) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

    if (action === 'preview') {
      return NextResponse.json({ ok: true, preview })
    }

    const photoIds = preview.photos.map((p: any) => p.id)
    const storagePaths = preview.photos
      .map((photo: any) => storagePathFromPublicUrl(photo.photo_url))
      .filter((path: string | null): path is string => Boolean(path))

    if (storagePaths.length) {
      const { error } = await supabase.storage.from('photos').remove(storagePaths)
      if (error) throw new Error(`Photo storage cleanup failed: ${error.message}`)
    }

    if (photoIds.length) {
      const { error: tagError } = await supabase.from('photo_athletes').delete().in('photo_id', photoIds)
      if (tagError) throw tagError

      const { error: photoDeleteError } = await supabase.from('photos').delete().eq('game_id', gameId)
      if (photoDeleteError) throw photoDeleteError
    }

    const { error: correctionDeleteError } = await supabase.from('correction_requests').delete().eq('game_id', gameId)
    if (correctionDeleteError) throw correctionDeleteError

    const { error: shoutoutUpdateError } = await supabase.from('shoutouts').update({ game_id: null }).eq('game_id', gameId)
    if (shoutoutUpdateError) throw shoutoutUpdateError

    // These are CASCADE today, but deleting explicitly makes cleanup deterministic
    // and keeps the API safe if a foreign-key rule changes later.
    for (const table of ['game_period_scores', 'game_team_stats', 'game_athlete_stats', 'game_import_sources']) {
      const { error } = await supabase.from(table).delete().eq('game_id', gameId)
      if (error) throw error
    }

    const { error: gameDeleteError } = await supabase.from('games').delete().eq('id', gameId)
    if (gameDeleteError) throw gameDeleteError

    const verificationChecks = await Promise.all([
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('id', gameId),
      supabase.from('game_period_scores').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
      supabase.from('game_team_stats').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
      supabase.from('game_athlete_stats').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
      supabase.from('game_import_sources').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
      supabase.from('photos').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
      supabase.from('correction_requests').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
      supabase.from('shoutouts').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
    ])

    const remaining = verificationChecks.reduce((sum, result) => sum + (result.count || 0), 0)

    return NextResponse.json({
      ok: remaining === 0,
      deleted: preview.counts,
      removedStorageFiles: storagePaths.length,
      verifiedClean: remaining === 0,
      remainingReferences: remaining,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Cleanup failed' }, { status: 500 })
  }
}
