import PublicLayout from '@/components/layout/PublicLayout'
import { createClient } from '@/lib/supabase/server'
import ContributorOnboarding from './ContributorOnboarding'

export const revalidate = 0

export const metadata = {
  title: 'Become a Section X Contributor | Section X Scoreboard',
  description: 'Help cover Section X sports with photos, scores, and game-day updates.',
}

export default async function ContributePage() {
  const supabase = createClient()
  const { data: schools } = await supabase
    .from('schools')
    .select('id,school_name')
    .eq('active', true)
    .order('school_name')

  return (
    <PublicLayout>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-transparent p-6 md:p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-blue-300 font-black">Section X Contributor Program</div>
          <h1 className="text-4xl md:text-5xl font-black text-white mt-2" style={{ fontFamily: 'var(--font-display)' }}>
            Help Cover Your Games
          </h1>
          <p className="text-slate-300 mt-3 max-w-2xl">
            Photographers, parents, coaches, students and fans can apply for a monitored contributor account. Approved contributors can submit photos, tag athletes, report scores, and — when specifically trusted by an admin — help score games live.
          </p>
        </div>

        <ContributorOnboarding schools={schools || []} />

        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="card p-4"><b className="text-white">Photographers</b><p className="text-slate-500 mt-1">Upload game photos, receive public credit, and tag rostered athletes for their galleries.</p></div>
          <div className="card p-4"><b className="text-white">Score Reporters</b><p className="text-slate-500 mt-1">Send verified finals and corrections from games you are actually following.</p></div>
          <div className="card p-4"><b className="text-white">Trusted Scorers</b><p className="text-slate-500 mt-1">Admin-approved reporters can receive game assignments and update the scoreboard live with a complete audit trail.</p></div>
        </div>
      </main>
    </PublicLayout>
  )
}
