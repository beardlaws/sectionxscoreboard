import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic='force-dynamic'

export async function GET(req:NextRequest){
  try{
    const photoId=req.nextUrl.searchParams.get('photoId')
    if(!photoId)return NextResponse.json({error:'photoId required'},{status:400})
    const {env}=getCloudflareContext(),db=(env as any).DB
    if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
    const {results}=await db.prepare("SELECT id,athlete_id,status,source_type,contributor_id,created_at FROM photo_tag_suggestions WHERE photo_id=? AND status='pending' ORDER BY created_at ASC").bind(photoId).all()
    return NextResponse.json({ok:true,suggestions:results||[]})
  }catch(e:any){return NextResponse.json({error:e?.message||'Could not load tag suggestions'},{status:500})}
}
