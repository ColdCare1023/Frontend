import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { MotionConfig } from 'motion/react'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { useFuenteEstadoVivo } from '@/application/hooks/useEstadoVivo'
import { AvisosTiempoReal } from '@/presentation/components/AvisosTiempoReal'
import { cn } from '@/lib/utils'
import { AvisoExpiracionSesion } from '../components/AvisoExpiracionSesion'
import { ColdCareBrand } from '../components/ColdCareBrand'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { EstadoError } from '../components/EstadoPagina'
import { Button } from '../components/ui/button'
import { Tooltip, TooltipProvider } from '../components/ui/tooltip'
import { NotchToaster } from '../components/notificaciones/notch'
import { CONSULTA_RIEL, CONSULTA_SM, useCoincideMedia } from '../hooks/useCoincideMedia'
import { precargarRuta } from '../rutas'
import { Cabecera } from './shell/Cabecera'
import { MenuUsuario } from './shell/MenuUsuario'
import { NavegacionPrincipal } from './shell/NavegacionPrincipal'
import { useCambioDeRuta } from './shell/useCambioDeRuta'
import { ANCHO_COLAPSADO, ANCHO_EXPANDIDO, guardarColapsado, leerColapsado } from './preferenciaSidebar'

/** Tras la primera ruta, precarga Alertas en un momento ocioso (la más visitada después del tablero). */
function usePrecargaOciosa() {
  useEffect(() => {
    const ventana = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
    if (!ventana.requestIdleCallback) return
    const id = ventana.requestIdleCallback(() => precargarRuta('/alertas'), { timeout: 2000 })
    return () => ventana.cancelIdleCallback?.(id)
  }, [])
}

/**
 * Shell de las rutas protegidas (spec:shell, DIRECTION §7/§12):
 * - Riel de 240/72 px desde 1024 px (en 1024–1279 arranca compacto si no hay
 *   preferencia). Su ancho cambia sin animar —antes un spring de `width`
 *   reflowaba el `main` y redimensionaba la gráfica en cada fotograma—; solo
 *   las etiquetas cambian.
 * - Bajo 1024 px, cajón con la misma navegación.
 * - Cabecera de 56 px con la píldora en vivo y un único chip de demo.
 * - Una sola entrada de página (CSS, 220 ms, solo opacidad y 4 px).
 *
 * `MotionConfig` aplica la preferencia de movimiento reducido a lo que aún
 * usa motion (el notch). El shell no importa nada más de motion.
 */
