import { NextResponse } from 'next/server'
import { ArbiterApiError, arbiterApi, getArbiterConfigStatus } from '@/lib/arbiter/client'

export const dynamic = 'force-dynamic'

const SECTION_X_SCHOOL_IDS = [
  2630, 52120, 3988, 4543, 4769, 6714, 8736, 9356, 9563, 9923, 9954, 13012,
  13569, 7896, 14077, 15195, 16678, 16935, 17532, 18479, 20233, 20061, 20146,
  23855,
]

function count(value: unknown): number | null {
  return Array.isArray(value) ? value.length : value == null ? 0 : null
}

function message(error: unknown) {
  return error instanceof ArbiterApiError
    ? `${error.message} (${error.status}) ${JSON.stringify(error.details ?? '')}`
    : error instanceof Error
      ? error.message
      : 'Unknown Arbiter API error'
}

export async function GET() {
  const config = getArbiterConfigStatus()

  if (!config.configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: 'Add ARBITER_CLIENT_ID and ARBITER_CLIENT_SECRET in Vercel first.',
    })
  }

  try {
    const [identity, groups, sports, levels] = await Promise.all([
      arbiterApi.identity(),
      arbiterApi.groups(),
      arbiterApi.sports(),
      arbiterApi.levels(),
    ])

    let nySchools: unknown = null
    let nySchoolsError: string | null = null
    let sectionXSchools: unknown = null
    let sectionXSchoolsError: string | null = null

    try {
      nySchools = await arbiterApi.schools({ StateAbbreviation: 'NY', IsAccessible: true })
    } catch (error) {
      nySchoolsError = message(error)
    }

    try {
      sectionXSchools = await arbiterApi.schools({ SchoolIds: SECTION_X_SCHOOL_IDS })
    } catch (error) {
      sectionXSchoolsError = message(error)
    }

    const schoolRows = Array.isArray(sectionXSchools)
      ? sectionXSchools
      : Array.isArray(nySchools)
        ? nySchools
        : []

    const schoolIds = schoolRows
      .map((school: any) => Number(school?.schoolId ?? school?.schoolID ?? school?.id))
      .filter((id: number) => Number.isFinite(id))

    const teamResults = await Promise.all(
      schoolIds.slice(0, 50).map(async schoolId => {
        try {
          const teams = await arbiterApi.teams({ schoolId })
          return { schoolId, ok: true, teams }
        } catch (error) {
          return { schoolId, ok: false, error: message(error), teams: null }
        }
      })
    )

    const teams = teamResults.flatMap(result =>
      Array.isArray(result.teams) ? result.teams : []
    )

    return NextResponse.json({
      ok: true,
      authenticated: true,
      summary: {
        groups: count(groups),
        sports: count(sports),
        levels: count(levels),
        nyAccessibleSchools: count(nySchools),
        sectionXSchools: count(sectionXSchools),
        teams: teams.length,
      },
      identity,
      groups,
      sports,
      levels,
      nySchools,
      nySchoolsError,
      sectionXSchools,
      sectionXSchoolsError,
      teamResults,
      teams,
    })
  } catch (error) {
    console.error('Arbiter API discovery error:', error)

    if (error instanceof ArbiterApiError) {
      return NextResponse.json(
        {
          ok: false,
          authenticated: false,
          error: error.message,
          arbiterStatus: error.status,
          details: error.details,
        },
        { status: 502 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Unknown Arbiter discovery error',
      },
      { status: 500 }
    )
  }
}
