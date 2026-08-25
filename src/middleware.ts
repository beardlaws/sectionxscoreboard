import { NextRequest, NextResponse } from 'next/server'

const ADMIN_SESSION_COOKIE = 'sectionx_admin_session'

function hasValidAdminSession(req: NextRequest) {
  const expected = process.env.ADMIN_SESSION_TOKEN
  const actual = req.cookies.get(ADMIN_SESSION_COOKIE)?.value

  return Boolean(expected && actual && actual === expected)
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next()
  }

  // Login must stay reachable when there is no active session.
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next()
  }

  if (!hasValidAdminSession(req)) {
    if (isAdminApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const loginUrl = new URL('/admin/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
