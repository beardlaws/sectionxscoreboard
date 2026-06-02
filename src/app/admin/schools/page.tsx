'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Upload, Save, X, Check } from 'lucide-react'

const supabase = createClient()

export default function AdminSchoolsPage() {
  const [schools, setSchools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('schools')
      .select('*').order('school_name')
    setSchools(data || [])
    setLoading(false)
  }

  async function uploadLogo(schoolId: string, file: File) {
    setUploading(schoolId)
    try {
      // Resize/optimize the file name
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const slug = schools.find(s => s.id === schoolId)?.slug || schoolId
      const path = `schools/${slug}.${ext}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        alert('Upload failed: ' + uploadError.message)
        setUploading(null)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const logoUrl = urlData.publicUrl

      // Save to school record
      const { error: dbError } = await supabase.from('schools')
        .update({ logo_url: logoUrl }).eq('id', schoolId)

      if (dbError) {
        alert('DB update failed: ' + dbError.message)
      } else {
        setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, logo_url: logoUrl } : s))
        setMsg('Logo uploaded!')
        setTimeout(() => setMsg(''), 3000)
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
    setUploading(null)
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase.from('schools')
      .update({
        school_name: editForm.school_name,
        primary_color: editForm.primary_color,
        secondary_color: editForm.secondary_color,
        alias: editForm.alias,
        city: editForm.city,
      })
      .eq('id', editingId)
    if (error) alert(error.message)
    else {
      setSchools(prev => prev.map(s => s.id === editingId ? { ...s, ...editForm } : s))
      setEditingId(null)
      setMsg('Saved!')
      setTimeout(() => setMsg(''), 3000)
    }
    setSaving(false)
  }

  return (
    <AdminLayout>
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Schools</h1>
          {msg && <span className="text-sm text-green-400 flex items-center gap-1"><Check size={14} />{msg}</span>}
        </div>
        <p className="text-slate-400 text-sm mb-5">
          Upload logos and update school colors. Logos appear on standings, scores, and team pages.
        </p>

        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : (
          <div className="space-y-2">
            {schools.map(school => {
              const isEditing = editingId === school.id
              const isUploading = uploading === school.id

              return (
                <div key={school.id} className="card overflow-hidden">
                  {/* Main row */}
                  <div className="flex items-center gap-4 p-4">
                    {/* Logo */}
                    <div className="flex-shrink-0 relative group">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden border border-white/10"
                        style={{ background: school.primary_color || '#1e3a5f' }}>
                        {school.logo_url ? (
                          <img src={school.logo_url} alt={school.school_name}
                            className="w-full h-full object-contain p-1" />
                        ) : (
                          <span className="text-white/40 text-xs font-black text-center px-1"
                            style={{ fontFamily: 'var(--font-display)', fontSize: '10px' }}>
                            {school.school_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 3)}
                          </span>
                        )}
                      </div>
                      {/* Upload overlay */}
                      <button
                        onClick={() => {
                          const input = document.createElement('input')
                          input.type = 'file'
                          input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml'
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0]
                            if (file) uploadLogo(school.id, file)
                          }
                          input.click()
                        }}
                        disabled={isUploading}
                        className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.7)' }}
                        title="Upload logo"
                      >
                        {isUploading
                          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <Upload size={16} className="text-white" />
                        }
                      </button>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate" style={{ fontFamily: 'var(--font-display)' }}>
                        {school.school_name}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full border border-white/20"
                            style={{ background: school.primary_color || '#334155' }} />
                          <span className="text-xs text-slate-500">{school.primary_color || 'No color'}</span>
                        </div>
                        {school.secondary_color && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full border border-white/20"
                              style={{ background: school.secondary_color }} />
                            <span className="text-xs text-slate-500">{school.secondary_color}</span>
                          </div>
                        )}
                        {school.logo_url && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <Check size={10} /> Logo
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          if (isEditing) { setEditingId(null); return }
                          setEditingId(school.id)
                          setEditForm({
                            school_name: school.school_name,
                            primary_color: school.primary_color || '',
                            secondary_color: school.secondary_color || '',
                            alias: school.alias || '',
                            city: school.city || '',
                                          })
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${isEditing ? 'bg-white/10 text-slate-300' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'}`}
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {isEditing ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                  </div>

                  {/* Edit panel */}
                  {isEditing && (
                    <div className="border-t border-white/8 p-4 space-y-3"
                      style={{ background: 'rgba(10,15,28,0.8)' }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="label">School Name</label>
                          <input className="input w-full" value={editForm.school_name}
                            onChange={e => setEditForm((p: any) => ({ ...p, school_name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Alias (for import matching)</label>
                          <input className="input w-full" placeholder="e.g. SLC, H-D"
                            value={editForm.alias}
                            onChange={e => setEditForm((p: any) => ({ ...p, alias: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Primary Color</label>
                          <div className="flex gap-2">
                            <input type="color" value={editForm.primary_color || '#1e3a5f'}
                              onChange={e => setEditForm((p: any) => ({ ...p, primary_color: e.target.value }))}
                              className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
                            <input className="input flex-1" placeholder="#1e3a5f"
                              value={editForm.primary_color}
                              onChange={e => setEditForm((p: any) => ({ ...p, primary_color: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <label className="label">Secondary Color</label>
                          <div className="flex gap-2">
                            <input type="color" value={editForm.secondary_color || '#ffffff'}
                              onChange={e => setEditForm((p: any) => ({ ...p, secondary_color: e.target.value }))}
                              className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
                            <input className="input flex-1" placeholder="#ffffff"
                              value={editForm.secondary_color}
                              onChange={e => setEditForm((p: any) => ({ ...p, secondary_color: e.target.value }))} />
                          </div>
                        </div>
                      </div>

                      {/* Logo upload area */}
                      <div>
                        <label className="label mb-2">Logo</label>
                        <div className="flex items-center gap-4">
                          {school.logo_url && (
                            <div className="w-16 h-16 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden"
                              style={{ background: editForm.primary_color || '#1e3a5f' }}>
                              <img src={school.logo_url} alt="" className="w-full h-full object-contain p-1" />
                            </div>
                          )}
                          <div>
                            <button
                              onClick={() => {
                                const input = document.createElement('input')
                                input.type = 'file'
                                input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml'
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0]
                                  if (file) uploadLogo(school.id, file)
                                }
                                input.click()
                              }}
                              disabled={isUploading}
                              className="btn-secondary flex items-center gap-2 text-sm"
                            >
                              <Upload size={14} />
                              {isUploading ? 'Uploading...' : school.logo_url ? 'Replace Logo' : 'Upload Logo'}
                            </button>
                            <p className="text-xs text-slate-600 mt-1">PNG, JPG, WebP, or SVG · Max 2MB</p>
                            <p className="text-xs text-slate-600">Best: PNG with transparent background, square</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-1">
                        <button onClick={() => setEditingId(null)} className="btn-ghost">Cancel</button>
                        <button onClick={saveEdit} disabled={saving} className="btn-primary flex items-center gap-2">
                          <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
