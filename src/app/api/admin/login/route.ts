import { NextRequest, NextResponse } from 'next/server'

const ADMIN_SESSION_COOKIE = 'sectionx_admin_session'
const LEGACY_ADMIN_COOKIE = 'admin_auth'
const LEGACY_ROUTE_TOKEN = 'SectionXScoreboardTheRightWay!'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const sessionToken = process.env.ADMIN_SESSION_TOKEN

  if (!adminPassword || !sessionToken) {
    console.error('Admin authentication is not configured. ADMIN_PASSWORD and ADMIN_SESSION_TOKEN are required.')
    return NextResponse.json(
      { error: 'Admin authentication is not configured.' },
      { status: 503 }
    )
  }

  const { password } = await req.json()

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: SESSION_MAX_AGE,
    path: '/',
  }

  // The new session token is the real outer security gate enforced by middleware.
  res.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, cookieOptions)

  // Temporary compatibility cookie for older admin routes that still perform
  // their own legacy check. Middleware blocks access before those routes run,
  // so this value alone can no longer authorize an admin request.
  res.cookies.set(LEGACY_ADMIN_COOKIE, LEGACY_ROUTE_TOKEN, cookieOptions)

  return res
}
