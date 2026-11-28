/**
 * Íconos propios de la cámara de frío: termómetro de aire, gota de humedad y
 * refrigerador (puerta cerrada / abierta). Dibujados para ColdCare, en dos
 * tonos: trazo pleno y relleno suave del mismo color (`currentColor`), así
 * heredan el color de la magnitud sin baldosas de fondo.
 */
type PropsIcono = { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }

function Base({ children, className, ...resto }: PropsIcono & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={resto['aria-hidden'] ?? true}
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** Termómetro con su escala: temperatura del aire. */
export function IconoAire(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M9.5 4.75a2.5 2.5 0 0 1 5 0v8.6a4.25 4.25 0 1 1-5 0Z" fill="currentColor" fillOpacity={0.16} />
      <path d="M12 16.25V9" />
      <circle cx="12" cy="16.9" r="1.7" fill="currentColor" stroke="none" />
      <path d="M17.5 5.5h2M17.5 8.5h1.25M17.5 11.5h2" strokeOpacity={0.55} />
    </Base>
  )
}

/** Gota con brillo: humedad relativa. */
export function IconoHumedad(props: PropsIcono) {
  return (
    <Base {...props}>
      <path d="M12 3.25c3.6 4.3 6 7.6 6 10.6a6 6 0 0 1-12 0c0-3 2.4-6.3 6-10.6Z" fill="currentColor" fillOpacity={0.16} />
      <path d="M9.1 14.2a3 3 0 0 0 2.7 2.9" strokeOpacity={0.7} />
    </Base>
  )
}

/** Refrigerador cerrado: congelador arriba, tiradores a la izquierda. */
export function IconoPuertaCerrada(props: PropsIcono) {
  return (
    <Base {...props}>
      <rect x="5.75" y="2.75" width="12.5" height="18.5" rx="2.5" fill="currentColor" fillOpacity={0.16} />
      <path d="M5.75 9.25h12.5" />
      <path d="M8.75 5.25v1.75M8.75 12v3.5" />
    </Base>
  )
}

/** Refrigerador con la puerta abierta en perspectiva. */
export function IconoPuertaAbierta(props: PropsIcono) {
  return (
    <Base {...props}>
      <rect x="3.75" y="2.75" width="10.5" height="18.5" rx="2" fill="currentColor" fillOpacity={0.16} />
      <path d="M3.75 9.25h10.5" strokeOpacity={0.6} />
      <path d="M14.25 3.25 20 5.4v13.2l-5.75 2.15" />
      <path d="M17.4 10.25v3.5" />
    </Base>
  )
}
