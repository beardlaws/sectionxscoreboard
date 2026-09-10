'use client'

import { useState } from 'react'
import { PhotoLightbox } from '@/components/PhotoLightbox'

type Photo = {
  id: string
  photo_url: string
  caption?: string | null
  photographer_credit_name?: string | null
  game_id?: string | null
}

export default function TeamPhotoLatestGrid({ photos, alt }: { photos: Photo[]; alt: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setLightboxIndex(index)}
            className="group block overflow-hidden rounded-xl border border-white/10 bg-black/20 cursor-zoom-in"
            aria-label={`Open photo ${index + 1} of ${photos.length}`}
          >
            <img
              src={photo.photo_url}
              alt={photo.caption || alt}
              className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
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
