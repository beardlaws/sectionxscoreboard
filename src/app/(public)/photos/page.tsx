import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import Link from 'next/link'
import { Camera } from 'lucide-react'
import PublicLayout from '@/components/layout/PublicLayout'
import { PhotoGalleryGrid } from '@/components/PhotoLightbox'

export const metadata: Metadata = {
  title: 'Photos | Section X Scoreboard',
  description: 'Section X high school sports photos from Northern New York.',
}

export const dynamic = 'force-dynamic'

export default async function PhotosPage() {
  const supabase = createClient()

  const { data: photos } = await supabase
    .from('photos')
    .select('*, school:schools(school_name, slug, primary_color)')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(48)

  const featuredPhoto = photos?.find(p => p.featured) || photos?.[0]
  const gridPhotos = photos?.filter(p => p.id !== featuredPhoto?.id) || []

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Camera size={24} className="text-ice" />
            <div>
              <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                Photo Gallery
              </h1>
              <p className="text-slate-500 text-sm">Section X sports photography</p>
            </div>
          </div>
          <Link href="/submit-photo" className="btn-primary flex items-center gap-2">
            <Camera size={16} /> Submit a Photo
          </Link>
        </div>

        {/* Featured */}
        {featuredPhoto && (
          <div className="rounded-2xl overflow-hidden mb-6 relative cursor-pointer group">
            <img src={featuredPhoto.photo_url} alt={featuredPhoto.caption || 'Featured photo'}
              className="w-full aspect-video md:aspect-[21/8] object-cover group-hover:scale-[1.01] transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <span className="inline-flex items-center gap-1 text-xs font-black text-yellow-400 uppercase tracking-widest mb-2"
                style={{ fontFamily: 'var(--font-display)' }}>⭐ Featured</span>
              {featuredPhoto.caption && (
                <p className="text-white font-bold text-lg leading-tight">{featuredPhoto.caption}</p>
              )}
              <p className="text-white/50 text-xs mt-1">
                📷 {featuredPhoto.photographer_credit_name || featuredPhoto.submitter_name}
              </p>
            </div>
          </div>
        )}

        {/* Grid with lightbox */}
        {gridPhotos.length === 0 && !featuredPhoto ? (
          <div className="rounded-2xl p-16 text-center border border-white/6" style={{ background: 'rgba(8,12,20,0.7)' }}>
            <Camera size={48} className="mx-auto mb-4 text-slate-700" />
            <p className="text-slate-400 text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>No Photos Yet</p>
            <p className="text-slate-600 text-sm mt-1 mb-4">Be the first to submit a photo!</p>
            <Link href="/submit-photo" className="btn-primary inline-flex">Submit a Photo</Link>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-600 mb-3 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
              {gridPhotos.length} photo{gridPhotos.length !== 1 ? 's' : ''} · Click to expand
            </p>
            <PhotoGalleryGrid photos={gridPhotos} />
          </>
        )}
      </div>
    </PublicLayout>
  )
}
