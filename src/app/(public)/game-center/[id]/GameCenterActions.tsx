'use client'
import { useEffect,useState } from 'react'
import { useRouter } from 'next/navigation'
import { Share2,Check,Radio } from 'lucide-react'
import CorrectionForm from '../../games/[id]/CorrectionForm'
import FollowButton from '@/components/FollowButton'

type TeamTarget={id:string;name:string}|null
export default function GameCenterActions({gameId,shareTitle,isLive=false,awayTeam=null,homeTeam=null}:{gameId:string;shareTitle:string;isLive?:boolean;awayTeam?:TeamTarget;homeTeam?:TeamTarget}){
 const[copied,setCopied]=useState(false),router=useRouter()
 useEffect(()=>{if(!isLive)return;const timer=window.setInterval(()=>{if(document.visibilityState==='visible')router.refresh()},20000);return()=>window.clearInterval(timer)},[isLive,router])
 async function shareGame(){const url=window.location.href;try{if(navigator.share){await navigator.share({title:shareTitle,url});return}await navigator.clipboard.writeText(url);setCopied(true);window.setTimeout(()=>setCopied(false),1800)}catch{}}
 return <div className="flex flex-wrap items-center justify-center gap-3">{isLive&&<div className="inline-flex items-center gap-2 rounded-xl border border-yellow-300/20 bg-yellow-300/[.06] px-3 py-2 text-[10px] font-black uppercase tracking-[.14em] text-yellow-200"><Radio size={13} className="animate-pulse"/> Live updates on · refreshes every 20s</div>}{awayTeam&&<FollowButton targetType="team" targetId={awayTeam.id} targetName={awayTeam.name} compact/>}{homeTeam&&<FollowButton targetType="team" targetId={homeTeam.id} targetName={homeTeam.name} compact/>}<button type="button" onClick={shareGame} className="inline-flex items-center gap-2 rounded-xl bg-yellow-300 px-4 py-2.5 text-xs font-black text-black hover:bg-yellow-200">{copied?<Check size={15}/>:<Share2 size={15}/>} {copied?'Link copied':'Share game'}</button><CorrectionForm gameId={gameId}/></div>
}
