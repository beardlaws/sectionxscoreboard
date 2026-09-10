import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic='force-dynamic'

function getDb(){const {env}=getCloudflareContext();const db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

export async function GET(req:NextRequest){
  try{
    const filter=req.nextUrl.searchParams.get('filter')||'pending'
    const where=filter==='approved'?'WHERE sh.approved=1':filter==='all'?'':'WHERE sh.approved=0'
    const {results}=await getDb().prepare(`SELECT sh.*,s.school_name FROM shoutouts sh LEFT JOIN schools s ON s.id=sh.school_id ${where} ORDER BY sh.created_at DESC`).all()
    const shoutouts=(results||[]).map((s:any)=>({...s,approved:Boolean(s.approved),featured:Boolean(s.featured),school:s.school_id?{school_name:s.school_name}:null}))
    return NextResponse.json({ok:true,shoutouts})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not load shoutouts'},{status:500})}
}

export async function PATCH(req:NextRequest){
  try{
    const body=await req.json().catch(()=>null),id=String(body?.id||'').trim()
    if(!id)return NextResponse.json({ok:false,error:'id required'},{status:400})
    const sets:string[]=[],values:any[]=[]
    if(typeof body.approved==='boolean'){sets.push('approved=?');values.push(body.approved?1:0)}
    if(typeof body.featured==='boolean'){sets.push('featured=?');values.push(body.featured?1:0)}
    if(!sets.length)return NextResponse.json({ok:false,error:'No supported fields supplied'},{status:400})
    await getDb().prepare(`UPDATE shoutouts SET ${sets.join(',')} WHERE id=?`).bind(...values,id).run()
    return NextResponse.json({ok:true})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not update shoutout'},{status:500})}
}

export async function DELETE(req:NextRequest){
  try{
    const body=await req.json().catch(()=>null),id=String(body?.id||'').trim()
    if(!id)return NextResponse.json({ok:false,error:'id required'},{status:400})
    await getDb().prepare('DELETE FROM shoutouts WHERE id=?').bind(id).run()
    return NextResponse.json({ok:true})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not delete shoutout'},{status:500})}
}
