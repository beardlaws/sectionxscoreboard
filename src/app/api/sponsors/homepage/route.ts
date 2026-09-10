import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

export const dynamic='force-dynamic'

export async function GET(){
  try{
    const {env}=getCloudflareContext(),db=(env as any).DB
    if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
    const today=new Date().toISOString().slice(0,10)
    const {results}=await db.prepare(`
      SELECT * FROM sponsors
      WHERE active=1
        AND placement_type='homepage'
        AND (start_date IS NULL OR start_date='' OR start_date<=?)
        AND (end_date IS NULL OR end_date='' OR end_date>=?)
      ORDER BY created_at DESC
    `).bind(today,today).all()
    const sponsors=(results||[]).map((s:any)=>({...s,active:Boolean(s.active),show_on_scores:Boolean(s.show_on_scores)}))
    return NextResponse.json({ok:true,sponsors})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not load sponsors'},{status:500})}
}
