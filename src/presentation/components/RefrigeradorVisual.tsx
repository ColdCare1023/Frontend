import { useId } from 'react'

/** Original schematic illustration. Shelves are decorative, not inventory data. */
export function RefrigeradorVisual({ puertaAbierta }: { puertaAbierta: boolean | null }) {
  const id = useId().replaceAll(':', '')
  return (
    <svg aria-hidden viewBox="0 0 220 280" fill="none" className="mx-auto h-56 w-full max-w-[220px]">
      <defs>
        <linearGradient id={`${id}-glass`} x1="52" y1="72" x2="171" y2="240" gradientUnits="userSpaceOnUse"><stop stopColor="#E2FBFF" /><stop offset="1" stopColor="#EAF1FF" /></linearGradient>
      </defs>
      <ellipse cx="110" cy="267" rx="73" ry="7" fill="#0F172A" opacity=".05" />
      <path d="M43 252v10M176 252v10" stroke="#73839C" strokeWidth="5" strokeLinecap="round" />
      <rect x="30" y="16" width="162" height="238" rx="15" fill="white" stroke="#BDCADB" strokeWidth="2" />
      <rect x="39" y="25" width="144" height="29" rx="7" fill="#0F172A" />
      <path d="M50 37h17M50 42h17" stroke="#59677C" strokeWidth="2" strokeLinecap="round" />
      <circle cx="170" cy="39" r="3" fill="#00D1FF" />
      <rect x="48" y="68" width="124" height="168" rx="8" fill={`url(#${id}-glass)`} stroke={puertaAbierta ? '#FF7AA2' : '#0B5CFF'} strokeWidth="2" />
      <path d="M59 111h101M59 151h101M59 191h101" stroke="#BDCADB" strokeWidth="2" />
      <path d="M67 88h25v22H67zM109 88h32v22h-32zM72 127h28v23H72zM116 127h25v23h-25zM66 165h31v25H66zM113 165h30v25h-30z" fill="white" stroke="#BDCADB" strokeWidth="1.5" />
      <path d="M71 95h16M113 95h23M76 134h19M120 134h16M70 173h22M117 173h21" stroke="#00D1FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M74 72l-20 72M137 72l-44 160" stroke="white" strokeWidth="7" opacity=".55" />
      <path d="M180 111v44" stroke="#73839C" strokeWidth="4" strokeLinecap="round" />
      <path d="M78 244h67" stroke="#BDCADB" strokeWidth="2" strokeDasharray="3 4" />
      {puertaAbierta && <path d="M48 69L17 82v150l31 5" stroke="#FF7AA2" strokeWidth="2" fill="#FFF0F4" fillOpacity=".65" />}
    </svg>
  )
}
