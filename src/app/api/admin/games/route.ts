// src/app/api/admin/games/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function inferredContestType(game: any): 'Game' | 'Scrimmage' {
  if (String(game?.contest_type || '').toLowerCase() === 'scrimmage') return 'Scrimmage'
  if (String(game?.notes || '').toLowerCase().includes('arbiter type: scrimmage')) return 'Scrimmage'
  return 'Game'
}

async function findOrCreateExternalOpponent(
  supabase: any,
  name: string
): Promise<string | null> {
  if (!name?.trim()) return null

  const cleanName = name.trim()

  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  const { data: existing } = await supabase
    .from('external_opponents')
    .select('id')
    .ilike('name', cleanName)
    .limit(1)

  if (existing && existing.length > 0) {
    return existing[0].id
  }

  const { data: created, error } = await supabase
    .from('external_opponents')
    .insert({
      name: cleanName,
      slug,
      is_section_x: false,
    })
    .select('id')
    .single()

  if (error) {
    console.error(
      'External opponent insert error:',
      error.message
    )
    return null
  }

  return created?.id || null
}

async function recordImportSource(
  supabase: any,
  params: {
    gameId: string
    teamId: string | null
    seasonId: string | null
    sportId: string | null
    source: string
    sourceStatus?: string | null
    sourceGameTime?: string | null
    sourceLocation?: string | null
    sourceContestType?: string | null
    sourceNotes?: string | null
  }
): Promise<string | null> {
  const {
    gameId,
    teamId,
    seasonId,
    sportId,
    source,
    sourceStatus,
    sourceGameTime,
    sourceLocation,
    sourceContestType,
    sourceNotes,
  } = params

  // Import tracking only applies when we know exactly
  // which team's schedule supplied the game.
  if (
    !gameId ||
    !teamId ||
    !seasonId ||
    !sportId
  ) {
    return null
  }

  const { error } = await supabase
    .from('game_import_sources')
    .upsert(
      {
        game_id: gameId,
        team_id: teamId,
        season_id: seasonId,
        sport_id: sportId,
        source,
        source_status: sourceStatus ?? null,
        source_game_time: sourceGameTime ?? null,
        source_location: sourceLocation ?? null,
        source_contest_type: sourceContestType ?? null,
        source_notes: sourceNotes ?? null,
        imported_at: new Date().toISOString(),
      },
      {
        onConflict:
          'game_id,team_id,season_id,sport_id',
      }
    )

  if (error) {
    console.error(
      'Import source tracking error:',
      error.message
    )
    return error.message
  }

  return null
}

