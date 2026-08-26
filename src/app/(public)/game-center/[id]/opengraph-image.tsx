import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function joined<T = any>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function shortName(value: string) {
  return value
    .replace(' Central High School', '')
    .replace(' Central School', '')
    .replace(' High School', '')
    .replace(' School', '')
}

function timeLabel(value: string | null) {
  if (!value) return 'TIME TBA'
  const [hRaw, mRaw] = value.split(':')
  const h = Number(hRaw)
  const m = Number(mRaw)
  if (Number.isNaN(h) || Number.isNaN(m)) return value
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function statusKey(value: string | null) {
  return String(value || 'Scheduled').trim().toLowerCase()
}

export default async function Image({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data } = await supabase
    .from('games')
    .select(`
      game_date, game_time, status, home_score, away_score,
      sport:sports(sport_name, gender),
      home_team:teams!games_home_team_id_fkey(school:schools(school_name, logo_url, primary_color, secondary_color)),
      away_team:teams!games_away_team_id_fkey(school:schools(school_name, logo_url, primary_color, secondary_color)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(name),
      external_away:external_opponents!games_external_away_opponent_id_fkey(name)
    `)
    .eq('id', params.id)
    .single()

  const game: any = data || {}
  const homeTeam = joined<any>(game.home_team)
  const awayTeam = joined<any>(game.away_team)
  const homeSchool = joined<any>(homeTeam?.school)
  const awaySchool = joined<any>(awayTeam?.school)
  const externalHome = joined<any>(game.external_home)
  const externalAway = joined<any>(game.external_away)
  const homeName = shortName(homeSchool?.school_name || externalHome?.name || 'Home')
  const awayName = shortName(awaySchool?.school_name || externalAway?.name || 'Away')
  const homeColor = homeSchool?.primary_color || '#facc15'
  const awayColor = awaySchool?.primary_color || '#2563eb'
  const status = statusKey(game.status)
  const final = status === 'final'
  const live = status === 'live' || status === 'in progress'
  const postponed = status === 'postponed'
  const canceled = status === 'canceled' || status === 'cancelled'
  const date = game.game_date
    ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${game.game_date}T12:00:00Z`))
    : 'Section X'
  const sport = `${game.sport?.gender ? `${game.sport.gender} ` : ''}${game.sport?.sport_name || 'Sports'}`
  const center = final || live
    ? `${game.away_score ?? '—'}  –  ${game.home_score ?? '—'}`
    : postponed
      ? 'POSTPONED'
      : canceled
        ? 'CANCELED'
        : timeLabel(game.game_time)
  const centerSub = final ? 'FINAL' : live ? 'LATEST REPORTED SCORE' : postponed || canceled ? sport.toUpperCase() : 'GAME CENTER'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: '#060910',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          <div style={{ width: '50%', height: '100%', background: `linear-gradient(90deg, ${awayColor}66, transparent)` }} />
          <div style={{ width: '50%', height: '100%', background: `linear-gradient(270deg, ${homeColor}66, transparent)` }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(6,9,16,.12),rgba(6,9,16,.88))' }} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '38px 54px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ display: 'flex', width: '52px', height: '52px', borderRadius: '14px', alignItems: 'center', justifyContent: 'center', background: '#facc15', color: '#060910', fontSize: '22px', fontWeight: 900 }}>SX</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '1px' }}>SECTION X SCOREBOARD</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,.55)', marginTop: '3px' }}>GAME CENTER</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>{sport}</div>
            <div style={{ fontSize: '15px', color: 'rgba(255,255,255,.55)', marginTop: '4px' }}>{date}</div>
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '18px 58px 28px' }}>
          <div style={{ width: '33%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ width: '150px', height: '150px', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.32)', border: '2px solid rgba(255,255,255,.15)' }}>
              {awaySchool?.logo_url ? <img src={awaySchool.logo_url} width="124" height="124" style={{ objectFit: 'contain' }} /> : <div style={{ fontSize: '40px', fontWeight: 900 }}>{awayName.slice(0, 2).toUpperCase()}</div>}
            </div>
            <div style={{ marginTop: '18px', fontSize: awayName.length > 20 ? '31px' : '38px', fontWeight: 900, lineHeight: 1.02 }}>{awayName}</div>
            <div style={{ marginTop: '8px', fontSize: '14px', color: 'rgba(255,255,255,.48)', letterSpacing: '2px' }}>AWAY</div>
          </div>

          <div style={{ width: '34%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: final || live ? '68px' : postponed || canceled ? '42px' : '52px', fontWeight: 900, letterSpacing: final || live ? '-3px' : '-1px' }}>{center}</div>
            <div style={{ marginTop: '12px', fontSize: '15px', fontWeight: 900, color: final ? '#4ade80' : live ? '#fde047' : postponed ? '#fb923c' : canceled ? '#f87171' : '#93c5fd', letterSpacing: '2px' }}>{centerSub}</div>
          </div>

          <div style={{ width: '33%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ width: '150px', height: '150px', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.32)', border: '2px solid rgba(255,255,255,.15)' }}>
              {homeSchool?.logo_url ? <img src={homeSchool.logo_url} width="124" height="124" style={{ objectFit: 'contain' }} /> : <div style={{ fontSize: '40px', fontWeight: 900 }}>{homeName.slice(0, 2).toUpperCase()}</div>}
            </div>
            <div style={{ marginTop: '18px', fontSize: homeName.length > 20 ? '31px' : '38px', fontWeight: 900, lineHeight: 1.02 }}>{homeName}</div>
            <div style={{ marginTop: '8px', fontSize: '14px', color: 'rgba(255,255,255,.48)', letterSpacing: '2px' }}>HOME</div>
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', padding: '0 54px 34px', fontSize: '15px', color: 'rgba(255,255,255,.45)' }}>sectionxscoreboard.com</div>
      </div>
    ),
    size
  )
}
