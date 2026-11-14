import { useId } from 'react'

import { cn } from '@/lib/utils'
import type { PuntoTendencia } from './tendencias'

const ANCHO = 80
const ALTO = 24
const T_MIN = 0
const T_MAX = 10

const y = (v: number) => ALTO - ((Math.min(T_MAX, Math.max(T_MIN, v)) - T_MIN) / (T_MAX - T_MIN)) * ALTO

/**
 * Tendencia corta en la familia de la Regla (DIRECTION §4): eje fijo 0–10 °C,
 * franja 2–8 en `banda`, trazo navy de 1.5 px y, fuera de la franja, el mismo
 * trazo en carmesí. Si entre dos lecturas pasa más de 3× la cadencia, el trazo
 * se corta: no se dibujan temperaturas que nadie midió. Decorativa: el texto
 * de la fila dice el valor y el sentido.
 */
export function Sparkline({ puntos, className }: { puntos: readonly PuntoTendencia[]; className?: string }) {
  const id = useId()
  const validos = puntos.filter((p): p is { t: number; v: number } => p.v !== null)
  if (validos.length < 2) return null

  const t0 = validos[0].t
  const t1 = validos[validos.length - 1].t
  const rango = Math.max(1, t1 - t0)
  const x = (t: number) => ((t - t0) / rango) * ANCHO
  const pasos = validos.slice(1).map((p, i) => p.t - validos[i].t).sort((a, b) => a - b)
  const cadencia = pasos[Math.floor(pasos.length / 2)] || 1

  let d = ''
  validos.forEach((p, i) => {
    const corte = i === 0 || p.t - validos[i - 1].t > cadencia * 3
    d += `${corte ? 'M' : 'L'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`
  })

  // Id seguro para `url(#…)` (useId puede traer caracteres reservados).
  const fuera = `spk-${id.replace(/[^\w-]/g, '')}-fuera`
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      preserveAspectRatio="none"
      className={cn('h-6 w-20 shrink-0 overflow-visible', className)}
    >
      <defs>
        {/* Solo lo que cae fuera de 2–8 °C. */}
        <clipPath id={fuera}>
          <rect x="0" y="-2" width={ANCHO} height={y(8) + 2} />
          <rect x="0" y={y(2)} width={ANCHO} height={ALTO - y(2) + 2} />
        </clipPath>
      </defs>
      <rect x="0" y={y(8)} width={ANCHO} height={y(2) - y(8)} fill="var(--color-banda)" />
      <path d={d} fill="none" stroke="var(--color-grafica-1)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path
        d={d}
        fill="none"
        stroke="var(--color-critical-solid)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        clipPath={`url(#${fuera})`}
      />
    </svg>
  )
}
