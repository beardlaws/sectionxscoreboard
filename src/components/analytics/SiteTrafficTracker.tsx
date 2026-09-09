'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const VISITOR_KEY='sx_visitor_id'
const SESSION_KEY='sx_session'
const SESSION_TTL=30*60*1000
function uuid(){return crypto.randomUUID()}
function getVisitorId(){let id=localStorage.getItem(VISITOR_KEY);if(!id){id=uuid();localStorage.setItem(VISITOR_KEY,id)}return id}
function getSession(){
 const now=Date.now()
 try{const raw=sessionStorage.getItem(SESSION_KEY);if(raw){const s=JSON.parse(raw);if(s?.id&&now-Number(s.lastSeen||0)<SESSION_TTL){const next={...s,lastSeen:now};sessionStorage.setItem(SESSION_KEY,JSON.stringify(next));return next}}}catch{}
 const next={id:uuid(),lastSeen:now,landingPath:`${window.location.pathname}${window.location.search||''}`}
 sessionStorage.setItem(SESSION_KEY,JSON.stringify(next));return next
}
export default function SiteTrafficTracker(){
 const pathname=usePathname()
 useEffect(()=>{
  if(!pathname||pathname.startsWith('/admin')||pathname.startsWith('/api'))return
  const path=`${pathname}${window.location.search||''}`
  const qs=new URLSearchParams(window.location.search)
  const session=getSession()
  const payload=JSON.stringify({path,title:document.title,referrer:document.referrer||null,visitorId:getVisitorId(),sessionId:session.id,landingPath:session.landingPath,utmSource:qs.get('utm_source'),utmMedium:qs.get('utm_medium'),utmCampaign:qs.get('utm_campaign')})
  if(navigator.sendBeacon)navigator.sendBeacon('/api/analytics/track',new Blob([payload],{type:'application/json'}))
  else fetch('/api/analytics/track',{method:'POST',headers:{'content-type':'application/json'},body:payload,keepalive:true}).catch(()=>{})
 },[pathname])
 return null
}
