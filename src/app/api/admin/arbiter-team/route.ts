// src/app/api/admin/arbiter-team/route.ts

import { NextRequest, NextResponse } from 'next/server'

interface ScheduleRow {
  dateTime: string
  homeAway: string
  opponent: string
  location: string
  results: string
  status: string
  type: string
  raw: string
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
    .replace(/&#160;/g, ' ')
}

function stripHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<img\b[^>]*alt=["'][^"']*Opponent logo[^"']*["'][^>]*>/gi, ' ')
      .replace(/<img\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function normalizeArbiterTeamUrl(
  rawUrl: string
): {
  url: string
  teamId: string
  entityId: string | null
} | null {
  try {
    const parsed = new URL(rawUrl)

    if (
      parsed.hostname !== 'arbiterlive.com' &&
      parsed.hostname !== 'www.arbiterlive.com'
    ) {
      return null
    }

    const match = parsed.pathname.match(
      /^\/Teams\/Schedule\/(\d+)\/?$/i
    )

    if (!match) {
      return null
    }

    const teamId = match[1]

    const entityId =
      parsed.searchParams.get('activeEntityId') ||
      parsed.searchParams.get('entityId')

    const url = entityId
      ? `https://arbiterlive.com/Teams/Schedule/${teamId}?activeEntityId=${entityId}`
      : `https://arbiterlive.com/Teams/Schedule/${teamId}`

    return {
      url,
      teamId,
      entityId,
    }
  } catch {
    return null
  }
}

function extractCells(rowHtml: string): string[] {
  const cells: string[] = []

  const cellRegex =
    /<td\b[^>]*>([\s\S]*?)<\/td>/gi

  let match: RegExpExecArray | null

  while (
    (match = cellRegex.exec(rowHtml)) !== null
  ) {
    cells.push(
      stripHtml(match[1])
    )
  }

  return cells
}

function findScheduleTable(
  html: string
): string | null {
  /*
    Arbiter pages contain several tables:
      schedule
      practices
      roster
      coaches

    The schedule table is the one containing both
    "Date/Time" and "Opponent".
  */
  const tableRegex =
    /<table\b[^>]*>([\s\S]*?)<\/table>/gi

  let match: RegExpExecArray | null

  while (
    (match = tableRegex.exec(html)) !== null
  ) {
    const table = match[0]
    const text = stripHtml(table)

    if (
      /Date\/Time/i.test(text) &&
      /Opponent/i.test(text) &&
      /Location/i.test(text)
    ) {
      return table
    }
  }

  return null
}

function extractTeamName(
  html: string
): string | null {
  /*
    Known Arbiter public pages contain labels like:
      Girls Varsity Soccer (0 - 0)
      Boys Varsity Soccer (0 - 0)

    Search text around that record first.
  */
  const cleaned = stripHtml(html)

  const recordMatch = cleaned.match(
    /\b((?:Boys|Girls|Coed)\s+(?:Varsity|Junior Varsity|JV|Modified|[\d/]+(?:th|st|nd|rd)?)\s+[A-Za-z][A-Za-z &'-]+?)\s*\(\s*\d+\s*-\s*\d+\s*\)/i
  )

  if (recordMatch) {
    return recordMatch[1].trim()
  }

  return null
}

function parseScheduleTable(
  tableHtml: string
): ScheduleRow[] {
  const rows: ScheduleRow[] = []

  const rowRegex =
    /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi

  let match: RegExpExecArray | null

  while (
    (match = rowRegex.exec(tableHtml)) !== null
  ) {
    const cells =
      extractCells(match[0])

    /*
      Standard Arbiter schedule layout:

      0 Date/Time
      1 Home or Away
      2 Opponent
      3 Location
      4 Results
      5 Status
      6 Type
      7 Links
    */
    if (cells.length < 3) {
      continue
    }

    const dateTime =
      cells[0]?.trim() || ''

    /*
      Skip the table header.
    */
    if (
      !dateTime ||
      /Date\/Time/i.test(dateTime)
    ) {
      continue
    }

    /*
      We only want schedule-looking rows.

      Examples:
        Wed Sep 2 4:00 PM
        Wed Sep 2 - Sat Sep 5

      This also intentionally keeps tournament/event
      container rows so your existing parser can flag
      them low confidence instead of silently losing them.
    */
    if (
      !/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/i.test(
        dateTime
      )
    ) {
      continue
    }

    const homeAway =
      cells[1]?.trim() || ''

    const opponent =
      cells[2]?.trim() || ''

    const location =
      cells[3]?.trim() || ''

    const results =
      cells[4]?.trim() || ''

    const status =
      cells[5]?.trim() || ''

    const type =
      cells[6]?.trim() || ''

    /*
      Build the exact sort of plain-text row your existing
      Arbiter parser already knows how to handle.
    */
    const raw = [
      dateTime,
      homeAway,
      opponent,
      location,
      status,
      type,
    ]
      .filter(Boolean)
      .join('    ')

    rows.push({
      dateTime,
      homeAway,
      opponent,
      location,
      results,
      status,
      type,
      raw,
    })
  }

  return rows
}

function rowsToArbiterText(
  rows: ScheduleRow[]
): string {
  /*
    Header matches the style of Arbiter's copied table.
  */
  const header =
    'Date/Time    Home or Away    Opponent    Location    Results    Status    Type    Links'

  return [
    header,
    ...rows.map(row => row.raw),
  ].join('\n')
}

export async function POST(
  req: NextRequest
) {
  try {
    const body =
      await req.json()

    const rawUrl =
      typeof body?.url === 'string'
        ? body.url.trim()
        : ''

    if (!rawUrl) {
      return NextResponse.json(
        {
          error:
            'An ArbiterLive team schedule URL is required.',
        },
        {
          status: 400,
        }
      )
    }

    const normalized =
      normalizeArbiterTeamUrl(
        rawUrl
      )

    if (!normalized) {
      return NextResponse.json(
        {
          error:
            'Please use a public ArbiterLive team schedule URL.',
        },
        {
          status: 400,
        }
      )
    }

    const response =
      await fetch(
        normalized.url,
        {
          method: 'GET',

          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; SectionXScoreboard/1.0)',

            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },

          cache: 'no-store',
        }
      )

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

    const html =
      await response.text()

    const scheduleTable =
      findScheduleTable(html)

    if (!scheduleTable) {
      return NextResponse.json(
        {
          error:
            'Could not find an Arbiter schedule table on that page.',
          teamId:
            normalized.teamId,
          entityId:
            normalized.entityId,
        },
        {
          status: 422,
        }
      )
    }

    const rows =
      parseScheduleTable(
        scheduleTable
      )

    if (
      rows.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Arbiter schedule table was found, but no schedule rows could be read.',
          teamId:
            normalized.teamId,
          entityId:
            normalized.entityId,
        },
        {
          status: 422,
        }
      )
    }

    const teamName =
      extractTeamName(html)

    const arbiterText =
      rowsToArbiterText(rows)

    return NextResponse.json({
      success: true,

      teamId:
        normalized.teamId,

      entityId:
        normalized.entityId,

      teamName,

      sourceUrl:
        normalized.url,

      rowCount:
        rows.length,

      rows,

      /*
        THIS is what we will feed straight into your
        existing parseArbiterSchedule() function.
      */
      arbiterText,
    })
  } catch (error: any) {
    console.error(
      'Arbiter team fetch error:',
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Could not fetch the Arbiter schedule.',
      },
      {
        status: 500,
      }
    )
  }
}
