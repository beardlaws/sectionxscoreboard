import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { fanEmailConfigured, sendFanEmail } from '@/lib/fan-alerts/email'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const db = createAdminClient()
  const token = req.headers.get('x-sectionx-automation-key') || ''
  const { data: allowed, error: authError } = await db.rpc('verify_sectionx_automation_key', { p_token: token })
  if (authError || allowed !== true) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!fanEmailConfigured()) return NextResponse.json({ ok: false, error: 'No fan email provider configured.' }, { status: 503 })

  const { data: follow, error } = await db
    .from('fan_follow_preferences')
    .select('id,email,manage_token,active,created_at')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!follow) return NextResponse.json({ ok: false, error: 'No active fan follow exists to test.' }, { status: 404 })

  const manageUrl = `https://sectionxscoreboard.com/following?token=${encodeURIComponent(follow.manage_token)}`
  const result = await sendFanEmail({
    to: follow.email,
    subject: 'Section X Scoreboard alert system test',
    html: `<!doctype html><html><body style="margin:0;background:#070b12;color:#fff;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:28px"><div style="font-size:12px;letter-spacing:.18em;color:#facc15;font-weight:700">SECTION X SCOREBOARD</div><h1 style="font-size:28px;margin:10px 0 8px">Alert system test</h1><p style="font-size:17px;color:#dbe4f0">If you received this, Section X fan alerts are connected end to end: follower preference → secure dispatcher → verified Section X sending domain → inbox.</p><p style="margin:28px 0"><a href="https://sectionxscoreboard.com" style="background:#facc15;color:#000;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Open Section X</a></p><p style="font-size:12px;color:#7c8ba1">This was a one-time system test, not a game alert. <a href="${manageUrl}" style="color:#9fb9ff">Manage alerts or unsubscribe</a>.</p></div></body></html>`,
  })

  if (result.error) return NextResponse.json({ ok: false, provider: result.provider || null, error: result.error }, { status: 502 })
  return NextResponse.json({ ok: true, provider: result.provider || null, providerId: result.id || null, tested: true })
}
