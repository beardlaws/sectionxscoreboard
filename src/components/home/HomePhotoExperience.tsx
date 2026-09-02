'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import HomeClient from '@/components/home/HomeClient'

type Props = Record<string, any> & { homepagePhotos?: any[] }

const ROTATE_MS = 6000
const HomeClientAny = HomeClient as any

export default function HomePhotoExperience({ homepagePhotos = [], ...homeProps }: Props) {
  const photos = useMemo(() => homepagePhotos.filter(photo => photo?.photo_url), [homepagePhotos])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const touchStart = useRef<number | null>(null)
  const active = photos[index] || homeProps.featuredPhoto || null

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  useEffect(() => {
    if (photos.length < 2 || paused || reduceMotion) return
    const timer = window.setInterval(() => {
      setIndex(current => (current + 1) % photos.length)
    }, ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [photos.length, paused, reduceMotion])

  useEffect(() => {
    if (!photos.length) return
    const heroLink = document.querySelector<HTMLAnchorElement>('section a[href="/photos"]')
    if (!heroLink) return

    const href = active?.game?.id ? `/game-center/${active.game.id}` : '/photos'
    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-home-photo-control]')) return
      event.preventDefault()
      window.location.href = href
    }
    const enter = () => setPaused(true)
    const leave = () => setPaused(false)
    const touchBegin = (event: TouchEvent) => { touchStart.current = event.touches[0]?.clientX ?? null }
    const touchEnd = (event: TouchEvent) => {
      const start = touchStart.current
      touchStart.current = null
      if (start == null || photos.length < 2) return
      const end = event.changedTouches[0]?.clientX ?? start
      const delta = end - start
      if (Math.abs(delta) < 45) return
      setIndex(current => delta < 0 ? (current + 1) % photos.length : (current - 1 + photos.length) % photos.length)
    }

    heroLink.addEventListener('click', clickHandler)
    heroLink.addEventListener('mouseenter', enter)
    heroLink.addEventListener('mouseleave', leave)
    heroLink.addEventListener('touchstart', touchBegin, { passive: true })
    heroLink.addEventListener('touchend', touchEnd, { passive: true })

    let controls = heroLink.querySelector<HTMLDivElement>('[data-home-photo-controls]')
    if (!controls && photos.length > 1) {
      controls = document.createElement('div')
      controls.dataset.homePhotoControls = 'true'
      controls.dataset.homePhotoControl = 'true'
      controls.setAttribute('aria-label', 'Homepage photo carousel controls')
      controls.style.cssText = 'position:absolute;right:14px;top:14px;z-index:10;display:flex;gap:7px;padding:8px;border-radius:999px;background:rgba(4,7,12,.58);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.09)'
      heroLink.appendChild(controls)
    }

    if (controls) {
      controls.innerHTML = ''
      photos.forEach((_photo, photoIndex) => {
        const dot = document.createElement('button')
        dot.type = 'button'
        dot.dataset.homePhotoControl = 'true'
        dot.setAttribute('aria-label', `Show photo ${photoIndex + 1} of ${photos.length}`)
        dot.style.cssText = `width:${photoIndex === index ? '20px' : '8px'};height:8px;border:0;border-radius:999px;padding:0;cursor:pointer;background:${photoIndex === index ? '#facc15' : 'rgba(255,255,255,.42)'};transition:width .2s ease,background .2s ease`
        dot.addEventListener('click', event => {
          event.preventDefault()
          event.stopPropagation()
          setIndex(photoIndex)
          setPaused(true)
          window.setTimeout(() => setPaused(false), 8000)
        })
        controls!.appendChild(dot)
      })
    }

    return () => {
      heroLink.removeEventListener('click', clickHandler)
      heroLink.removeEventListener('mouseenter', enter)
      heroLink.removeEventListener('mouseleave', leave)
      heroLink.removeEventListener('touchstart', touchBegin)
      heroLink.removeEventListener('touchend', touchEnd)
    }
  }, [active?.game?.id, index, photos])

  return <HomeClientAny {...homeProps} featuredPhoto={active} />
}
