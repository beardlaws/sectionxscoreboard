'use client'
import FollowButton from '@/components/FollowButton'
export default function GameCenterFanBar({away,home}:{away?:{id:string;name:string}|null;home?:{id:string;name:string}|null}){if(!away&&!home)return null;return <div className="mt-3 flex flex-wrap justify-center gap-2">{away&&<FollowButton targetType="team" targetId={away.id} targetName={away.name} compact/>}{home&&<FollowButton targetType="team" targetId={home.id} targetName={home.name} compact/>}</div>}
