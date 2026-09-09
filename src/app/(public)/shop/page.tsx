import type { Metadata } from 'next'
import PublicLayout from '@/components/layout/PublicLayout'

export const metadata: Metadata = {
  title: 'SECTION X Shop | Section X Scoreboard',
  description: 'Shop SECTION X Drop 01 hats, tees and crewnecks. Official Section X Scoreboard gear, fulfilled by NNY Shirts.',
}

export const revalidate = 300

const PRODUCTS = [
  {
    slug: 'section-x-the-flip-rope-cap',
    name: 'SECTION X “The Flip” Rope Cap',
    short: 'THE FLIP',
    price: '$34.99',
    href: 'https://nnyshirts.com/product/section-x-the-flip-rope-cap/',
    blurb: 'The statement piece. Upside-down collegiate SECTION X on a clean black rope cap.',
  },
  {
    slug: 'section-x-classic-collegiate-crewneck',
    name: 'SECTION X Classic Collegiate Crewneck',
    short: 'THE CREW',
    price: 'From $44.99',
    href: 'https://nnyshirts.com/product/section-x-classic-collegiate-crewneck/',
    blurb: 'A garment-dyed, old-school collegiate layer built for North Country weather.',
  },
  {
    slug: 'section-x-classic-trucker-hat',
    name: 'SECTION X Classic Trucker Hat',
    short: 'THE CLASSIC',
    price: '$31.99',
    href: 'https://nnyshirts.com/product/section-x-classic-trucker-hat/',
    blurb: 'Traditional game-day style with bold embroidery and the signature gold X.',
  },
  {
    slug: 'section-x-vintage-collegiate-tee',
    name: 'SECTION X Vintage Collegiate Tee',
    short: 'THE TEE',
    price: 'From $27.99',
    href: 'https://nnyshirts.com/product/section-x-vintage-collegiate-tee/',
    blurb: 'Heavyweight, garment-dyed and distressed like a Section X shirt from the 90s.',
  },
]

type StoreProduct = { slug?: string; images?: { src?: string; thumbnail?: string }[] }

async function productImages() {
  try {
    const slugs = PRODUCTS.map(p => p.slug).join(',')
    const res = await fetch(`https://nnyshirts.com/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slugs)}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return new Map<string, string>()
    const data = (await res.json()) as StoreProduct[]
    return new Map(
      data
        .map(p => [String(p.slug || ''), String(p.images?.[0]?.src || p.images?.[0]?.thumbnail || '')] as const)
        .filter(([, src]) => Boolean(src))
    )
  } catch {
    return new Map<string, string>()
  }
}

export default async function ShopPage() {
  const images = await productImages()

  return (
    <PublicLayout>
      <div className="min-h-screen pb-16" style={{background:'radial-gradient(circle at 50% -120px,rgba(250,204,21,.11),transparent 34%),#060910'}}>
        <section className="border-b border-white/[.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
            <div className="text-[10px] font-black uppercase tracking-[.26em] text-yellow-300/80">SECTION X // DROP 01</div>
            <div className="mt-3 grid lg:grid-cols-[1fr_auto] gap-6 lg:items-end">
              <div>
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-[.9] tracking-[-.045em] text-white">REP SECTION X.</h1>
                <p className="mt-4 max-w-2xl text-sm sm:text-base text-white/46">The first official SECTION X collection. Four pieces built for the athletes, families, fans and communities that make North Country sports what they are.</p>
              </div>
              <div className="lg:text-right">
                <div className="inline-flex rounded-full border border-yellow-300/20 bg-yellow-300/[.07] px-4 py-2 text-[10px] font-black uppercase tracking-[.16em] text-yellow-200">Limited Drop 01</div>
              </div>
            </div>
          </div>
        </section>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {PRODUCTS.map(product => {
              const image = images.get(product.slug)
              return (
                <a key={product.slug} href={product.href} target="_blank" rel="noopener noreferrer" className="group overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1" style={{background:'linear-gradient(145deg,rgba(18,24,38,.98),rgba(8,12,20,.98))',border:'1px solid rgba(255,255,255,.08)',boxShadow:'0 18px 50px rgba(0,0,0,.20)'}}>
                  <div className="aspect-square relative overflow-hidden" style={{background:'linear-gradient(145deg,#f7f7f5,#e7e7e3)'}}>
                    {image ? <img src={image} alt={product.name} className="absolute inset-0 h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.03]"/> :
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                        <div className="text-[11px] font-black tracking-[.22em] text-black/35">SECTION</div>
                        <div className="text-7xl font-black leading-none text-yellow-500">X</div>
                        <div className="mt-3 text-[9px] font-black uppercase tracking-[.18em] text-black/35">{product.short}</div>
                      </div>}
                    <div className="absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.16em] text-yellow-300">{product.short}</div>
                  </div>
                  <div className="p-5">
                    <h2 className="text-lg font-black leading-tight text-white">{product.name}</h2>
                    <div className="mt-2 text-sm font-black text-yellow-300">{product.price}</div>
                    <p className="mt-3 text-xs leading-relaxed text-white/38">{product.blurb}</p>
                    <div className="mt-5 inline-flex rounded-xl bg-yellow-300 px-4 py-2.5 text-[10px] font-black text-black transition-colors group-hover:bg-yellow-200">SHOP NOW →</div>
                  </div>
                </a>
              )
            })}
          </div>

          <section className="mt-8 rounded-3xl p-5 sm:p-7" style={{background:'linear-gradient(135deg,rgba(250,204,21,.08),rgba(18,24,38,.96) 55%,rgba(37,99,235,.08))',border:'1px solid rgba(250,204,21,.13)'}}>
            <div className="grid md:grid-cols-3 gap-6">
              <div><div className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-300/75">Made for Section X</div><p className="mt-2 text-sm text-white/46">No school logos. No one-team allegiance. Just Section X.</p></div>
              <div><div className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-300/75">Made to order</div><p className="mt-2 text-sm text-white/46">Each piece is produced after you order so we can keep drops tight and avoid unnecessary inventory.</p></div>
              <div><div className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-300/75">Checkout & fulfillment</div><p className="mt-2 text-sm text-white/46">Products, payment and fulfillment are securely handled through NNY Shirts.</p></div>
            </div>
          </section>
        </main>
      </div>
    </PublicLayout>
  )
}
