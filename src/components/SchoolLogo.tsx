// src/components/SchoolLogo.tsx
// Universal school logo component - shows logo if available, falls back to colored initials

interface Props {
  school: {
    school_name?: string
    primary_color?: string
    secondary_color?: string
    logo_url?: string | null
  } | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  xs: { outer: 'w-5 h-5', text: '8px', padding: 'p-0.5' },
  sm: { outer: 'w-7 h-7', text: '9px', padding: 'p-0.5' },
  md: { outer: 'w-10 h-10', text: '10px', padding: 'p-1' },
  lg: { outer: 'w-14 h-14', text: '11px', padding: 'p-1.5' },
  xl: { outer: 'w-20 h-20', text: '13px', padding: 'p-2' },
}

export default function SchoolLogo({ school, size = 'md', className = '' }: Props) {
  const { outer, text, padding } = SIZES[size]
  const color = school?.primary_color || '#1e3a5f'
  const initials = school?.school_name
    ?.split(' ')
    .filter(w => w.length > 2 && !['Central', 'School', 'Free', 'Academy', 'High'].includes(w))
    .map(w => w[0])
    .join('')
    .slice(0, 3) || '?'

  return (
    <div
      className={`${outer} rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 border border-white/10 ${className}`}
      style={{ background: color }}
    >
      {school?.logo_url ? (
        <img
          src={school.logo_url}
          alt={school.school_name || ''}
          className={`w-full h-full object-contain ${padding}`}
          loading="lazy"
          onError={(e) => {
            // If logo fails to load, hide it and show initials
            const target = e.currentTarget
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent) {
              parent.innerHTML = `<span style="color:rgba(255,255,255,0.7);font-size:${text};font-weight:900;font-family:var(--font-display);letter-spacing:0.05em">${initials}</span>`
            }
          }}
        />
      ) : (
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: text, fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
          {initials}
        </span>
      )}
    </div>
  )
}
