import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'

function getDb(){
  const {env}=getCloudflareContext()
  const db=(env as any).DB
  if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

function clean(value:unknown,max:number){return String(value||'').trim().slice(0,max)}

export async function POST(request:Request){
  try{
    const body=await request.json().catch(()=>null)
    if(!body)return Response.json({ok:false,error:'Invalid request.'},{status:400})
    const gameId=clean((body as any).gameId,80)
    const text=clean((body as any).correctionText,1500)
    const name=clean((body as any).submitterName,120)
    const email=clean((body as any).submitterEmail,200).toLowerCase()
    if(!gameId||!text)return Response.json({ok:false,error:'Game and correction details are required.'},{status:400})
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return Response.json({ok:false,error:'Enter a valid email address.'},{status:400})

    const db=getDb()
    const game=await db.prepare('SELECT id FROM games WHERE id=? LIMIT 1').bind(gameId).first()
    if(!game)return Response.json({ok:false,error:'Game not found.'},{status:404})
    const id=crypto.randomUUID()
    await db.prepare(`INSERT INTO correction_requests (id,game_id,submitter_name,submitter_email,correction_text,status,created_at) VALUES (?,?,?,?,?,'pending',datetime('now'))`)
      .bind(id,gameId,name||null,email||null,text).run()
    return Response.json({ok:true,id},{status:201})
  }catch(error){
    console.error('[corrections]',error)
    return Response.json({ok:false,error:'Could not submit correction.'},{status:500})
  }
}
