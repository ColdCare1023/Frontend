import { useId } from 'react'

interface ColdCareBrandProps {
  variant?: 'compact' | 'stacked'
  subtitulo?: string
  tone?: 'dark' | 'light'
  className?: string
}

/** ColdCare thermal arc and thermometer mark. */
export function ColdCareBrand({ variant = 'compact', subtitulo, tone = 'dark', className = '' }: ColdCareBrandProps) {
  const stacked = variant === 'stacked'
  const gradientId = `coldcare-thermal-${useId().replace(/:/g, '')}`
  return (
    <div className={`flex ${stacked ? 'flex-col gap-3 text-center' : 'items-center gap-2.5'} ${className}`}>
      <svg aria-hidden="true" className={`${stacked ? 'size-20' : 'size-10'} shrink-0`} viewBox="0 0 48 48" fill="none">
        <defs>
          <linearGradient id={gradientId} x1="3" y1="24" x2="45" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00D1FF" />
            <stop offset="0.52" stopColor="#0B5CFF" />
            <stop offset="1" stopColor="#FF7AA2" />
          </linearGradient>
        </defs>
        <path d="M4.5 34C4.5 17.7 12.5 6.5 24 6.5S43.5 17.7 43.5 34" stroke={`url(#${gradientId})`} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M21 19.5a3 3 0 0 1 6 0v11.3a7.2 7.2 0 1 1-6 0V19.5Z" fill="#FFFFFF" stroke="#0B5CFF" strokeWidth="2.4" />
        <path d="M24 21v15" stroke="#00D1FF" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="24" cy="36.5" r="3.8" fill="#0B5CFF" />
      </svg>
      <div className="min-w-0">
        <p className={`whitespace-nowrap font-sans font-semibold leading-none tracking-[-0.04em] ${stacked ? 'text-4xl' : 'text-lg'} ${tone === 'light' ? 'text-white' : 'text-foreground'}`}>Cold<span className={tone === 'light' ? 'text-secondary' : 'text-marca-texto'}>Care</span></p>
        {subtitulo && <p className={`mt-1.5 text-[11px] leading-4 ${tone === 'light' ? 'text-white/80' : 'text-faint'}`}>{subtitulo}</p>}
      </div>
    </div>
  )
}
