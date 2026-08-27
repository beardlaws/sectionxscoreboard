'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Share2, Check, Expand } from 'lucide-react'

interface Photo {
  id: string
  photo_url: string
  caption?: string | null
  photographer_credit_name?: string | null
  submitter_name?: string
  game_id?: string | null
}

interface Props {
  photos: Photo[]
  initialIndex?: number
  onClose: () => void
}

export function PhotoLightbox({ photos, initialIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [copied, setCopied] = useState(false)
  const touchStart = useRef<number | null>(null)
  const photo = photos[index]

  const prev = useCallback(() => setIndex(i => (i - 1 + photos.length) % photos.length), [photos.length])
  const next = useCallback(() => setIndex(i => (i + 1) % photos.length), [photos.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, prev, next])

  async function sharePhoto() {
    const base = photo.game_id ? `${window.location.origin}/game-center/${photo.game_id}` : window.location.href.split('#')[0]
    const url = `${base}#photo-${photo.id}`
    const title = photo.caption || 'Section X sports photo'
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Share cancellation is harmless.
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0]?.clientX ?? null
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStart.current == null || photos.length < 2) return
    const end = e.changedTouches[0]?.clientX ?? touchStart.current
    const delta = end - touchStart.current
    touchStart.current = null
    if (Math.abs(delta) < 45) return
    if (delta > 0) prev()
    else next()
  }

  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-3">
        <div className="rounded-full bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
          {index + 1} / {photos.length}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-black/45 px-3 text-xs font-bold text-white/80 hover:bg-white/10"
            onClick={e => { e.stopPropagation(); sharePhoto() }}
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>
          <button
            type="button"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-black/45 text-white hover:bg-white/10"
            onClick={e => { e.stopPropagation(); onClose() }}
            aria-label="Close photo viewer"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {photos.length > 1 && (
        <button
          type="button"
          className="absolute left-2 sm:left-4 z-10 w-11 h-11 rounded-full flex items-center justify-center bg-black/40 text-white hover:bg-white/10"
          onClick={e => { e.stopPropagation(); prev() }}
          aria-label="Previous photo"
        >
          <ChevronLeft size={26} />
        </button>
      )}

      <div
        className="relative max-w-6xl max-h-[92vh] w-full px-4 sm:px-16 flex flex-col items-center"
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={photo.photo_url}
          alt={photo.caption || 'Section X sports photo'}
          className="max-h-[78vh] w-auto max-w-full object-contain rounded-lg shadow-2xl select-none"
          draggable={false}
        />
        <div className="mt-3 min-h-[44px] text-center px-6">
          {photo.caption && <p className="text-white font-semibold text-sm sm:text-base">{photo.caption}</p>}
          {(photo.photographer_credit_name || photo.submitter_name) && (
            <p className="text-white/45 text-xs mt-1">Photo: {photo.photographer_credit_name || photo.submitter_name}</p>
          )}
          {photos.length > 1 && <p className="sm:hidden text-white/25 text-[10px] mt-2 uppercase tracking-widest">Swipe for more</p>}
        </div>
      </div>

      {photos.length > 1 && (
        <button
          type="button"
          className="absolute right-2 sm:right-4 z-10 w-11 h-11 rounded-full flex items-center justify-center bg-black/40 text-white hover:bg-white/10"
          onClick={e => { e.stopPropagation(); next() }}
          aria-label="Next photo"
        >
          <ChevronRight size={26} />
        </button>
      )}
    </div>
  )
}

export function PhotoGalleryGrid({ photos }: { photos: Photo[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((photo, i) => (
          <button
            id={`photo-${photo.id}`}
            key={photo.id}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="group relative aspect-video rounded-xl overflow-hidden bg-white/5 cursor-pointer border border-white/[0.06] hover:border-yellow-300/25 transition-colors"
          >
            <img
              src={photo.photo_url}
              alt={photo.caption || 'Section X sports photo'}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-left">
              {photo.caption && <p className="text-white text-xs font-semibold truncate">{photo.caption}</p>}
              {(photo.photographer_credit_name || photo.submitter_name) && <p className="text-white/60 text-[10px] truncate">Photo: {photo.photographer_credit_name || photo.submitter_name}</p>}
            </div>
            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 flex items-center justify-center text-white/80 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <Expand size={13} />
            </div>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox photos={photos} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  )
}
