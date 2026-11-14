import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { prefiereMovimientoReducido } from '@/presentation/motion/tokens'

export type TonoAnillo = 'exito' | 'aviso' | 'sin-verificar'

const ARCO: Record<TonoAnillo, string> = {
  exito: 'stroke-success-600',
  aviso: 'stroke-warning-600',
  'sin-verificar': 'stroke-nodata-600',
}

/**
 * Anillo de progreso (Magic UI Circular Progress, movin Rings). SVG
 * decorativo: el valor lo dice el texto del centro (`children`). El arco se
 * llena una sola vez al montar (MOTION 4.12) con `stroke-dashoffset`; con
 * movimiento reducido se pinta ya lleno. La marca del umbral es una línea
 * corta sobre la pista.
 */
export function Anillo({
  valor,
  umbral,
  tono,
  tamano = 120,
  grosor = 8,
  animar = true,
  className,
  children,
}: {
  /** 0..1 */
  valor: number
  /** 0..1 */
  umbral?: number
  tono: TonoAnillo
  tamano?: number
  grosor?: number
  animar?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const radio = (tamano - grosor) / 2
  const circunferencia = 2 * Math.PI * radio
  const fraccion = Math.max(0, Math.min(1, valor))
  const conMovimiento = animar && !prefiereMovimientoReducido()
  const [lleno, setLleno] = useState(!conMovimiento)

  useEffect(() => {
    if (lleno) return
    // Tras el primer fotograma, para que la transición tenga un punto de partida.
    const marco = requestAnimationFrame(() => setLleno(true))
    return () => cancelAnimationFrame(marco)
  }, [lleno])

  const centro = tamano / 2
  const angulo = umbral === undefined ? null : umbral * 2 * Math.PI - Math.PI / 2
  return (
    <div className={cn('relative', className)} style={{ width: tamano, height: tamano }} data-tono={tono}>
      <svg aria-hidden width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} className="block">
        <circle cx={centro} cy={centro} r={radio} fill="none" strokeWidth={grosor} className="stroke-surface-sunken" />
        <circle
          data-arco
          cx={centro}
          cy={centro}
          r={radio}
          fill="none"
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={lleno ? circunferencia * (1 - fraccion) : circunferencia}
          transform={`rotate(-90 ${centro} ${centro})`}
          className={cn(ARCO[tono], conMovimiento && 'transition-[stroke-dashoffset] duration-(--duration-reveal) ease-(--ease-out)')}
        />
        {angulo !== null && (
          <line
            data-umbral
            x1={centro + (radio - grosor / 2 - 2) * Math.cos(angulo)}
            y1={centro + (radio - grosor / 2 - 2) * Math.sin(angulo)}
            x2={centro + (radio + grosor / 2 + 2) * Math.cos(angulo)}
            y2={centro + (radio + grosor / 2 + 2) * Math.sin(angulo)}
            strokeWidth={2}
            className="stroke-faint"
          />
        )}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  )
}
