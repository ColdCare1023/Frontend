import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'

import { filasEquipos, useEstadoVivoStore, type ClaveEstado } from '@/application/stores/estadoVivoStore'
import { haceCuanto } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { ICONO_ESTADO, TEXTO_ESTADO, type TonoEstado } from '../../components/ui/estado-tonos'
import { formatearTemperatura } from '../../components/ui/formato-cifra'
import { Regla } from '../../components/ui/regla'

const TONO: Record<ClaveEstado, TonoEstado> = {
  normal: 'normal',
  riesgo_preventivo: 'preventivo',
  excursion_critica: 'critico',
  falla_sensor: 'critico',
  sin_datos: 'sin_datos',
  suspendido: 'sin_datos',
  sin_conexion: 'sin_conexion',
  sin_lectura: 'neutro',
}

/**
 * «Equipos ahora»: la lectura actual de cada equipo junto a la bandeja. Al
 * decidir la acción de una excursión de ayer, la pregunta es si el equipo ya
 * volvió a 2–8 °C. Sale del estado en vivo que el shell ya cargó (píldora de
 * la cabecera): no pide nada nuevo y se actualiza con cada lectura del SSE.
 */
export function EquiposAhora({ ahora }: { ahora: number }) {
  const { t } = useTranslation()
  const equipos = useEstadoVivoStore((s) => s.equipos)
  const ultimas = useEstadoVivoStore((s) => s.ultimas)
  const carga = useEstadoVivoStore((s) => s.carga)
  const filas = useMemo(() => filasEquipos(equipos, ultimas), [equipos, ultimas])

  if (carga === 'cargando' || filas.length === 0) return null

  return (
    <section aria-labelledby="equipos-ahora-titulo" className="superficie overflow-hidden">
      <header className="flex min-h-12 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border px-4 py-2.5">
        <h2 id="equipos-ahora-titulo" className="text-title text-foreground">
          {t('alertas.ahora.titulo')}
        </h2>
        <p className="text-meta text-faint">{t('alertas.ahora.ayuda')}</p>
      </header>
      <ul className="divide-y divide-border">
        {filas.map(({ equipo, lectura, estado }) => {
          const tono = TONO[estado.clave]
          const Icono = ICONO_ESTADO[tono]
          const temperatura = estado.clave === 'falla_sensor' ? null : lectura?.temperatura ?? null
          return (
            <li key={equipo.id}>
              <Link
                to="/dashboard"
                state={{ equipo: equipo.id }}
                className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2 transition-colors duration-(--duration-micro) ease-(--ease-hover) hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              >
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <Icono aria-hidden className={cn('size-4 shrink-0', TEXTO_ESTADO[tono])} />
                    <span className="codigo truncate text-body font-medium text-foreground">{equipo.id}</span>
                    <span className={cn('shrink-0 text-meta', TEXTO_ESTADO[tono])}>{t(`estadoVivo.estado.${estado.clave}`)}</span>
                  </span>
                  <span className="mt-0.5 block truncate pl-6 text-meta text-faint">
                    {[equipo.nombre, lectura ? t('alertas.ahora.lectura', { hace: haceCuanto(lectura.timestamp, ahora) }) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="flex items-center gap-3 max-sm:col-start-1 max-sm:row-start-2 max-sm:pl-6">
                  <Regla valor={temperatura} tono={tono} tamano="s" decorativa />
                  <span className="nums w-16 text-right text-body font-semibold text-foreground max-sm:text-left">
                    {temperatura !== null ? formatearTemperatura(temperatura) : '—'}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 text-faint max-sm:row-span-2 max-sm:row-start-1 max-sm:col-start-2" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
