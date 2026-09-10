import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>null)
  const photoId=String(body?.photoId||'').trim()
  if(!photoId)return NextResponse.json({error:'photoId required'},{status:400})

  try{
    const {env}=getCloudflareContext(),db=(env as any).DB,bucket=(env as any).PHOTOS
    if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
    const photo:any=await db.prepare('SELECT id,photo_url,storage_provider,storage_key FROM photos WHERE id=? LIMIT 1').bind(photoId).first()
    if(!photo)return NextResponse.json({error:'Photo not found'},{status:404})

    if(photo.storage_provider==='r2'&&photo.storage_key){
      if(!bucket)return NextResponse.json({error:'R2 PHOTOS binding is unavailable; photo record was not deleted.'},{status:503})
      await bucket.delete(String(photo.storage_key))
    }

    // Legacy Supabase-hosted files are deliberately left in legacy storage during the
    // rollback window. Removing the D1 record hides them from the Cloudflare site while
    // preserving a recoverable copy until the final storage migration is verified.
    await db.prepare('DELETE FROM photo_tag_suggestions WHERE photo_id=?').bind(photoId).run().catch(()=>null)
    await db.prepare('DELETE FROM photo_athletes WHERE photo_id=?').bind(photoId).run().catch(()=>null)
    await db.prepare('DELETE FROM photos WHERE id=?').bind(photoId).run()
    return NextResponse.json({ok:true,storageDeleted:photo.storage_provider==='r2',legacyStorageRetained:photo.storage_provider!=='r2'})
  }catch(error:any){
    console.error('[admin/photos/delete]',error)
    return NextResponse.json({error:error?.message||'Photo delete failed'},{status:500})
  }
}
