import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router'
import { ArrowRight, ChevronLeft, ShieldCheck } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { cn } from '@/lib/utils'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Detalles } from '../components/ui/detalles'
import { StepperInteractivo } from '../components/ui/stepper'
import { useCoincideMedia } from '../hooks/useCoincideMedia'
import { prefiereMovimientoReducido } from '../motion/tokens'
import { ContenidoPaso } from './guia/ContenidoPaso'
import { ANCLAS_ANTIGUAS, ETIQUETA_PASO, PASOS, TITULO_PASO, esPaso, type PasoId } from './guia/contenidoGuia'

function PreguntasFrecuentes({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <section id="guia-preguntas" aria-labelledby="guia-preguntas-titulo" className={cn('superficie p-4 xl:p-5', className)}>
      <h2 id="guia-preguntas-titulo" tabIndex={-1} className="text-title text-foreground outline-none scroll-mt-24">
        {t('guia.preguntasTitulo')}
      </h2>
      <div className="mt-1 divide-y divide-border">
        {(['alerta', 'integridad', 'metricas'] as const).map((p) => (
          <Detalles key={p} titulo={t(`guia.preguntas.${p}.titulo`)} className="py-1">
            <p className="max-w-[68ch] pb-3 text-meta text-muted">{t(`guia.preguntas.${p}.respuesta`)}</p>
          </Detalles>
        ))}
      </div>
    </section>
  )
}

/**
 * Guía como stepper (H7): cinco pasos en un `tablist` a la izquierda (5/12)
 * y el paso actual a la derecha (7/12). El paso vive en `?paso=` para poder
 * compartirlo; los anclajes antiguos (`#guia-alerta-titulo`) se traducen.
 */
