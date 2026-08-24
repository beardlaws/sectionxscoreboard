'use client'

import { useEffect } from 'react'
import { adminDb } from '@/lib/adminDb'

const TEAM_URLS_KEY = 'sectionx.schedule-sync.team-urls.v2'
const SCHOOL_URLS_KEY = 'sectionx.schedule-sync.school-urls.v2'

type TeamMapping = {
  team_id: string
  school_id: string | null
  schedule_url: string
}

type SchoolMapping = {
  school_id: string
  school_url: string
}

type Props = {
  teamMappings: TeamMapping[]
  schoolMappings: SchoolMapping[]
  teamSchoolMap: Record<string, string | null>
}

function readMap(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}

function arbiterTeamId(url: string) {
  const match = url.match(/\/Teams\/Schedule\/(\d+)/i)
  return match?.[1] || null
}

function arbiterEntityId(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('entityId') || parsed.searchParams.get('activeEntityId')
  } catch {
    return null
  }
}

export default function PersistentArbiterMappings({
  teamMappings,
  schoolMappings,
  teamSchoolMap,
}: Props) {
  useEffect(() => {
    const dbTeamUrls = Object.fromEntries(
      teamMappings.map(mapping => [mapping.team_id, mapping.schedule_url])
    )
    const dbSchoolUrls = Object.fromEntries(
      schoolMappings.map(mapping => [mapping.school_id, mapping.school_url])
    )

    const mergedTeamUrls = { ...dbTeamUrls, ...readMap(TEAM_URLS_KEY) }
    const mergedSchoolUrls = { ...dbSchoolUrls, ...readMap(SCHOOL_URLS_KEY) }

    localStorage.setItem(TEAM_URLS_KEY, JSON.stringify(mergedTeamUrls))
    localStorage.setItem(SCHOOL_URLS_KEY, JSON.stringify(mergedSchoolUrls))

    let lastSnapshot = ''
    let stopped = false

    async function syncMappings() {
      const teamUrls = readMap(TEAM_URLS_KEY)
      const schoolUrls = readMap(SCHOOL_URLS_KEY)
      const snapshot = JSON.stringify({ teamUrls, schoolUrls })

      if (snapshot === lastSnapshot || stopped) return
      lastSnapshot = snapshot

      const now = new Date().toISOString()
      const schoolRows = Object.entries(schoolUrls).map(([school_id, school_url]) => ({
        school_id,
        school_url,
        entity_id: arbiterEntityId(school_url),
        updated_at: now,
      }))
      const teamRows = Object.entries(teamUrls).map(([team_id, schedule_url]) => ({
        team_id,
        school_id: teamSchoolMap[team_id] || null,
        schedule_url,
        arbiter_team_id: arbiterTeamId(schedule_url),
        updated_at: now,
      }))

      try {
        if (schoolRows.length) {
          await adminDb.upsert('arbiter_school_mappings', schoolRows, 'school_id')
        }
        if (teamRows.length) {
          await adminDb.upsert('arbiter_team_mappings', teamRows, 'team_id')
        }
      } catch (error) {
        console.error('Could not persist Arbiter mappings', error)
        lastSnapshot = ''
      }
    }

    void syncMappings()
    const timer = window.setInterval(() => void syncMappings(), 2500)

    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [schoolMappings, teamMappings, teamSchoolMap])

  return null
}
