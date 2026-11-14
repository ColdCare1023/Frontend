import { useTranslation } from 'react-i18next'
import { ChevronRight, CircleCheck, Hourglass, OctagonAlert } from 'lucide-react'

import { duracionPeriodo, fechaCorta, hora } from '@/lib/formato'
import type { ExcursionEquipo, ResumenPeriodo } from '@/lib/resumenTermico'
import { TarjetaRail } from '../../components/registros/piezas'
import { Button } from '../../components/ui/button'
import { formatearCifra } from '../../components/ui/formato-cifra'
import { Regla } from '../../components/ui/regla'
import { tonoDesdeRiesgo } from '../../components/ui/estado-tonos'
import { estaEnRango } from '@/domain/value-objects/NivelRiesgo'

const pct = (valor: number | null) => (valor == null ? '—' : `${formatearCifra(valor * 100, valor >= 0.995 || valor === 0 ? 0 : 1)} %`)
const cifra = (valor: number | null) => (valor == null ? '—' : formatearCifra(valor, 1))
const fechaHoraBreve = (ms: number) => {
  const iso = new Date(ms).toISOString()
  return `${fechaCorta(iso)} ${hora(iso).slice(0, 5)}`
}

/** Rail de contexto del Historial: solo con datos ya cargados. */
export function RailHistorial({
  resumen,
  onVerExcursion,
}: {
  resumen: ResumenPeriodo
  onVerExcursion: (excursion: ExcursionEquipo) => void
}) {
  const { t } = useTranslation()
  const excursiones = resumen.excursiones
  const brechas = resumen.brechas
  return (
    <>
      <TarjetaRail titulo={t('historial.rail.porEquipo')} meta={t('historial.rail.porEquipoMeta')}>
        <ul className="divide-y divide-border">
          {resumen.equipos.map((equipo) => (
            <li key={equipo.equipo} className="py-2 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="codigo text-body font-medium text-foreground">{equipo.equipo}</span>
                <span className="nums text-meta text-muted">{t('historial.rail.enRango', { pct: pct(equipo.pctEnRango) })}</span>
              </div>
              <Regla
                className="mt-2"
                tamano="m"
                valor={equipo.ultima}
                minimo={equipo.min}
                maximo={equipo.max}
                tono={equipo.ultima == null ? 'sin_datos' : tonoDesdeRiesgo(estaEnRango(equipo.ultima) ? 'normal' : 'excursion_critica')}
                etiqueta={t('historial.rail.porEquipoRegla', {
                  equipo: equipo.equipo,
                  ultima: cifra(equipo.ultima),
                  min: cifra(equipo.min),
                  max: cifra(equipo.max),
                })}
              />
              <p className="nums mt-1.5 text-meta text-muted">
                {t('historial.rail.porEquipoValor', {
                  min: cifra(equipo.min),
                  prom: cifra(equipo.promedio),
                  max: cifra(equipo.max),
                })}
              </p>
            </li>
          ))}
        </ul>
      </TarjetaRail>

      <TarjetaRail titulo={t('historial.rail.excursiones')}>
        {excursiones.length === 0 ? (
          <p className="flex items-start gap-2 text-body text-subtle">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success-700" />
            {t('historial.rail.sinExcursiones')}
          </p>
        ) : (
          <ul className="-my-1 divide-y divide-border">
            {excursiones.slice(0, 5).map((excursion) => (
              <li key={`${excursion.equipo}-${excursion.inicio}`} className="flex min-h-14 items-center gap-2.5 py-1.5">
                <OctagonAlert aria-hidden className="size-4 shrink-0 text-critical" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-foreground">
                    <span className="codigo">{excursion.equipo}</span> · <span className="nums">{fechaHoraBreve(excursion.inicio)}</span>
                  </p>
                  <p className="nums text-meta text-muted">
                    {t('historial.rail.excursionValor', {
                      duracion: duracionPeriodo(Math.max(60_000, excursion.fin - excursion.inicio), t),
                      max: cifra(excursion.pico),
                    })}
                  </p>
                </div>
                {excursion.idInicio && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-8 px-0 sm:h-8 shrink-0 text-muted max-sm:w-11 pointer-coarse:w-11 sm:pointer-coarse:h-11"
                    aria-label={`${t('historial.rail.verEnTabla')}: ${excursion.equipo} ${fechaHoraBreve(excursion.inicio)}`}
                    title={t('historial.rail.verEnTabla')}
                    onClick={() => onVerExcursion(excursion)}
                  >
                    <ChevronRight aria-hidden className="size-4" />
                  </Button>
                )}
              </li>
            ))}
            {excursiones.length > 5 && (
              <li className="pt-2 text-meta text-muted">{t('historial.rail.masExcursiones', { n: excursiones.length - 5 })}</li>
            )}
          </ul>
        )}
      </TarjetaRail>

      <TarjetaRail titulo={t('historial.rail.brechas')} className="sm:col-span-2 xl:col-span-1">
        {brechas.length === 0 ? (
          <p className="flex items-start gap-2 text-body text-subtle">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success-700" />
            {t('historial.rail.sinBrechas')}
          </p>
        ) : (
          <ul className="space-y-3">
            {resumen.equipos
              .filter((equipo) => equipo.brechas.length > 0)
              .map((equipo) => {
                const mayor = equipo.brechas.reduce((a, b) => (b.fin - b.inicio > a.fin - a.inicio ? b : a))
                return (
                  <li key={equipo.equipo}>
                    <p className="flex items-start gap-2 text-body text-foreground">
                      <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-nodata-700" />
                      <span>
                        {t('historial.rail.brechasTotal', { count: equipo.brechas.length, equipo: equipo.equipo })}
                        <span className="nums block text-meta text-muted">
                          {t('historial.rail.brechaMayor', {
                            duracion: duracionPeriodo(mayor.fin - mayor.inicio, t),
                            fecha: fechaHoraBreve(mayor.inicio),
                          })}
                        </span>
                      </span>
                    </p>
                    <div aria-hidden className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <div className="trama-sin-datos h-full rounded-full" style={{ width: `${Math.max(4, equipo.fraccionSinDatos * 100)}%` }} />
                    </div>
                  </li>
                )
              })}
          </ul>
        )}
      </TarjetaRail>
    </>
  )
}
