import { useId } from 'react'

interface ColdCareBrandProps {
  variant?: 'compact' | 'stacked'
  subtitulo?: string
  tone?: 'dark' | 'light'
  className?: string
}

/** ColdCare wordmark and thermometer mark for app navigation and sign-in. */
export function ColdCareBrand({
  variant = 'compact',
  subtitulo,
  tone = 'dark',
  className = '',
}: ColdCareBrandProps) {
  const gradientId = `coldcare-${useId().replace(/:/g, '')}`
  const stacked = variant === 'stacked'
  const wordmarkColor = tone === 'light' ? 'text-white' : 'text-[#0F172A]'

  return (
    <div className={`flex ${stacked ? 'flex-col gap-3 text-center' : 'items-center gap-2.5'} ${className}`}>
      <svg
        aria-hidden="true"
        className={`${stacked ? 'size-32' : 'size-9'} shrink-0`}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="7" y1="34" x2="57" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00D1FF" />
            <stop offset="0.52" stopColor="#0B5CFF" />
            <stop offset="1" stopColor="#FF7AA2" />
          </linearGradient>
        </defs>
        <path
          d="M9 40C9 23.4 19.3 10 32 10s23 13.4 23 30"
          stroke={`url(#${gradientId})`}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M32 15.5a8 8 0 0 0-8 8v15.2a12 12 0 1 0 16 0V23.5a8 8 0 0 0-8-8Z"
          fill="white"
          stroke={`url(#${gradientId})`}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M32 24v23" stroke={`url(#${gradientId})`} strokeWidth="4" strokeLinecap="round" />
        <circle cx="32" cy="49" r="6.5" fill="#0B5CFF" />
      </svg>
      <div className={stacked ? 'space-y-2' : 'min-w-0'}>
        <p
          className={`whitespace-nowrap font-sans font-bold leading-none tracking-tight ${stacked ? 'text-5xl' : 'text-[17px]'} ${wordmarkColor}`}
        >
          Cold<span className={tone === 'light' ? 'text-[#00D1FF]' : 'text-[#0B5CFF]'}>Care</span>
        </p>
        {subtitulo && (
          <p className={`text-xs ${tone === 'light' ? 'text-white' : 'text-faint'}`}>
            {subtitulo}
          </p>
        )}
      </div>
    </div>
  )
}
