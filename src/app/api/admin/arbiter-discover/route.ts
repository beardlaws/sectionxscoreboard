// src/app/api/admin/arbiter-discover/route.ts

import { NextRequest, NextResponse } from 'next/server'

interface DiscoveredTeam {
  teamId: string
  entityId: string

  sportName: string | null
  teamLabel: string

  gender: 'Boys' | 'Girls' | 'Coed' | null
  level: string | null
  isVarsity: boolean

  displayName: string

  scheduleUrl: string
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function stripHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function extractEntityId(
  url: string
): string | null {
  try {
    const parsed = new URL(url)

    return (
      parsed.searchParams.get('entityId') ||
      parsed.searchParams.get('activeEntityId')
    )
  } catch {
    return null
  }
}

function normalizeArbiterSchoolUrl(
  rawUrl: string
): string | null {
  try {
    const parsed = new URL(rawUrl)

    if (
      parsed.hostname !== 'arbiterlive.com' &&
      parsed.hostname !== 'www.arbiterlive.com'
    ) {
      return null
    }

    const entityId =
      parsed.searchParams.get('entityId') ||
      parsed.searchParams.get('activeEntityId')

    if (!entityId) {
      return null
    }

    return `https://arbiterlive.com/Teams?entityId=${entityId}`
  } catch {
    return null
  }
}

function classifyGender(
  label: string
): 'Boys' | 'Girls' | 'Coed' | null {
  if (/^boys\b/i.test(label)) {
    return 'Boys'
  }

  if (/^girls\b/i.test(label)) {
    return 'Girls'
  }

  if (
    /\b(coed|co-ed|mixed)\b/i.test(label)
  ) {
    return 'Coed'
  }

  return null
}

function classifyLevel(
  label: string
): string | null {
  /*
    IMPORTANT:
    Check Junior Varsity BEFORE Varsity.

    "Junior Varsity" contains the word "Varsity",
    so checking Varsity first incorrectly classifies JV
    teams as varsity.
  */
  if (
    /\bjunior varsity\b/i.test(label) ||
    /\bjv\b/i.test(label)
  ) {
    return 'Junior Varsity'
  }

  if (/\bvarsity\b/i.test(label)) {
    return 'Varsity'
  }

  if (/\bmodified\b/i.test(label)) {
    return 'Modified'
  }

  const gradeMatch = label.match(
    /\b(\d+(?:\/\d+)*(?:\/\d+)?(?:th|st|nd|rd)?)\b/i
  )

  if (gradeMatch) {
    return gradeMatch[1]
  }

  return null
}

function looksLikeSportHeading(
  text: string
): boolean {
  const cleaned =
    text.trim()

  if (!cleaned) {
    return false
  }

  if (
    /^(active teams|today'?s games|teams?|schedule|practice|roster|coaches?|season stats)$/i.test(
      cleaned
    )
  ) {
    return false
  }

  if (
    /^\d+\s+teams?$/i.test(
      cleaned
    )
  ) {
    return false
  }

  if (
    cleaned.length > 60
  ) {
    return false
  }

  return true
}

function discoverTeams(
  html: string,
  fallbackEntityId: string
): DiscoveredTeam[] {
  const discovered =
    new Map<
      string,
      DiscoveredTeam
    >()

  /*
    Scan headings and schedule links in document order.

    Arbiter groups teams underneath sport headings:

      Basketball
        Boys Varsity
        Boys Junior Varsity
        Girls Varsity

      Soccer
        Boys Varsity
        Girls Varsity

    We remember the most recent heading and attach it
    to each schedule link that follows.
  */
  const tokenRegex =
    /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>|<a\b[^>]*href=["']([^"']*\/Teams\/Schedule\/(\d+)\?[^"']*activeEntityId=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi

  let currentSport:
    | string
    | null = null

  let match:
    | RegExpExecArray
    | null

  while (
    (match =
      tokenRegex.exec(html)) !==
    null
  ) {
    /*
      Heading
    */
    if (match[1]) {
      const headingText =
        stripHtml(match[2])

      if (
        looksLikeSportHeading(
          headingText
        )
      ) {
        currentSport =
          headingText
      }

      continue
    }

    /*
      Schedule link
    */
    const teamId =
      match[4]

    const entityId =
      match[5] ||
      fallbackEntityId

    const teamLabel =
      stripHtml(match[6]) ||
      `Arbiter Team ${teamId}`

    if (
      discovered.has(teamId)
    ) {
      continue
    }

    const gender =
      classifyGender(
        teamLabel
      )

    const level =
      classifyLevel(
        teamLabel
      )

    const isVarsity =
      level === 'Varsity'

    const displayName =
      [
        gender,
        level,
        currentSport,
      ]
        .filter(Boolean)
        .join(' ')

    discovered.set(
      teamId,
      {
        teamId,
        entityId,

        sportName:
          currentSport,

        teamLabel,

        gender,

        level,

        isVarsity,

        displayName:
          displayName ||
          teamLabel,

        scheduleUrl:
          `https://arbiterlive.com/Teams/Schedule/${teamId}?activeEntityId=${entityId}`,
      }
    )
  }

  /*
    Backup discovery in case Arbiter changes markup.

    These fallback records preserve the ID even if
    sport/team metadata cannot be read.
  */
  const looseRegex =
    /\/Teams\/Schedule\/(\d+)\?[^"'<> ]*activeEntityId=(\d+)/gi

  while (
    (match =
      looseRegex.exec(html)) !==
    null
  ) {
    const teamId =
      match[1]

    const entityId =
      match[2] ||
      fallbackEntityId

    if (
      discovered.has(teamId)
    ) {
      continue
    }

    discovered.set(
      teamId,
      {
        teamId,
        entityId,

        sportName: null,

        teamLabel:
          `Arbiter Team ${teamId}`,

        gender: null,

        level: null,

        isVarsity: false,

        displayName:
          `Arbiter Team ${teamId}`,

        scheduleUrl:
          `https://arbiterlive.com/Teams/Schedule/${teamId}?activeEntityId=${entityId}`,
      }
    )
  }

  return Array.from(
    discovered.values()
  ).sort((a, b) => {
    const sportCompare =
      (
        a.sportName || ''
      ).localeCompare(
        b.sportName || ''
      )

    if (
      sportCompare !== 0
    ) {
      return sportCompare
    }

    return (
      a.teamLabel.localeCompare(
        b.teamLabel
      )
    )
  })
}

export async function POST(
  req: NextRequest
) {
  try {
    const body =
      await req.json()

    const rawUrl =
      typeof body?.url ===
      'string'
        ? body.url.trim()
        : ''

    if (!rawUrl) {
      return NextResponse.json(
        {
          error:
            'An ArbiterLive school URL is required.',
        },
        {
          status: 400,
        }
      )
    }

    const entityId =
      extractEntityId(
        rawUrl
      )

    if (!entityId) {
      return NextResponse.json(
        {
          error:
            'Could not find an Arbiter entityId in that URL.',
        },
        {
          status: 400,
        }
      )
    }

    const schoolUrl =
      normalizeArbiterSchoolUrl(
        rawUrl
      )

    if (!schoolUrl) {
      return NextResponse.json(
        {
          error:
            'Please use a public arbiterlive.com school or team URL.',
        },
        {
          status: 400,
        }
      )
    }

    const response =
      await fetch(
        schoolUrl,
        {
          method: 'GET',

          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; SectionXScoreboard/1.0)',

            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },

          cache:
            'no-store',
        }
      )

    if (
      !response.ok
    ) {
      return NextResponse.json(
        {
          error:
            `Arbiter returned HTTP ${response.status}.`,
        },
        {
          status: 502,
        }
      )
    }

    const html =
      await response.text()

    const teams =
      discoverTeams(
        html,
        entityId
      )

    const varsityTeams =
      teams.filter(
        team =>
          team.isVarsity
      )

    const sports =
      Array.from(
        new Set(
          teams
            .map(
              team =>
                team.sportName
            )
            .filter(
              (
                value
              ): value is string =>
                !!value
            )
        )
      ).sort()

    return NextResponse.json(
      {
        success: true,

        entityId,

        schoolUrl,

        discoveredCount:
          teams.length,

        varsityCount:
          varsityTeams.length,

        sports,

        teams,

        varsityTeams,
      }
    )
  } catch (
    error: any
  ) {
    console.error(
      'Arbiter discovery error:',
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Could not discover Arbiter teams.',
      },
      {
        status: 500,
      }
    )
  }
}