export function AppLayout() {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [colapsado, setColapsado] = useState(leerColapsado)
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const conRiel = useCoincideMedia(CONSULTA_RIEL)
  const esSm = useCoincideMedia(CONSULTA_SM)

  useFuenteEstadoVivo()
  useCambioDeRuta(main)
  usePrecargaOciosa()

  if (!usuario) return null

  const alternarColapso = () => {
    setColapsado((previo) => {
      guardarColapsado(!previo)
      return !previo
    })
  }
  const etiquetaColapso = colapsado ? t('nav.expandirMenu') : t('nav.colapsarMenu')
  const anchoRiel = colapsado ? ANCHO_COLAPSADO : ANCHO_EXPANDIDO

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={250} skipDelayDuration={300}>
        <div className="relative isolate flex min-h-dvh" style={{ '--ancho-riel': `${anchoRiel}px` } as React.CSSProperties}>
          {/* WCAG 2.4.1 (Evitar bloques): la navegación son doce enlaces repetidos
              en cada página. Sin este atajo, llegar al contenido con el teclado
              exigía atravesarlos uno a uno en todas las rutas. */}
          <a
            href="#contenido-principal"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-(--radius-field) focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary focus:shadow-(--shadow-float)"
          >
            {t('nav.saltarAlContenido')}
          </a>

          {/* ── Riel (≥ 1024): mismo fondo que el lienzo, separado por un borde ── */}
          <aside
            id="riel-navegacion"
            data-state={colapsado ? 'colapsado' : 'expandido'}
            className="sticky top-0 hidden h-dvh w-(--ancho-riel) shrink-0 flex-col overflow-hidden border-r border-border bg-riel lg:flex"
          >
            <div className={cn('flex h-14 shrink-0 items-center border-b border-border px-4', colapsado && 'justify-center px-0')}>
              <ColdCareBrand subtitulo={colapsado ? undefined : t('app.subtitulo')} className={cn('[&_svg]:size-9', colapsado && '[&>div]:sr-only')} />
            </div>
            <NavegacionPrincipal etiquetaNav={t('nav.principal')} sufijoId="nav-escritorio" compacto={colapsado} />
            <div className="shrink-0 space-y-1 border-t border-border p-3">
              {conRiel && <MenuUsuario variante="riel" compacto={colapsado} />}
              <Tooltip contenido={etiquetaColapso} desactivado={!colapsado}>
                <button
                  type="button"
                  onClick={alternarColapso}
                  aria-controls="riel-navegacion"
                  aria-expanded={!colapsado}
                  aria-label={etiquetaColapso}
                  className={cn(
                    'flex h-9 w-full cursor-pointer items-center gap-3 rounded-(--radius-field) px-3 text-meta font-medium whitespace-nowrap text-muted transition-colors duration-(--duration-micro) hover:bg-surface-hover hover:text-foreground',
                    colapsado && 'justify-center px-0',
                  )}
                >
                  {colapsado ? <PanelLeftOpen className="size-[18px] shrink-0" aria-hidden /> : <PanelLeftClose className="size-[18px] shrink-0" aria-hidden />}
                  {!colapsado && <span aria-hidden>{t('nav.colapsarMenu')}</span>}
                </button>
              </Tooltip>
            </div>
          </aside>

          <DialogPrimitive.Root open={drawerAbierto} onOpenChange={setDrawerAbierto}>
            {/* ── Cajón (< 1024) ── */}
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay/40 backdrop-blur-[2px] data-[state=open]:animate-fade data-[state=closed]:animate-fade-out lg:hidden dark:bg-overlay/60" />
              <DialogPrimitive.Content
                aria-describedby={undefined}
                data-cajon
                className="fixed inset-y-0 left-0 z-50 flex w-[288px] max-w-[86vw] flex-col border-r border-border bg-riel shadow-(--shadow-float) data-[state=open]:animate-(--animate-drawer) data-[state=closed]:animate-(--animate-drawer-out) focus:outline-none lg:hidden"
              >
                <DialogPrimitive.Title className="sr-only">{t('app.nombre')}</DialogPrimitive.Title>
                <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border pr-2 pl-4">
                  <ColdCareBrand subtitulo={t('app.subtitulo')} className="[&_svg]:size-9" />
                  <DialogPrimitive.Close
                    aria-label={t('comunes.cerrar')}
                    className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-(--radius-field) text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    <X className="size-4.5" aria-hidden />
                  </DialogPrimitive.Close>
                </div>
                <div className="flex min-h-0 flex-1 flex-col pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <NavegacionPrincipal alNavegar={() => setDrawerAbierto(false)} etiquetaNav={t('nav.principalMovil')} sufijoId="nav-movil" />
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>

            {/* ── Contenido ── */}
            <div className="flex min-w-0 flex-1 flex-col">
              <AvisosTiempoReal />
              <NotchToaster />
              {/* Una sola pila fija arriba: el aviso de sesión no se monta sobre la cabecera. */}
              <div data-barra-superior className="sticky top-0 z-30">
                <AvisoExpiracionSesion />
                <Cabecera conRiel={conRiel} preferenciasEnMenu={!esSm} />
              </div>

              <main
                ref={main}
                id="contenido-principal"
                tabIndex={-1}
                aria-label={t('nav.contenidoPrincipal')}
                className="min-w-0 flex-1 overflow-x-clip px-4 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] focus:outline-none sm:px-6 sm:pt-6 xl:px-8"
              >
                <div className="mx-auto w-full max-w-(--ancho-contenido-max)">
                  {/* Una sola entrada por ruta (MOTION 4.1): CSS, sin motion. Un
                      error de render de la página no tumba el riel ni la cabecera. */}
                  {/* La clave es la sección (`/dispositivos`), no la ruta completa:
                      lista ↔ detalle comparten layout y su flota no se remonta. */}
                  <div key={`/${pathname.split('/')[1] ?? ''}`} className="pagina-entra">
                    <ErrorBoundary
                      fallback={(reintentar) => (
                        <EstadoError mensaje={t('app.errorSeccion')}>
                          <p className="mt-1 text-body text-danger-700">{t('app.errorSeccionDetalle')}</p>
                          <Button size="sm" variant="secondary" className="mt-3" onClick={reintentar}>
                            {t('comunes.reintentar')}
                          </Button>
                        </EstadoError>
                      )}
                    >
                      <Outlet />
                    </ErrorBoundary>
                  </div>
                </div>
              </main>
            </div>
          </DialogPrimitive.Root>
        </div>
      </TooltipProvider>
    </MotionConfig>
  )
}
