import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getDb(){
  const { env }=getCloudflareContext()
  const db=(env as any).DB
  if(!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

export async function GET(req:NextRequest){
  try{
    const filter=req.nextUrl.searchParams.get('filter')||'pending'
    const db=getDb()
    const where=filter==='approved'?'WHERE p.approved=1':filter==='all'?'':'WHERE p.approved=0'
    const {results}=await db.prepare(`
      SELECT p.*,s.school_name,s.primary_color,sp.sport_name
      FROM photos p
      LEFT JOIN schools s ON s.id=p.school_id
      LEFT JOIN sports sp ON sp.id=p.sport_id
      ${where}
      ORDER BY p.created_at DESC
    `).all()
    const photos=(results||[]).map((p:any)=>({
      ...p,
      approved:Boolean(p.approved),
      featured:Boolean(p.featured),
      permission_confirmed:Boolean(p.permission_confirmed),
      tag_reviewed:Boolean(p.tag_reviewed),
      school:p.school_id?{school_name:p.school_name,primary_color:p.primary_color}:null,
      sport:p.sport_id?{sport_name:p.sport_name}:null,
    }))
    return NextResponse.json({ok:true,photos})
  }catch(e:any){
    return NextResponse.json({ok:false,error:e?.message||'Could not load photos'},{status:500})
  }
}

export async function PATCH(req:NextRequest){
  try{
    const body=await req.json()
    const id=String(body?.id||'').trim()
    if(!id)return NextResponse.json({ok:false,error:'id required'},{status:400})
    const sets:string[]=[],values:any[]=[]
    if(typeof body.approved==='boolean'){sets.push('approved=?');values.push(body.approved?1:0)}
    if(typeof body.featured==='boolean'){sets.push('featured=?');values.push(body.featured?1:0)}
    if(typeof body.tag_reviewed==='boolean'){sets.push('tag_reviewed=?');values.push(body.tag_reviewed?1:0)}
    if(!sets.length)return NextResponse.json({ok:false,error:'No supported fields supplied'},{status:400})
    const db=getDb()
    await db.prepare(`UPDATE photos SET ${sets.join(',')} WHERE id=?`).bind(...values,id).run()
    return NextResponse.json({ok:true})
  }catch(e:any){
    return NextResponse.json({ok:false,error:e?.message||'Could not update photo'},{status:500})
  }
}
