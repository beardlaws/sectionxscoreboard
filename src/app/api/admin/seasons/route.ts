import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic='force-dynamic'

function db(){const {env}=getCloudflareContext();const d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}
function clean(v:any,n=160){return String(v??'').trim().slice(0,n)}

export async function GET(){
  try{
    const {results}=await db().prepare('SELECT * FROM seasons ORDER BY year DESC, created_at DESC').all()
    return NextResponse.json({ok:true,seasons:(results||[]).map((s:any)=>({...s,is_active:Boolean(s.is_active)}))})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not load seasons'},{status:500})}
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json().catch(()=>null)
    const name=clean(body?.name,120),seasonType=clean(body?.season_type,20),year=Number(body?.year)
    if(!name||!Number.isInteger(year)||year<2000||year>2100||!['Fall','Winter','Spring'].includes(seasonType))return NextResponse.json({ok:false,error:'Valid name, year, and season type are required.'},{status:400})
    const id=crypto.randomUUID(),start=clean(body?.start_date,10)||null,end=clean(body?.end_date,10)||null
    await db().prepare("INSERT INTO seasons (id,name,year,season_type,is_active,start_date,end_date,created_at) VALUES (?,?,?,?,0,?,?,datetime('now'))").bind(id,name,year,seasonType,start,end).run()
    return NextResponse.json({ok:true,id},{status:201})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not create season'},{status:500})}
}

export async function PATCH(req:NextRequest){
  try{
    const body=await req.json().catch(()=>null),id=clean(body?.id,80)
    if(!id)return NextResponse.json({ok:false,error:'id required'},{status:400})
    if(body?.action==='set-active'){
      const d=db(),exists=await d.prepare('SELECT id FROM seasons WHERE id=?').bind(id).first()
      if(!exists)return NextResponse.json({ok:false,error:'Season not found'},{status:404})
      await d.batch([
        d.prepare('UPDATE seasons SET is_active=0 WHERE is_active=1'),
        d.prepare('UPDATE seasons SET is_active=1 WHERE id=?').bind(id),
      ])
      return NextResponse.json({ok:true})
    }
    return NextResponse.json({ok:false,error:'Unsupported action'},{status:400})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not update season'},{status:500})}
}
