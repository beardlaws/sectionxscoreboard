import { NextRequest } from 'next/server'
import { contributorAccountFromRequest } from '@/lib/contributor-auth-cloudflare'

export async function getContributorUser(req:NextRequest){
 const account=await contributorAccountFromRequest(req)
 if(!account)return null
 return {id:account.id,email:account.email,user_metadata:{display_name:account.display_name}}
}
