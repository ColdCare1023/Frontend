import { SeccionDetalle } from '@/presentation/components/ui/seccion-detalle'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useSearchParams } from 'react-router'
import { ArrowRight, ChevronLeft, ShieldCheck } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { cn } from '@/lib/utils'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { NativeSelect } from '../components/ui/input'
import { Detalles } from '../components/ui/detalles'
import { StepperInteractivo } from '../components/ui/stepper'
import { useCoincideMedia } from '../hooks/useCoincideMedia'
import { prefiereMovimientoReducido } from '../motion/tokens'
import { EnlaceGuia, type NavegacionGuia } from './guia/EnlaceGuia'
import { ContenidoPaso } from './guia/ContenidoPaso'
import { ANCLAS_ANTIGUAS, ETIQUETA_PASO, PASOS, TITULO_PASO, esPaso, type PasoId } from './guia/contenidoGuia'

function PreguntasFrecuentes() {
  const { t } = useTranslation()
  return (
    <section id="guia-preguntas" aria-labelledby="guia-preguntas-titulo">
      <h2 id="guia-preguntas-titulo" tabIndex={-1} className="sr-only">
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

type PropsGuia = { integrada?: false; navegacion?: undefined } | { integrada: true; navegacion: NavegacionGuia }

/**
 * La guía expone un paso a la vez. El paso vive en `?paso=` para poder
 * compartirlo; los anclajes antiguos (`#guia-alerta-titulo`) se traducen.
 */
export function GuiaPage({ integrada = false, navegacion }: PropsGuia = {}) {
  const { t } = useTranslation()
  const selectorMovil = useCoincideMedia('(max-width: 639px)')
  const rol = useAuthStore((s) => s.usuario?.rol)
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const ancla = integrada ? '' : hash.replace(/^#/, '')
  const [pasoLocal, setPasoLocal] = useState<PasoId>('inicio')
  const paso: PasoId = integrada ? pasoLocal : esPaso(params.get('paso')) ? (params.get('paso') as PasoId) : (ANCLAS_ANTIGUAS[ancla] ?? 'inicio')
  const [animar, setAnimar] = useState<{ dir: 1 | -1 } | null>(null)
  const enfocarTitulo = useRef(false)

  const cambiar = (id: string, origen: 'puntero' | 'teclado' | 'boton') => {
    if (!esPaso(id) || id === paso) return
    const dir = PASOS.indexOf(id) > PASOS.indexOf(paso) ? 1 : -1
    setAnimar(origen === 'teclado' ? null : { dir })
    enfocarTitulo.current = origen === 'boton'
    if (integrada) setPasoLocal(id)
    else setParams({ paso: id }, { replace: true })
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
      {!integrada && <PageHeader
        titulo={t('guia.titulo')}
        meta={rol ? t('guia.metaRol', { rol: t(`roles.${rol}`) }) : undefined}
      />}
      <div className="superficie mx-auto max-w-4xl divide-y divide-border">
        <div className="min-w-0">
          <nav aria-label={t('guia.navegacion')} className="p-3 sm:px-5">
            <label className="block sm:hidden">
              <span className="mb-1 block text-meta text-muted">{t('guia.navegacion')}</span>
              <NativeSelect aria-controls={`guia-panel-${paso}`} value={paso} onChange={(e) => cambiar(e.target.value, 'puntero')}>
                {PASOS.map((id, n) => <option key={id} value={id}>{n + 1}. {t(ETIQUETA_PASO[id])}</option>)}
              </NativeSelect>
            </label>
            <StepperInteractivo
              className="max-sm:hidden"
              idBase="guia"
              etiqueta={t('guia.navegacion')}
              orientacion="horizontal"
              pasos={PASOS.map((id) => ({ id, titulo: t(ETIQUETA_PASO[id]) }))}
              valor={paso}
              onCambiar={cambiar}
            />
          </nav>
        </div>

        <div className="min-w-0">
          {PASOS.map((id) => {
            const activo = id === paso
            return (
              <section
                key={id}
                role={selectorMovil ? 'region' : 'tabpanel'}
                id={`guia-panel-${id}`}
                aria-labelledby={selectorMovil ? `guia-titulo-${id}` : `guia-tab-${id}`}
                hidden={!activo}
                className={cn('p-4 sm:p-5 xl:p-6', activo && animar && 'panel-eje-x')}
                style={activo && animar ? ({ '--dir': animar.dir } as React.CSSProperties) : undefined}
              >
                <h2 id={`guia-titulo-${id}`} tabIndex={-1} className="mt-1 text-title text-foreground outline-none scroll-mt-24">
                  {t(TITULO_PASO[id])}
                </h2>
                {id !== 'conceptos' && (
                  <p className="mt-1 max-w-[68ch] text-body text-muted">
                    {t(id === 'inicio' ? 'guia.inicioDescripcion' : id === 'estados' ? 'guia.estadosDescripcion' : id === 'alertas' ? 'guia.alertaDescripcion' : 'guia.pantallasDescripcion')}
                  </p>
                )}
                <div className="mt-4">
                  <ContenidoPaso paso={id} rol={rol} navegacion={navegacion} />
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
                    <EnlaceGuia
                      ruta="/dashboard" navegacion={navegacion}
                      className="coldcare-primary-action inline-flex h-10 items-center justify-center gap-2 rounded-(--radius-field) px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-sm:h-11 max-sm:w-full sm:ml-auto"
                    >
                      {t('guia.irMonitoreo')}
                      <ArrowRight aria-hidden className="size-4" />
                    </EnlaceGuia>
                  )}
                </footer>
              </section>
            )
          })}
        </div>
        <SeccionDetalle className="mx-3 sm:mx-5" titulo={t('guia.preguntasTitulo')} open={ancla === 'guia-preguntas-titulo' || undefined}>
          <PreguntasFrecuentes />
        </SeccionDetalle>
        <SeccionDetalle className="mx-3 sm:mx-5" titulo={t('lectura.alcance')}>
          <p className="flex items-start gap-2 text-meta text-muted">
            <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {t('guia.nota')}
          </p>
        </SeccionDetalle>
      </div>
    </div>
  )
}
