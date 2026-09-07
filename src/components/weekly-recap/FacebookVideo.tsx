'use client'

export default function FacebookVideo({ src, title }: { src: string; title: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
      <iframe src={src} title={title} className="absolute inset-0 h-full w-full" style={{ border: 0 }} scrolling="no" frameBorder="0" allowFullScreen allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" />
    </div>
  )
}
