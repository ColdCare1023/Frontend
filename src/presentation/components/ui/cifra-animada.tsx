import { useLayoutEffect, useRef } from 'react'

import { cn } from '@/lib/utils'
import { DURACION, prefiereMovimientoReducido } from '@/presentation/motion/tokens'
import { formatearCifra } from './formato-cifra'

/**
 * Cifra con «number pop-in» (MOTION 4.3, transitions.dev): cada glifo entra
 * escalonado 25 ms, en total ≤ 300 ms. Anima solo en la primera pintura y
 * cuando cambia `clave` (p. ej. al cambiar de equipo); una lectura SSE nueva
 * con la misma `clave` cambia el texto sin animar (frecuencia alta).
 *
 * `tabular-nums` evita que el ancho salte. El texto completo queda en un
 * solo nodo para el lector de pantalla; los glifos animados son decorativos.
 */
export function CifraAnimada({
  valor,
  decimales = 1,
  clave,
  animar = true,
  direccion = 1,
  className,
}: {
  valor: number | null
  decimales?: number
  /** Cambiarla vuelve a animar (equipo seleccionado, ventana…). */
  clave?: string | number
  animar?: boolean
  /** 1 entra desde abajo (sube), -1 desde arriba (baja). */
  direccion?: 1 | -1
  className?: string
}) {
  const texto = valor === null ? '—' : formatearCifra(valor, decimales)
  return (
    <span className={cn('nums inline-flex', className)}>
      <span className="sr-only">{texto}</span>
      <span aria-hidden key={animar ? String(clave ?? '') : undefined} style={{ '--dir': direccion } as React.CSSProperties}>
        {animar
          ? [...texto].map((glifo, i) => (
              <span key={i} className="cifra-digito" style={{ '--i': i } as React.CSSProperties}>
                {glifo}
              </span>
            ))
          : texto}
      </span>
    </span>
  )
}

/**
 * Conteo desde 0 (React Bits Count Up) solo al montar o al cambiar `clave`
 * (p. ej. al pulsar «Generar»). Escribe en el nodo con requestAnimationFrame,
 * nunca con un `setState` por fotograma. Con movimiento reducido, valor
 * directo. El nombre accesible es siempre el valor final.
 */
export function ContadorAnimado({
  valor,
  clave,
  formato = (n: number) => Math.round(n).toLocaleString(),
  duracion = DURACION.conteo,
  className,
}: {
  valor: number
  clave?: string | number
  formato?: (n: number) => string
  duracion?: number
  className?: string
}) {
  const nodo = useRef<HTMLSpanElement>(null)
  const formatoRef = useRef(formato)
  formatoRef.current = formato

  // Antes de pintar: sin destello del valor final antes de contar.
  useLayoutEffect(() => {
    const el = nodo.current
    if (!el) return
    const final = formatoRef.current(valor)
    if (prefiereMovimientoReducido() || typeof requestAnimationFrame !== 'function' || valor === 0) {
      el.textContent = final
      return
    }
    let marco = 0
    const inicio = performance.now()
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion)
      // ease-out (0.23, 1, 0.32, 1) aproximado con una cúbica de salida.
      const progreso = 1 - Math.pow(1 - t, 3)
      el.textContent = t < 1 ? formatoRef.current(valor * progreso) : final
      if (t < 1) marco = requestAnimationFrame(paso)
    }
    marco = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(marco)
    // `valor` cambia el destino; `clave` fuerza el reinicio aunque no cambie.
  }, [valor, clave, duracion])

  return (
    <span className={cn('nums', className)}>
      <span className="sr-only">{formato(valor)}</span>
      <span ref={nodo} aria-hidden>
        {formato(valor)}
      </span>
    </span>
  )
}
