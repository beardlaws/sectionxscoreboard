import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif'])

function clean(v: FormDataEntryValue | null, max=500) {
  return typeof v === 'string' ? v.trim().slice(0,max) : ''
}

function safeExt(file: File) {
  const raw = file.name.split('.').pop()?.toLowerCase() || ''
  if (/^[a-z0-9]{2,5}$/.test(raw)) return raw
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/heic') return 'heic'
  if (file.type === 'image/heif') return 'heif'
  return 'jpg'
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ok:false,error:'Choose an image to upload.'},{status:400})
    if (!ALLOWED.has(file.type)) return Response.json({ok:false,error:'Unsupported image type.'},{status:400})
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) return Response.json({ok:false,error:'Image must be 15 MB or smaller.'},{status:400})

    const submitterName = clean(form.get('submitter_name'),120) || 'Anonymous'
    const submitterEmail = clean(form.get('submitter_email'),200) || null
    const photographer = clean(form.get('photographer_credit_name'),160)
    const schoolId = clean(form.get('school_id'),80) || null
    const teamId = clean(form.get('team_id'),80) || null
    const gameId = clean(form.get('game_id'),80) || null
    const sportId = clean(form.get('sport_id'),80) || null
    const caption = clean(form.get('caption'),600) || null
    const permission = clean(form.get('permission_confirmed'),10) === 'true'
    const tagsRaw = clean(form.get('athlete_ids'),5000)
    const athleteIds = tagsRaw ? [...new Set(tagsRaw.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,25) : []

    if (!photographer || !permission) return Response.json({ok:false,error:'Photographer credit and permission confirmation are required.'},{status:400})
    if (submitterEmail && !/^\S+@\S+\.\S+$/.test(submitterEmail)) return Response.json({ok:false,error:'Please enter a valid email address.'},{status:400})

    const { env } = getCloudflareContext()
    const db = (env as any).DB
    const bucket = (env as any).PHOTOS
    if (!db) throw new Error('D1 binding DB is unavailable')
    if (!bucket) throw new Error('R2 binding PHOTOS is unavailable')

    let resolvedTeamId = teamId
    if (!resolvedTeamId && gameId && schoolId) {
      const g:any = await db.prepare(`SELECT g.home_team_id,g.away_team_id,ht.school_id AS home_school_id,at.school_id AS away_school_id FROM games g LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN teams at ON at.id=g.away_team_id WHERE g.id=? LIMIT 1`).bind(gameId).first()
      if (g) {
        if (g.home_school_id === schoolId) resolvedTeamId = g.home_team_id
        else if (g.away_school_id === schoolId) resolvedTeamId = g.away_team_id
      }
    }

    const id = crypto.randomUUID()
    const key = `submissions/${new Date().toISOString().slice(0,10)}/${id}.${safeExt(file)}`
    const bytes = await file.arrayBuffer()
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { originalName: file.name.slice(0,180), photoId: id }
    })

    const photoUrl = `/media/photos/${key}`
    try {
      await db.prepare(`INSERT INTO photos (
        id,submitter_name,submitter_email,photographer_credit_name,school_id,team_id,game_id,sport_id,
        caption,photo_url,permission_confirmed,approved,featured,storage_provider,storage_key,mime_type,file_size_bytes,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,1,0,0,'r2',?,?,?,datetime('now'))`).bind(
        id,submitterName,submitterEmail,photographer,schoolId,resolvedTeamId,gameId,sportId,caption,photoUrl,key,file.type,file.size
      ).run()

      if (athleteIds.length && gameId) {
        const stmts = athleteIds.map(athleteId => db.prepare(`INSERT INTO photo_tag_suggestions (id,photo_id,athlete_id,source_type,status,created_at) VALUES (?,?,?,'public','pending',datetime('now'))`).bind(crypto.randomUUID(),id,athleteId))
        if (stmts.length) await db.batch(stmts)
      }
    } catch (error) {
      await bucket.delete(key).catch(()=>{})
      throw error
    }

    return Response.json({ok:true,id,photo_url:photoUrl},{status:201})
  } catch (error) {
    console.error('[photos/upload]',error)
    return Response.json({ok:false,error:'Photo upload failed. Please try again.'},{status:500})
  }
}
