// src/app/api/admin/arbiter-discover/route.ts

import { NextRequest, NextResponse } from 'next/server'

interface DiscoveredTeam {
  teamId: string
  entityId: string
  name: string
  scheduleUrl: string
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

function extractEntityId(url: string): string | null {
  try {
    const parsed = new URL(url)

    const entityId =
      parsed.searchParams.get('entityId') ||
      parsed.searchParams.get('activeEntityId')

    return entityId
  } catch {
    return null
  }
}

function normalizeArbiterSchoolUrl(rawUrl: string): string | null {
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

    if (!entityId) return null

    return `https://arbiterlive.com/Teams?entityId=${entityId}`
  } catch {
    return null
  }
}

function discoverTeams(
  html: string,
  fallbackEntityId: string
): DiscoveredTeam[] {
  const discovered = new Map<string, DiscoveredTeam>()

  /*
    Arbiter schedule links follow this general form:

    /Teams/Schedule/9778565?activeEntityId=9954
  */
  const anchorRegex =
    /<a\b[^>]*href=["']([^"']*\/Teams\/Schedule\/(\d+)\?[^"']*activeEntityId=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi

  let match: RegExpExecArray | null

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = decodeHtml(match[1])
    const teamId = match[2]
    const entityId = match[3] || fallbackEntityId
    const linkText = stripHtml(match[4])

    /*
      Avoid duplicates if Arbiter renders the same schedule
      link more than once on the page.
    */
    if (discovered.has(teamId)) {
      const existing = discovered.get(teamId)!

      /*
        If our first match had a useless label like
        "Schedule", but a later match has the actual team
        name, keep the better name.
      */
      if (
        (!existing.name ||
          /^(schedule|view schedule|details)$/i.test(
            existing.name
          )) &&
        linkText &&
        !/^(schedule|view schedule|details)$/i.test(
          linkText
        )
      ) {
        existing.name = linkText
      }

      continue
    }

    discovered.set(teamId, {
      teamId,
      entityId,
      name: linkText || `Arbiter Team ${teamId}`,
      scheduleUrl:
        `https://arbiterlive.com/Teams/Schedule/${teamId}?activeEntityId=${entityId}`,
    })
  }

  /*
    Backup search in case Arbiter uses unquoted or differently
    structured links where the full anchor regex doesn't match.
  */
  const looseRegex =
    /\/Teams\/Schedule\/(\d+)\?[^"'<> ]*activeEntityId=(\d+)/gi

  while ((match = looseRegex.exec(html)) !== null) {
    const teamId = match[1]
    const entityId = match[2] || fallbackEntityId

    if (!discovered.has(teamId)) {
      discovered.set(teamId, {
        teamId,
        entityId,
        name: `Arbiter Team ${teamId}`,
        scheduleUrl:
          `https://arbiterlive.com/Teams/Schedule/${teamId}?activeEntityId=${entityId}`,
      })
    }
  }

  return Array.from(discovered.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const rawUrl =
      typeof body?.url === 'string'
        ? body.url.trim()
        : ''

    if (!rawUrl) {
      return NextResponse.json(
        {
          error: 'An ArbiterLive school URL is required.',
        },
        {
          status: 400,
        }
      )
    }

    const entityId = extractEntityId(rawUrl)

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
      normalizeArbiterSchoolUrl(rawUrl)

    if (!schoolUrl) {
      return NextResponse.json(
        {
          error:
            'Please use a public arbiterlive.com school/team URL.',
        },
        {
          status: 400,
        }
      )
    }

    const response = await fetch(schoolUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SectionXScoreboard/1.0)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },

      /*
        We want fresh Arbiter data instead of a cached
        Next.js response.
      */
      cache: 'no-store',
    })

    if (!response.ok) {
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

    const html = await response.text()

    const teams = discoverTeams(
      html,
      entityId
    )

    return NextResponse.json({
      success: true,
      entityId,
      schoolUrl,
      discoveredCount: teams.length,
      teams,
    })
  } catch (error: any) {
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
