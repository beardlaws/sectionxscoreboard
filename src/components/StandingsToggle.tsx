'use client'
import { useState } from 'react'
import Link from 'next/link'

interface Group { label: string; subLabel?: string; rows: any[] }

interface Props {
  divisionGroups: Group[]
  classGroups: Group[]
  hasDivision: boolean
  hasClass: boolean
}

function StandingsTable({ group }: { group: Group }) {
  return (
    <div className="card overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3"
        style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div>
          {group.label && (
            <h3 className="text-white font-bold font-display uppercase tracking-wide">{group.label}</h3>
          )}
          {group.subLabel && <p className="text-slate-400 text-xs mt-0.5">{group.subLabel}</p>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-white/10 bg-white/[0.02]">
              <th className="text-left px-4 py-3 font-medium w-8"></th>
              <th className="text-left px-2 py-3 font-medium">Team</th>
              <th className="text-center px-3 py-3 font-medium whitespace-nowrap">League<br/>Record</th>
              <th className="text-center px-3 py-3 font-medium whitespace-nowrap">Overall<br/>Record</th>
              <th className="text-center px-3 py-3 font-medium whitespace-nowrap">BTM<br/>Ranking</th>
              <th className="text-center px-3 py-3 font-medium hidden md:table-cell">PF</th>
              <th className="text-center px-3 py-3 font-medium hidden md:table-cell">PA</th>
              <th className="text-center px-3 py-3 font-medium hidden md:table-cell">DIFF</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row: any, i: number) => {
              const diff = row.points_for - row.points_against
              return (
                <tr key={row.team_id} className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">{i + 1}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: row.primary_color || '#334155' }} />
                      <Link href={`/teams/${row.team_slug || row.slug}`}
                        className="text-white font-medium hover:text-blue-400 transition-colors text-sm">
                        {row.school_name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-mono text-sm text-slate-300">
                      {row.league_wins}-{row.league_losses}{row.league_ties > 0 ? `-${row.league_ties}` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-mono text-sm text-slate-400">
                      {row.wins}-{row.losses}{row.ties > 0 ? `-${row.ties}` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-mono font-bold text-sm text-white">
                      {row.btm.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400 text-sm font-mono hidden md:table-cell">
                    {row.points_for}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400 text-sm font-mono hidden md:table-cell">
                    {row.points_against}
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-mono font-semibold hidden md:table-cell"
                    style={{ color: diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#94a3b8' }}>
                    {diff > 0 ? '+' : ''}{diff}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function StandingsToggle({ divisionGroups, classGroups, hasDivision, hasClass }: Props) {
  const [view, setView] = useState<'division' | 'class'>('division')

  const showToggle = hasDivision && hasClass && classGroups.length > 0 && divisionGroups.length > 0

  const groups = view === 'division' ? divisionGroups : classGroups

  return (
    <div>
      {/* Toggle */}
      {showToggle && (
        <div className="flex items-center gap-1 mb-5 p-1 rounded-xl w-fit"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setView('division')}
            className="px-4 py-1.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all"
            style={{
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.08em',
              background: view === 'division' ? 'rgba(37,99,235,0.8)' : 'transparent',
              color: view === 'division' ? '#ffffff' : '#4a5f7a',
              boxShadow: view === 'division' ? '0 2px 12px rgba(37,99,235,0.4)' : 'none',
            }}>
            By Division
          </button>
          <button
            onClick={() => setView('class')}
            className="px-4 py-1.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all"
            style={{
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.08em',
              background: view === 'class' ? 'rgba(37,99,235,0.8)' : 'transparent',
              color: view === 'class' ? '#ffffff' : '#4a5f7a',
              boxShadow: view === 'class' ? '0 2px 12px rgba(37,99,235,0.4)' : 'none',
            }}>
            By Class
          </button>
        </div>
      )}

      {/* Note */}
      {showToggle && (
        <p className="text-xs text-slate-600 mb-4">
          {view === 'division'
            ? 'Division view shows regular season groupings. League record = games vs same division.'
            : 'Class view shows playoff seeding brackets (A/B/C/D). League record is still division-based.'}
        </p>
      )}

      {/* Tables */}
      {groups.map((group, i) => (
        <StandingsTable key={i} group={group} />
      ))}
    </div>
  )
}
