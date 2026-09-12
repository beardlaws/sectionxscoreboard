import { NextRequest,NextResponse } from 'next/server'
import { contributorAccountFromRequest,contributorDb,createSession,clearSession,createVerificationCode,consumeVerificationCode,findAccountByEmail,hashPassword,normalizeEmail,sendVerificationEmail,verifyPassword } from '@/lib/contributor-auth-cloudflare'

export const dynamic='force-dynamic'
function parseRoles(v:any){if(Array.isArray(v))return v;if(typeof v==='string'){try{const x=JSON.parse(v);return Array.isArray(x)?x:[]}catch{return[]}}return[]}

async function verifiedFallback(db:any,accountId:string,message:string){
 const now=new Date().toISOString()
 await db.prepare('UPDATE contributor_auth_accounts SET verified_at=COALESCE(verified_at,?),updated_at=? WHERE id=?').bind(now,now,accountId).run()
 const response=NextResponse.json({ok:true,verificationRequired:false,emailDeliveryFallback:true,message})
 return createSession(accountId,response)
}

export async function GET(req:NextRequest){
 try{const account=await contributorAccountFromRequest(req);if(!account)return NextResponse.json({ok:true,user:null,profile:null});const db=contributorDb(),profile:any=await db.prepare('SELECT * FROM contributor_profiles WHERE user_id=? LIMIT 1').bind(account.id).first();if(profile)profile.roles=parseRoles(profile.roles);return NextResponse.json({ok:true,user:{id:account.id,email:account.email,user_metadata:{display_name:account.display_name}},profile:profile?{...profile,can_submit_photos:Boolean(profile.can_submit_photos),can_tag_photos:Boolean(profile.can_tag_photos),can_submit_scores:Boolean(profile.can_submit_scores),can_live_score:Boolean(profile.can_live_score),can_publish_photos:Boolean(profile.can_publish_photos)}:null})}catch(e:any){return NextResponse.json({error:e?.message||'Could not load contributor account'},{status:500})}
}

export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>({})),action=String(body?.action||'')
 try{
  const db=contributorDb()
  if(action==='register'){
   const email=normalizeEmail(body.email),password=String(body.password||''),displayName=String(body.displayName||'').trim();if(!email||password.length<8||!displayName)return NextResponse.json({error:'Name, valid email, and an 8+ character password are required.'},{status:400});if(await findAccountByEmail(email))return NextResponse.json({error:'An account already exists for this email. Sign in instead.'},{status:409})
   const existingProfile:any=await db.prepare('SELECT id,user_id FROM contributor_profiles WHERE lower(email)=lower(?) LIMIT 1').bind(email).first(),accountId=existingProfile?.user_id||crypto.randomUUID(),{hash,salt}=await hashPassword(password),now=new Date().toISOString();
   await db.prepare('INSERT INTO contributor_auth_accounts (id,email,display_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(accountId,email,displayName,hash,salt,now,now).run()
   try{
    const code=await createVerificationCode(accountId)
    await sendVerificationEmail(email,code)
    return NextResponse.json({ok:true,verificationRequired:true,message:'We sent a 6-digit verification code to your email.'})
   }catch(error){
    console.error('[contributor-auth] verification email failed; keeping account and allowing manual-admin-gated onboarding',error)
    return verifiedFallback(db,accountId,'Your account was created. Continue with your contributor application.')
   }
  }
  if(action==='verify'){
   const email=normalizeEmail(body.email),code=String(body.code||'').trim(),account=await findAccountByEmail(email);if(!account||!await consumeVerificationCode(account.id,code))return NextResponse.json({error:'That verification code is invalid or expired.'},{status:400});const response=NextResponse.json({ok:true});return createSession(account.id,response)
  }
  if(action==='login'){
   const email=normalizeEmail(body.email),password=String(body.password||''),account=await findAccountByEmail(email);if(!account||!await verifyPassword(password,account.password_salt,account.password_hash))return NextResponse.json({error:'Email or password is incorrect.'},{status:401});if(!account.verified_at){
    try{const code=await createVerificationCode(account.id);await sendVerificationEmail(email,code);return NextResponse.json({ok:true,verificationRequired:true,message:'Verify your email before signing in. We sent a new code.'})}
    catch(error){console.error('[contributor-auth] login verification email failed; allowing manual-admin-gated onboarding',error);return verifiedFallback(db,account.id,'Signed in. Continue with your contributor application.')}
   }
   const response=NextResponse.json({ok:true});return createSession(account.id,response)
  }
  if(action==='logout'){return clearSession(req,NextResponse.json({ok:true}))}
  if(action==='apply'){
   const account=await contributorAccountFromRequest(req);if(!account)return NextResponse.json({error:'Sign in first.'},{status:401});const credit=String(body.publicCreditName||'').trim(),roles=Array.isArray(body.roles)?body.roles.map(String).filter(Boolean):[];if(!credit||!roles.length)return NextResponse.json({error:'Public credit name and at least one contributor role are required.'},{status:400});const exists:any=await db.prepare('SELECT id FROM contributor_profiles WHERE user_id=? LIMIT 1').bind(account.id).first();if(exists)return NextResponse.json({error:'A contributor application already exists for this account.'},{status:409});await db.prepare(`INSERT INTO contributor_profiles (id,user_id,display_name,public_credit_name,email,school_id,bio,status,roles,trust_level,can_submit_photos,can_tag_photos,can_submit_scores,can_live_score,can_publish_photos,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending',?,'new',1,0,1,0,0,datetime('now'),datetime('now'))`).bind(crypto.randomUUID(),account.id,account.display_name||credit,credit,account.email,body.schoolId||null,String(body.bio||'').trim()||null,JSON.stringify(roles)).run();return NextResponse.json({ok:true})
  }
  return NextResponse.json({error:'Unsupported contributor auth action.'},{status:400})
 }catch(error:any){console.error('[contributor-auth]',error);return NextResponse.json({error:error?.message||'Could not continue.'},{status:500})}
}
