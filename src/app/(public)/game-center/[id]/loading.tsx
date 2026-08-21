export default function GameCenterLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5 animate-pulse">
      <div className="h-4 w-56 rounded bg-white/5" />
      <div className="rounded-3xl border border-white/10 overflow-hidden">
        <div className="h-16 bg-white/[0.03] border-b border-white/10" />
        <div className="h-64 bg-white/[0.02]" />
        <div className="grid grid-cols-3 gap-px bg-white/10">
          <div className="h-16 bg-[#0b0f17]" />
          <div className="h-16 bg-[#0b0f17]" />
          <div className="h-16 bg-[#0b0f17]" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-40 rounded-2xl bg-white/[0.03] border border-white/10" />
        <div className="h-40 rounded-2xl bg-white/[0.03] border border-white/10" />
      </div>
    </div>
  )
}
