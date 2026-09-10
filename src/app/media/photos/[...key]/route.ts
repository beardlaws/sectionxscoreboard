import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ key: string[] }> }

export async function GET(_request: Request, { params }: Props) {
  const { key } = await params
  const storageKey = (key || []).join('/')
  if (!storageKey || storageKey.includes('..')) return new Response('Not found',{status:404})

  const { env } = getCloudflareContext()
  const bucket = (env as any).PHOTOS
  if (!bucket) return new Response('Storage unavailable',{status:503})
  const object = await bucket.get(storageKey)
  if (!object) return new Response('Not found',{status:404})

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable')
  headers.set('x-content-type-options','nosniff')
  return new Response(object.body,{headers})
}
