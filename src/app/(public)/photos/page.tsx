import { createClient } from '@/lib/supabase/server';
import { Metadata } from 'next';
import Link from 'next/link';
import { Camera } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Photos | Section X Scoreboard',
  description: 'Section X high school sports photos. Submit your photos from the North Country.',
};

interface SearchParams {
  sport?: string;
  school?: string;
}

export default async function PhotosPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();

  let query = supabase
    .from('photos')
    .select('*, school:schools(school_name, slug, primary_color), sport:sports(sport_name, slug), game:games(id, game_date)')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(48);

  if (searchParams.sport) {
    const { data: sport } = await supabase.from('sports').select('id').eq('slug', searchParams.sport).single();
    if (sport) query = query.eq('sport_id', sport.id);
  }
  if (searchParams.school) {
    const { data: school } = await supabase.from('schools').select('id').eq('slug', searchParams.school).single();
    if (school) query = query.eq('school_id', school.id);
  }

  const { data: photos } = await query;
  const featuredPhoto = photos?.find(p => p.featured) || photos?.[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Camera size={24} className="text-ice" />
          <h1 className="text-2xl font-bold font-display text-white">Photos</h1>
        </div>
        <Link href="/submit-photo" className="btn-primary flex items-center gap-2">
          <Camera size={16} /> Submit a Photo
        </Link>
      </div>

      {/* Featured */}
      {featuredPhoto && (
        <div className="card overflow-hidden mb-6">
          <div className="relative aspect-video md:aspect-[21/9]">
            <img
              src={featuredPhoto.photo_url}
              alt={featuredPhoto.caption || 'Featured photo'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="badge badge-live text-xs mb-2">⭐ Featured</span>
              {featuredPhoto.caption && (
                <p className="text-white font-medium">{featuredPhoto.caption}</p>
              )}
              <p className="text-white/60 text-xs mt-1">
                📸 {featuredPhoto.photographer_credit_name || featuredPhoto.submitter_name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {(!photos || photos.length === 0) ? (
        <div className="card p-16 text-center text-slate-400">
          <Camera size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-2">No photos yet</p>
          <p className="text-sm mb-4">Be the first to submit a photo from the field!</p>
          <Link href="/submit-photo" className="btn-primary inline-flex">Submit a Photo</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.filter(p => !p.featured || p.id !== featuredPhoto?.id).map(photo => (
            <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden bg-white/5 cursor-pointer">
              <img
                src={photo.photo_url}
                alt={photo.caption || 'Sports photo'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  {photo.caption && <p className="text-white text-xs font-medium truncate">{photo.caption}</p>}
                  <p className="text-white/60 text-xs">
                    📸 {photo.photographer_credit_name || photo.submitter_name}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
