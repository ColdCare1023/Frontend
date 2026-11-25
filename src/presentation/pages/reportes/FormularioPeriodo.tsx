import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'

import { fechaCorta } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { useCoincideMedia } from '../../hooks/useCoincideMedia'
import { Button } from '../../components/ui/button'
import { Input, Label } from '../../components/ui/input'
import { Segmentado } from '../../components/ui/segmentado'
import { SelectorFecha } from '../../components/ui/selector-fecha'
import { atajoDe, periodoDeAtajo, type AtajoPeriodo } from './formatoReporte'

export interface PropsFormularioPeriodo {
  desde: string
  hasta: string
  deviceId: string
  onDesde: (v: string) => void
  onHasta: (v: string) => void
  onDeviceId: (v: string) => void
  generando: boolean
  rangoInvalido: boolean
  /** Texto de la línea #reportes-periodo (días o error de rango). */
  lineaPeriodo: string | null
  errorPeriodo: boolean
  /** Con un reporte a la vista, en <640 px el formulario se pliega. */
  plegable: boolean
  onGenerar: () => void
  className?: string
}

const ATAJOS: AtajoPeriodo[] = ['dias7', 'dias30', 'mes']

/** Periodo, equipo y «Generar» (columna izquierda, 5/12). */
export function FormularioPeriodo(
  { desde, hasta, deviceId, onDesde, onHasta, onDeviceId, generando, rangoInvalido, lineaPeriodo, errorPeriodo, plegable, onGenerar, className }: PropsFormularioPeriodo,
) {
  const { t } = useTranslation()
  const [abierto, setAbierto] = useState(false)
  const atajo = atajoDe(desde, hasta)
  const plegado = plegable && !abierto
  // Plegado solo se oculta bajo 640 px; ahí también sale del orden de tabulación.
  const esMovil = useCoincideMedia('(max-width: 39.99rem)')

  return (
    <section aria-labelledby="reportes-rango-titulo" className={cn('superficie p-4 xl:p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="reportes-rango-titulo" className="text-title text-foreground">{t('reportes.rango')}</h2>
        {plegable && (
          <Button
            variant="ghost"
            size="sm"
            className="h-11 sm:hidden"
            aria-expanded={abierto}
            aria-controls="reportes-form"
            onClick={() => setAbierto((v) => !v)}
          >
            {t('reportes.cambiarPeriodo')}
          </Button>
        )}
      </div>
      {plegado && (
        <p className="nums mt-1 text-meta text-muted sm:hidden">
          {(atajo ? t(`reportes.presets.${atajo}`) : `${fechaCorta(desde)} – ${fechaCorta(hasta)}`)} ·{' '}
          {deviceId || t('reportes.todosLosEquipos')}
        </p>
      )}
      <div className={cn('grid transition-[grid-template-rows] duration-(--duration-reveal) ease-(--ease-out)', plegado ? 'max-sm:grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
        <div className={cn('min-h-0', plegado && 'max-sm:overflow-hidden')} inert={plegado && esMovil ? true : undefined}>
          <form
            id="reportes-form"
            aria-labelledby="reportes-rango-titulo"
            className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end lg:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (rangoInvalido) return
              onGenerar()
            }}
          >
            <Segmentado
              etiqueta={t('reportes.presets.etiqueta')}
              opciones={ATAJOS.map((valor) => ({ valor, etiqueta: t(`reportes.presets.${valor}`) }))}
              valor={(atajo ?? '') as AtajoPeriodo}
              onCambiar={(valor) => {
                const p = periodoDeAtajo(valor)
                onDesde(p.desde)
                onHasta(p.hasta)
              }}
              className="col-span-2 flex w-full md:col-span-4 lg:col-span-2"
              botonClassName="flex-1"
            />
            <div className="min-w-0">
              <Label htmlFor="r-desde">{t('reportes.desde')}</Label>
              <SelectorFecha id="r-desde" valor={desde} onCambiar={onDesde} invalido={!desde || errorPeriodo} aria-describedby="reportes-periodo" />
            </div>
            <div className="min-w-0">
              <Label htmlFor="r-hasta">{t('reportes.hasta')}</Label>
              <SelectorFecha id="r-hasta" valor={hasta} onCambiar={onHasta} invalido={!hasta || errorPeriodo} aria-describedby="reportes-periodo" />
            </div>
            <div className="col-span-2 min-w-0 md:col-span-1 lg:col-span-2">
              <Label htmlFor="r-device">{t('reportes.dispositivo')}</Label>
              <Input
                id="r-device"
                className="codigo"
                autoCapitalize="characters"
                value={deviceId}
                onChange={(e) => onDeviceId(e.target.value)}
                placeholder={t('reportes.codigoEquipoEjemplo')}
              />
            </div>
            <Button
              type="submit"
              className="col-span-2 w-full max-sm:h-11 md:col-span-1 md:w-auto lg:col-span-2 lg:w-full"
              disabled={generando || rangoInvalido}
            >
              <FileText />
              <span key={generando ? 'on' : 'off'} className="animate-(--animate-swap)">
                {generando ? t('reportes.generando') : t('reportes.generar')}
              </span>
            </Button>
          </form>
          <p
            id="reportes-periodo"
            role={errorPeriodo ? 'alert' : 'status'}
            className={cn('nums mt-2 text-meta', errorPeriodo ? 'text-critical' : 'text-faint')}
          >
            {lineaPeriodo}
          </p>
        </div>
      </div>
    </section>
  )
}
