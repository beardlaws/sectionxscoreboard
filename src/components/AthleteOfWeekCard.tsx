// src/components/AthleteOfWeekCard.tsx
// Shows on homepage sidebar when an athlete is published

interface Props {
  athlete: {
    id: string
    athlete_name: string
    sport_name?: string
    grade?: string
    stats?: string
    body: string
    photo_url?: string
    week_of: string
    school?: { school_name: string; primary_color?: string; logo_url?: string }
  }
}

export default function AthleteOfWeekCard({ athlete }: Props) {
  return (
    <div className="rounded-2xl overflow-hidden border border-yellow-400/20"
      style={{ background: 'rgba(251,191,36,0.04)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-yellow-400/10 flex items-center gap-2">
        <span className="text-base">🏅</span>
        <p className="text-xs font-black text-yellow-400 uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>
          Athlete of the Week
        </p>
      </div>

      <div className="p-4">
        {/* Photo + name */}
        <div className="flex items-center gap-3 mb-3">
          {athlete.photo_url ? (
            <img src={athlete.photo_url} alt={athlete.athlete_name}
              className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-white/10" />
          ) : (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10"
              style={{ background: athlete.school?.primary_color || '#1e3a5f' }}>
              {athlete.school?.logo_url
                ? <img src={athlete.school.logo_url} alt="" className="w-full h-full object-contain p-1.5" />
                : <span className="text-white font-black text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                    {athlete.athlete_name[0]}
                  </span>
              }
            </div>
          )}
          <div className="min-w-0">
            <p className="font-black text-white text-base leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}>
              {athlete.athlete_name}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {[athlete.grade, athlete.sport_name, athlete.school?.school_name].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {/* Stats highlight */}
        {athlete.stats && (
          <div className="rounded-lg px-3 py-2 mb-3"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <p className="text-xs font-black text-yellow-400" style={{ fontFamily: 'var(--font-display)' }}>
              {athlete.stats}
            </p>
          </div>
        )}

        {/* Story */}
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{athlete.body}</p>

        {/* Nominate CTA */}
        <a href="/nominate"
          className="block text-center mt-3 text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
          NOMINATE AN ATHLETE →
        </a>
      </div>
    </div>
  )
}
