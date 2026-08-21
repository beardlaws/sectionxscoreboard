'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { adminDb } from '@/lib/adminDb';
import { Photo } from '@/types';
import { Check, Star, Trash2, Eye } from 'lucide-react';
import PhotoAthleteTagger from './PhotoAthleteTagger';

export default function AdminPhotosPage() {
  const supabase = createClient();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchPhotos();
  }, [filter]);

  async function fetchPhotos() {
    setLoading(true);
    let query = supabase
      .from('photos')
      .select('*, school:schools(school_name, primary_color), sport:sports(sport_name)')
      .order('created_at', { ascending: false });

    if (filter === 'pending') query = query.eq('approved', false);
    if (filter === 'approved') query = query.eq('approved', true);

    const { data } = await query;
    setPhotos((data as Photo[]) || []);
    setLoading(false);
  }

  async function approvePhoto(id: string) {
    await adminDb.update('photos', { approved: true }, { id });
    fetchPhotos();
  }

  async function deletePhoto(id: string) {
    if (!confirm('Permanently delete this photo and its stored image?')) return;
    setDeleting(id);
    try {
      const res = await fetch('/api/admin/photos/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      setPhotos(prev => prev.filter(photo => photo.id !== id));
    } catch (e: any) {
      alert(e.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  async function featurePhoto(id: string, featured: boolean) {
    await adminDb.update('photos', { featured }, { id });
    fetchPhotos();
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Photo Queue</h1>
          <p className="text-xs text-slate-500 mt-1">Delete removes both the database record and the actual stored image. Game-linked photos can also be tagged to rostered athletes.</p>
        </div>
        <div className="flex gap-2">
          {(['pending', 'approved', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-ice text-navy' : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading photos...</div>
      ) : photos.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">📷</p>
          <p>No {filter === 'all' ? '' : filter} photos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map(photo => (
            <div key={photo.id} className="card overflow-hidden">
              <div className="relative aspect-video bg-white/5">
                <img
                  src={photo.photo_url}
                  alt={photo.caption || 'Submitted photo'}
                  className="w-full h-full object-cover"
                  onError={e => {
                    (e.target as HTMLImageElement).src = '/placeholder-photo.jpg';
                  }}
                />
                {photo.featured && (
                  <span className="absolute top-2 left-2 badge badge-live text-xs">⭐ Featured</span>
                )}
                {photo.approved && (
                  <span className="absolute top-2 right-2 badge bg-green-500/20 text-green-400 border-green-500/30 text-xs">Approved</span>
                )}
              </div>

              <div className="p-4">
                {photo.caption && (
                  <p className="text-sm text-white mb-2 font-medium">{photo.caption}</p>
                )}
                <div className="space-y-1 text-xs text-slate-400 mb-4">
                  <p>📸 {photo.photographer_credit_name || photo.submitter_name}</p>
                  {photo.submitter_email && <p>✉️ {photo.submitter_email}</p>}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {!photo.approved && (
                    <button
                      onClick={() => approvePhoto(photo.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs font-medium transition-colors"
                    >
                      <Check size={12} /> Approve
                    </button>
                  )}
                  <button
                    onClick={() => featurePhoto(photo.id, !photo.featured)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      photo.featured
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        : 'bg-white/10 text-slate-400 hover:bg-white/20'
                    }`}
                  >
                    <Star size={12} /> {photo.featured ? 'Unfeature' : 'Feature'}
                  </button>
                  <button
                    onClick={() => window.open(photo.photo_url, '_blank')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded text-xs font-medium transition-colors"
                  >
                    <Eye size={12} /> View
                  </button>
                  <button
                    onClick={() => deletePhoto(photo.id)}
                    disabled={deleting === photo.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 rounded text-xs font-medium transition-colors ml-auto"
                  >
                    <Trash2 size={12} /> {deleting === photo.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>

                <PhotoAthleteTagger photoId={photo.id} gameId={(photo as any).game_id || null} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
