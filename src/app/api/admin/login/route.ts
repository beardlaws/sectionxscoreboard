import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
} from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const sessionSecret = process.env.ADMIN_SESSION_TOKEN

  if (!adminPassword || !sessionSecret) {
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

  const session = await createAdminSession(sessionSecret)
  const res = NextResponse.json({ ok: true })

  res.cookies.set(ADMIN_SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/',
  })

  // Remove the old compatibility cookie if a browser still has one.
  res.cookies.set('admin_auth', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })

  return res
}
