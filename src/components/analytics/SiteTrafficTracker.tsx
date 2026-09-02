'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

const VISITOR_KEY = 'sx_visitor_id'
const SESSION_KEY = 'sx_session'
const SESSION_TTL = 30 * 60 * 1000

function uuid() {
  return crypto.randomUUID()
}

function getVisitorId() {
  let id = localStorage.getItem(VISITOR_KEY)
  if (!id) {
    id = uuid()
    localStorage.setItem(VISITOR_KEY, id)
  }
  return id
}

function getSessionId() {
  const now = Date.now()
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved?.id && now - Number(saved.lastSeen || 0) < SESSION_TTL) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: saved.id, lastSeen: now }))
        return saved.id as string
      }
    }
  } catch {}
  const id = uuid()
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastSeen: now }))
  return id
}

export default function SiteTrafficTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin') || pathname.startsWith('/api')) return
    const query = searchParams?.toString()
    const path = query ? `${pathname}?${query}` : pathname
    const payload = JSON.stringify({
      path,
      title: document.title,
      referrer: document.referrer || null,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
    })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/track', new Blob([payload], { type: 'application/json' }))
    } else {
      fetch('/api/analytics/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(() => {})
    }
  }, [pathname, searchParams])

  return null
}
