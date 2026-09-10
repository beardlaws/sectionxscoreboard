import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return Response.json({ ok:false, error:'Invalid request.' }, { status:400 })

    const businessName = clean((body as any).business_name, 160)
    const contactName = clean((body as any).contact_name, 120)
    const email = clean((body as any).email, 200)
    const phone = clean((body as any).phone, 80)
    const packageInterest = clean((body as any).package_interest, 120)
    const schoolInterest = clean((body as any).school_interest, 160)
    const sportInterest = clean((body as any).sport_interest, 120)
    const message = clean((body as any).message, 1800)

    if (!businessName || !contactName || !email) {
      return Response.json({ ok:false, error:'Business name, contact name, and email are required.' }, { status:400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return Response.json({ ok:false, error:'Please enter a valid email address.' }, { status:400 })
    }

    const { env } = getCloudflareContext()
    const db = (env as any).DB
    if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

    const id = crypto.randomUUID()
    await db.prepare(`INSERT INTO advertise_inquiries (
      id,business_name,contact_name,email,phone,package_interest,school_interest,sport_interest,message,reviewed,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,0,datetime('now'))`).bind(
      id,businessName,contactName,email,phone||null,packageInterest||null,schoolInterest||null,sportInterest||null,message||null
    ).run()

    return Response.json({ ok:true, id }, { status:201 })
  } catch (error) {
    console.error('[advertise-inquiry]', error)
    return Response.json({ ok:false, error:'Could not send inquiry. Please try again.' }, { status:500 })
  }
}
