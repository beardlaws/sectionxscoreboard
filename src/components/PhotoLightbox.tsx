'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Photo {
  id: string
  photo_url: string
  caption?: string | null
  photographer_credit_name?: string | null
  submitter_name?: string
}

interface Props {
  photos: Photo[]
  initialIndex?: number
  onClose: () => void
}

export function PhotoLightbox({ photos, initialIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>

      {/* Close */}
      <button className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors hover:bg-white/10"
        onClick={onClose}>
        <X size={20} />
      </button>

      {/* Counter */}
      {photos.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-white/50"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>
          {index + 1} / {photos.length}
        </div>
      )}

      {/* Prev */}
      {photos.length > 1 && (
        <button className="absolute left-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          onClick={e => { e.stopPropagation(); prev() }}>
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Image */}
      <div className="relative max-w-5xl max-h-[85vh] w-full mx-16 flex flex-col items-center"
        onClick={e => e.stopPropagation()}>
        <img
          src={photo.photo_url}
          alt={photo.caption || 'Sports photo'}
          className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
        />
        {(photo.caption || photo.photographer_credit_name || photo.submitter_name) && (
          <div className="mt-3 text-center">
            {photo.caption && (
              <p className="text-white font-semibold text-sm">{photo.caption}</p>
            )}
            <p className="text-white/40 text-xs mt-1">
              📷 {photo.photographer_credit_name || photo.submitter_name}
            </p>
          </div>
        )}
      </div>

      {/* Next */}
      {photos.length > 1 && (
        <button className="absolute right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          onClick={e => { e.stopPropagation(); next() }}>
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  )
}

// Gallery grid with built-in lightbox
export function PhotoGalleryGrid({ photos }: { photos: Photo[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((photo, i) => (
          <button key={photo.id} onClick={() => setLightboxIndex(i)}
            className="group relative aspect-video rounded-xl overflow-hidden bg-white/5 cursor-pointer">
            <img src={photo.photo_url} alt={photo.caption || 'Sports photo'}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
              {photo.caption && (
                <p className="text-white text-xs font-semibold truncate">{photo.caption}</p>
              )}
              <p className="text-white/60 text-xs">📷 {photo.photographer_credit_name || photo.submitter_name}</p>
            </div>
            {/* Expand icon */}
            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-xs">⛶</span>
            </div>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}
