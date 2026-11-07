import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { NumeroAnimado } from '@/presentation/components/ui/numero-animado'
import { BandaRango, CapasColor } from '../monitoreo/CapasColor'
import type { TonoCampo } from '../monitoreo/estadoEquipo'
import { useEnVista } from './useEnVista'

// Valores ilustrativos: el campo enseña cómo se ve cada estado, no una medición.
const ESTADOS: Array<{ clave: 'normal' | 'preventivo' | 'critico'; nivel: string; tono: TonoCampo; ejemplo: number }> = [
  { clave: 'normal', nivel: 'normal', tono: 'rango', ejemplo: 4.3 },
  { clave: 'preventivo', nivel: 'riesgo_preventivo', tono: 'preventivo', ejemplo: 7.4 },
  { clave: 'critico', nivel: 'excursion_critica', tono: 'critico', ejemplo: 8.4 },
]

const PASO_MS = 4200

/**
 * Un solo campo que pasa por los tres estados: el color, la cifra y la palabra cambian juntos, igual
 * que en Inicio. Avanza solo mientras se ve; al elegir un estado, se queda en él.
 */
export function EstadosVivos({ pausado }: { pausado: boolean }) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const campo = useRef<HTMLDivElement>(null)
  const enVista = useEnVista(campo)
  const [indice, setIndice] = useState(0)
  const [fijo, setFijo] = useState(false)
  const corre = !reducir && !pausado && !fijo && enVista

  useEffect(() => {
    if (!corre) return
    const id = window.setInterval(() => setIndice((actual) => (actual + 1) % ESTADOS.length), PASO_MS)
    return () => window.clearInterval(id)
  }, [corre])

  const activo = ESTADOS[indice]
  const elegir = (posicion: number) => {
    setIndice(posicion)
    setFijo(true)
  }

  return (
    <div className="estados">
      <div ref={campo} aria-hidden className="estados__campo" data-tono={activo.tono}>
        <CapasColor tono={activo.tono} />
        <div className="estados__lectura">
          <p className="estados__cifra">
            <NumeroAnimado valor={activo.ejemplo.toFixed(1)} />
            <span className="estados__unidad">°C</span>
          </p>
          <p className="estados__palabra">{t(`riesgo.${activo.nivel}`)}</p>
        </div>
        <BandaRango valor={activo.ejemplo} />
        <span className="escena__ejemplo">{t('guia.previa.ejemplo')}</span>
      </div>
      <ul className="estados__lista">
        {ESTADOS.map(({ clave, tono }, posicion) => (
          <li
            key={clave}
            className={cn('estados__fila', posicion === indice && 'estados__fila--activa')}
            onClick={() => elegir(posicion)}
          >
            <span aria-hidden className="estados__muestra" data-capa={tono} />
            <div className="min-w-0">
              <h3 className="estados__titulo">
                <button type="button" aria-pressed={posicion === indice} onClick={() => elegir(posicion)}>
                  {t(`guia.estados.${clave}.titulo`)}
                </button>
              </h3>
              <p className="estados__descripcion">{t(`guia.estados.${clave}.descripcion`)}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="guia-nota estados__nota">
        {t('guia.ejemploTitulo')}. {t('guia.rangoNota')}
      </p>
    </div>
  )
}