export function GuiaPage() {
  const { t } = useTranslation()
  const rol = useAuthStore((s) => s.usuario?.rol)
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const esLg = useCoincideMedia('(min-width: 64rem)')
  const ancla = hash.replace(/^#/, '')
  const paso: PasoId = esPaso(params.get('paso')) ? (params.get('paso') as PasoId) : (ANCLAS_ANTIGUAS[ancla] ?? 'inicio')
  const [animar, setAnimar] = useState<{ dir: 1 | -1 } | null>(null)
  const enfocarTitulo = useRef(false)

  const cambiar = (id: string, origen: 'puntero' | 'teclado' | 'boton') => {
    if (!esPaso(id) || id === paso) return
    const dir = PASOS.indexOf(id) > PASOS.indexOf(paso) ? 1 : -1
    setAnimar(origen === 'teclado' ? null : { dir })
    enfocarTitulo.current = origen === 'boton'
    setParams({ paso: id }, { replace: true })
  }

  // «Anterior/Siguiente» llevan el foco al título del paso nuevo.
  useEffect(() => {
    if (!enfocarTitulo.current) return
    enfocarTitulo.current = false
    const titulo = document.getElementById(`guia-titulo-${paso}`)
    titulo?.focus({ preventScroll: true })
    titulo?.scrollIntoView?.({ block: 'start', behavior: prefiereMovimientoReducido() ? 'auto' : 'smooth' })
  }, [paso])

  // `#guia-preguntas-titulo` sigue llevando a las dudas frecuentes.
  useEffect(() => {
    if (ancla !== 'guia-preguntas-titulo') return
    document.getElementById(ancla)?.focus()
  }, [ancla])

  const indice = PASOS.indexOf(paso)
  const anterior = indice > 0 ? PASOS[indice - 1] : null
  const siguiente = indice < PASOS.length - 1 ? PASOS[indice + 1] : null

  return (
    <div>
      <PageHeader
        titulo={t('guia.titulo')}
        descripcion={t('guia.descripcion')}
        meta={rol ? t('guia.metaRol', { rol: t(`roles.${rol}`) }) : undefined}
      />
      <div className="grid items-start gap-3 lg:grid-cols-12 xl:gap-4">
        <div className="min-w-0 space-y-3 lg:col-span-5 xl:space-y-4">
          <nav aria-label={t('guia.navegacion')} className={cn('superficie', esLg ? 'p-2' : 'p-3')}>
            <StepperInteractivo
              idBase="guia"
              etiqueta={t('guia.navegacion')}
              orientacion={esLg ? 'vertical' : 'horizontal'}
              pasos={PASOS.map((id) => ({ id, titulo: t(ETIQUETA_PASO[id]), resumen: t(`guia.resumenPasos.${id}`) }))}
              valor={paso}
              onCambiar={cambiar}
            />
            {!esLg && (
              <p className="nums mt-1 text-center text-meta text-muted sm:hidden">
                {t('guia.pasoDe', { actual: indice + 1, total: PASOS.length })} · {t(ETIQUETA_PASO[paso])}
              </p>
            )}
          </nav>
          {esLg && <PreguntasFrecuentes />}
        </div>

        <div className="min-w-0 lg:col-span-7">
          {PASOS.map((id, i) => {
            const activo = id === paso
            return (
              <section
                key={id}
                role="tabpanel"
                id={`guia-panel-${id}`}
                aria-labelledby={`guia-titulo-${id}`}
                hidden={!activo}
                className={cn('superficie p-4 sm:p-5 xl:p-6', activo && animar && 'panel-eje-x')}
                style={activo && animar ? ({ '--dir': animar.dir } as React.CSSProperties) : undefined}
              >
                <p className="eyebrow">
                  {id === 'inicio'
                    ? t('guia.inicioEyebrow')
                    : id === 'alertas'
                      ? t('guia.alertaEyebrow')
                      : t('guia.pasoDe', { actual: i + 1, total: PASOS.length })}
                </p>
                <h2 id={`guia-titulo-${id}`} tabIndex={-1} className="mt-1 text-title text-foreground outline-none scroll-mt-24">
                  {t(TITULO_PASO[id])}
                </h2>
                {id !== 'conceptos' && (
                  <p className="mt-1 max-w-[68ch] text-body text-muted">
                    {t(id === 'inicio' ? 'guia.inicioDescripcion' : id === 'estados' ? 'guia.estadosDescripcion' : id === 'alertas' ? 'guia.alertaDescripcion' : 'guia.pantallasDescripcion')}
                  </p>
                )}
                <div className="mt-4">
                  <ContenidoPaso paso={id} rol={rol} />
                </div>
                {/* Bajo 640 px los botones van apilados a todo el ancho: a media
                    columna «Siguiente: Temperatura y estados» se cortaba. */}
                <footer className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  {anterior && activo ? (
                    <Button variant="ghost" className="max-sm:h-11 max-sm:w-full" onClick={() => cambiar(anterior, 'boton')}>
                      <ChevronLeft />
                      {t('guia.anterior')}
                    </Button>
                  ) : (
                    <span aria-hidden className="max-sm:hidden" />
                  )}
                  {siguiente ? (
                    <Button className="max-sm:h-11 max-sm:w-full sm:ml-auto" onClick={() => cambiar(siguiente, 'boton')}>
                      <span className="truncate">{t('guia.siguientePaso', { titulo: t(ETIQUETA_PASO[siguiente]) })}</span>
                      <ArrowRight />
                    </Button>
                  ) : (
                    <Link
                      to="/dashboard"
                      className="coldcare-primary-action inline-flex h-10 items-center justify-center gap-2 rounded-(--radius-field) px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-sm:h-11 max-sm:w-full sm:ml-auto"
                    >
                      {t('guia.irMonitoreo')}
                      <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  )}
                </footer>
              </section>
            )
          })}
        </div>
        {!esLg && <PreguntasFrecuentes />}
      </div>
      <p className="mt-4 flex items-start gap-2 text-meta text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {t('guia.nota')}
      </p>
    </div>
  )
}
