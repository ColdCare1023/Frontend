import { useEffect, useRef } from 'react'

import { alAcercarse, enMomentoLibre } from '@/lib/cargaDiferida'
import { rendimiento } from '@/lib/rendimiento'
import type { VarianteVial } from './vial3d'

/**
 * La dosis que se está cuidando, junto a su lectura. Cambia sola con la temperatura: escarcha en
 * frío, gotas cerca del límite, tinte y calor fuera de rango, y apagada si no hay datos. Se
 * pausa fuera de pantalla. Es una señal de la interfaz: un medicamento real no cambia así.
 *
 * Este archivo no importa three: la escena se descarga cuando el lienzo está por verse y el hilo
 * está libre, y nunca en un equipo que dibujaría por CPU. La pantalla funciona igual sin ella.
 */
export function VialEquipo({
  fase = 0,
  variante = 'vacuna',
  temperatura = null,
  className,
}: {
  fase?: number
  /** Qué medicamento se muestra: cada equipo tiene el suyo. */
  variante?: VarianteVial
  /** Lectura actual en °C; `null` cuando no hay dato fiable. */
  temperatura?: number | null
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  // La lectura cambia cada 10 s; la escena no se rehace por eso.
  const lectura = useRef(temperatura)
  useEffect(() => {
    lectura.current = temperatura
  }, [temperatura])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let cerrado = false
    let soltar: (() => void) | undefined
    let cancelarEspera: (() => void) | undefined
    const dejarDeEsperar = alAcercarse(
      canvas,
      () => {
        cancelarEspera = enMomentoLibre(() => {
          // La prueba de WebGL también espera a un momento libre: no va en el montaje de la pantalla.
          if (rendimiento.sinAceleracion) return
          import('./escenaVial')
            .then((escena) => {
              // Si el fragmento no llega, `main.tsx` recarga y la promesa queda sin módulo.
              if (cerrado || !escena) return
              soltar = escena.iniciarEscenaVial(canvas, { fase, variante, lectura: () => lectura.current })
            })
            .catch(() => undefined)
        })
      },
      '60% 0px',
    )
    return () => {
      cerrado = true
      dejarDeEsperar()
      cancelarEspera?.()
      soltar?.()
    }
  }, [fase, variante])

  // Con otro medicamento va otro lienzo: el anterior devolvió su contexto al limpiar.
  return (
    <canvas
      key={`${variante}-${fase}`}
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ opacity: 0, transition: 'opacity 240ms ease-out' }}
    />
  )
}