export async function POST(
  req: NextRequest
) {
  const body = await req.json()
  const supabase = getAdminClient()

  /*
    Backward compatible request formats:

    OLD:
    [
      { game },
      { game }
    ]

    NEW:
    {
      games: [
        { game },
        { game }
      ],
      import_team_id: "...",
      import_source: "arbiter"
    }

    This lets the existing importer continue working
    until the UI is upgraded in the next step.
  */

  const games = Array.isArray(body)
    ? body
    : Array.isArray(body?.games)
      ? body.games
      : [body]

  const importTeamId =
    !Array.isArray(body)
      ? body?.import_team_id || null
      : null

  const importSource =
    !Array.isArray(body)
      ? body?.import_source || 'manual'
      : 'manual'

  const results: {
    action: string
    game_id?: string
    error?: string
    tracking_error?: string
  }[] = []

  for (const game of games) {
    const clean: Record<string, any> = {}

    for (
      const [key, value] of Object.entries(
        game
      )
    ) {
      if (value !== undefined) {
        clean[key] = value
      }
    }

    /*
      Never allow request-level tracking metadata
      to accidentally be inserted into the games table.
    */
    delete clean.import_team_id
    delete clean.import_source

    clean.contest_type = inferredContestType(clean)

    if (clean.contest_type === 'Scrimmage') {
      clean.home_score = null
      clean.away_score = null
      if (clean.status === 'Final') clean.status = 'Scheduled'
    }

    // --------------------------------------------------
    // EXTERNAL OPPONENTS
    // --------------------------------------------------

    if (clean.external_home_name) {
      const externalId =
        await findOrCreateExternalOpponent(
          supabase,
          clean.external_home_name
        )

      if (externalId) {
        clean.external_home_opponent_id =
          externalId

        clean.home_team_id = null
      }
    }

    delete clean.external_home_name

    if (clean.external_away_name) {
      const externalId =
        await findOrCreateExternalOpponent(
          supabase,
          clean.external_away_name
        )

      if (externalId) {
        clean.external_away_opponent_id =
          externalId

        clean.away_team_id = null
      }
    }

    delete clean.external_away_name

    // --------------------------------------------------
    // SPORT VALIDATION
    // --------------------------------------------------

    /*
      If a team somehow belongs to the wrong sport,
      find the same school's team for the selected sport.
    */

    if (
      clean.sport_id &&
      clean.home_team_id
    ) {
      const { data: homeTeam } =
        await supabase
          .from('teams')
          .select(
            'sport_id, school_id'
          )
          .eq(
            'id',
            clean.home_team_id
          )
          .single()

      if (
        homeTeam &&
        homeTeam.sport_id !==
          clean.sport_id
      ) {
        const {
          data: correctedTeam,
        } = await supabase
          .from('teams')
          .select('id')
          .eq(
            'school_id',
            homeTeam.school_id
          )
          .eq(
            'sport_id',
            clean.sport_id
          )
          .single()

        clean.home_team_id =
          correctedTeam?.id || null
      }
    }

    if (
      clean.sport_id &&
      clean.away_team_id
    ) {
      const { data: awayTeam } =
        await supabase
          .from('teams')
          .select(
            'sport_id, school_id'
          )
          .eq(
            'id',
            clean.away_team_id
          )
          .single()

      if (
        awayTeam &&
        awayTeam.sport_id !==
          clean.sport_id
      ) {
        const {
          data: correctedTeam,
        } = await supabase
          .from('teams')
          .select('id')
          .eq(
            'school_id',
            awayTeam.school_id
          )
          .eq(
            'sport_id',
            clean.sport_id
          )
          .single()

        clean.away_team_id =
          correctedTeam?.id || null
      }
    }

    // --------------------------------------------------
    // DIRECT UPDATE
    // --------------------------------------------------

    if (clean.id) {
      const gameId = clean.id

      delete clean.id

      const { error } = await supabase
        .from('games')
        .update(clean)
        .eq('id', gameId)

      if (error) {
        results.push({
          action: 'updated',
          game_id: gameId,
          error: error.message,
        })

        continue
      }

      const trackingError =
        await recordImportSource(
          supabase,
          {
            gameId,
            teamId: importTeamId,
            seasonId:
              clean.season_id || null,
            sportId:
              clean.sport_id || null,
            source: importSource,
            sourceStatus: clean.status ?? null,
            sourceGameTime: clean.game_time ?? null,
            sourceLocation: clean.location ?? null,
            sourceContestType: clean.contest_type ?? null,
            sourceNotes: clean.notes ?? null,
          }
        )

      results.push({
        action: 'updated',
        game_id: gameId,
        tracking_error:
          trackingError || undefined,
      })

      continue
    }

    // --------------------------------------------------
    // DEDUPLICATION
    // --------------------------------------------------

    const gameNumber =
      clean.game_number ?? null

    const hasHomeId =
      !!clean.home_team_id

    const hasAwayId =
      !!clean.away_team_id

    const hasExternalHome =
      !!clean.external_home_opponent_id

    const hasExternalAway =
      !!clean.external_away_opponent_id

    const canDedup =
      clean.game_date &&
      clean.sport_id &&
      (hasHomeId ||
        hasExternalHome) &&
      (hasAwayId ||
        hasExternalAway)

    if (canDedup) {
      let duplicateQuery =
        supabase
          .from('games')
          .select('id,home_team_id,away_team_id,home_score,away_score,status,game_time,location,notes,contest_type,parser_confidence')
          .eq(
            'game_date',
            clean.game_date
          )
          .eq(
            'sport_id',
            clean.sport_id
          )

      if (hasHomeId) {
        duplicateQuery =
          duplicateQuery.eq(
            'home_team_id',
            clean.home_team_id
          )
      } else {
        duplicateQuery =
          duplicateQuery.is(
            'home_team_id',
            null
          )
      }

      if (hasAwayId) {
        duplicateQuery =
          duplicateQuery.eq(
            'away_team_id',
            clean.away_team_id
          )
      } else {
        duplicateQuery =
          duplicateQuery.is(
            'away_team_id',
            null
          )
      }

      /*
        External opponent IDs MUST be part
        of the duplicate key.

        Otherwise two different external
        opponents on the same day could
        falsely collide.
      */

      if (hasExternalHome) {
        duplicateQuery =
          duplicateQuery.eq(
            'external_home_opponent_id',
            clean.external_home_opponent_id
          )
      } else {
        duplicateQuery =
          duplicateQuery.is(
            'external_home_opponent_id',
            null
          )
      }

      if (hasExternalAway) {
        duplicateQuery =
          duplicateQuery.eq(
            'external_away_opponent_id',
            clean.external_away_opponent_id
          )
      } else {
        duplicateQuery =
          duplicateQuery.is(
            'external_away_opponent_id',
            null
          )
      }

      if (gameNumber !== null) {
        duplicateQuery =
          duplicateQuery.eq(
            'game_number',
            gameNumber
          )
      } else {
        duplicateQuery =
          duplicateQuery.is(
            'game_number',
            null
          )
      }

      const { data: existing } =
        await duplicateQuery.limit(1)

      if (
        existing &&
        existing.length > 0
      ) {
        const existingGame = existing[0]
        const gameId = existingGame.id

        /*
          Arbiter can publish the same matchup on both teams' schedules
          with slightly different logistics. For home games, the home
          team's schedule is authoritative for time/location/status.
          Away schedules still confirm the matchup and fill missing data.
          Manual/admin imports remain authoritative.
        */
        const isArbiter = importSource === 'arbiter'
        const isHomeSource = !!importTeamId && clean.home_team_id === importTeamId
        const sourceIsAuthoritative = !isArbiter || isHomeSource

        const mergedContestType =
          clean.contest_type === 'Scrimmage' || existingGame.contest_type === 'Scrimmage'
            ? 'Scrimmage'
            : 'Game'

        const mergedStatus = sourceIsAuthoritative
          ? (clean.status ?? existingGame.status ?? 'Scheduled')
          : (existingGame.status ?? clean.status ?? 'Scheduled')

        const mergedTime = sourceIsAuthoritative
          ? (clean.game_time ?? existingGame.game_time ?? null)
          : (existingGame.game_time ?? clean.game_time ?? null)

        const mergedLocation = sourceIsAuthoritative
          ? (clean.location ?? existingGame.location ?? null)
          : (existingGame.location ?? clean.location ?? null)

        const mergedNotes = sourceIsAuthoritative
          ? (clean.notes ?? existingGame.notes ?? null)
          : (existingGame.notes ?? clean.notes ?? null)

        const { error } = await supabase
          .from('games')
          .update({
            home_score:
              clean.home_score ??
              existingGame.home_score ??
              null,

            away_score:
              clean.away_score ??
              existingGame.away_score ??
              null,

            status:
              mergedStatus,

            game_time:
              mergedTime,

            location:
              mergedLocation,

            notes:
              mergedNotes,

            contest_type:
              mergedContestType,

            parser_confidence:
              clean.parser_confidence ??
              existingGame.parser_confidence ??
              null,
          })
          .eq('id', gameId)

        if (error) {
          results.push({
            action: 'updated',
            game_id: gameId,
            error: error.message,
          })

          continue
        }

        /*
          Even though the game already existed,
          record that THIS team's schedule also
          contained the game, including the values
          that source reported for future conflict audits.
        */
        const trackingError =
          await recordImportSource(
            supabase,
            {
              gameId,
              teamId:
                importTeamId,
              seasonId:
                clean.season_id ||
                null,
              sportId:
                clean.sport_id ||
                null,
              source:
                importSource,
              sourceStatus: clean.status ?? null,
              sourceGameTime: clean.game_time ?? null,
              sourceLocation: clean.location ?? null,
              sourceContestType: clean.contest_type ?? null,
              sourceNotes: clean.notes ?? null,
            }
          )

        results.push({
          action: 'updated',
          game_id: gameId,
          tracking_error:
            trackingError ||
            undefined,
        })

        continue
      }
    }

    // --------------------------------------------------
    // INSERT NEW GAME
    // --------------------------------------------------

    const {
      data: insertedGame,
      error: insertError,
    } = await supabase
      .from('games')
      .insert(clean)
      .select('id')
      .single()

    if (insertError) {
      console.error(
        'Insert error:',
        insertError.message,
        JSON.stringify(clean).slice(
          0,
          300
        )
      )

      results.push({
        action: 'inserted',
        error:
          insertError.message,
      })

      continue
    }

    const gameId =
      insertedGame?.id

    if (!gameId) {
      results.push({
        action: 'inserted',
        error:
          'Game inserted but no game ID was returned',
      })

      continue
    }

    /*
      Record which team's schedule
      supplied the new game.
    */
    const trackingError =
      await recordImportSource(
        supabase,
        {
          gameId,
          teamId:
            importTeamId,
          seasonId:
            clean.season_id ||
            null,
          sportId:
            clean.sport_id ||
            null,
          source:
            importSource,
          sourceStatus: clean.status ?? null,
          sourceGameTime: clean.game_time ?? null,
          sourceLocation: clean.location ?? null,
          sourceContestType: clean.contest_type ?? null,
          sourceNotes: clean.notes ?? null,
        }
      )

    results.push({
      action: 'inserted',
      game_id: gameId,
      tracking_error:
        trackingError || undefined,
    })
  }

  const errors =
    results.filter(
      result => result.error
    )

  const trackingErrors =
    results.filter(
      result =>
        result.tracking_error
    )

  return NextResponse.json({
    published:
      results.filter(
        result => !result.error
      ).length,

    skipped:
      errors.length,

    errors:
      errors
        .map(
          result =>
            result.error
        )
        .filter(Boolean),

    tracking_errors:
      trackingErrors
        .map(
          result =>
            result.tracking_error
        )
        .filter(Boolean),

    results,
  })
}
