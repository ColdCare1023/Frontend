import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/application/stores/authStore'
import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import { cn } from '@/lib/utils'
import { seccionesPermitidas } from '../../navegacion'
import { InsigniaConteo } from '../../components/ui/insignia-conteo'
import { Tooltip } from '../../components/ui/tooltip'
import { precargarRuta } from '../../rutas'
import { marcarNavegacionDesdeMenu } from './useCambioDeRuta'

/** Contador del ítem «Alertas»: solo lee el total y las críticas del store. */
function InsigniaAlertas({ compacto }: { compacto: boolean }) {
  const { t } = useTranslation()
  const total = useEstadoVivoStore((s) => s.alertas?.total ?? null)
  const criticas = useEstadoVivoStore((s) => s.alertas?.criticas ?? 0)
  const truncado = useEstadoVivoStore((s) => s.alertas?.truncado ?? false)
  if (!total) return null
  return (
    <>
      <InsigniaConteo
        valor={total}
        critico={criticas > 0}
        truncado={truncado}
        tamano={compacto ? 'sm' : 'md'}
        className={compacto ? 'absolute top-1 right-1.5 ring-2 ring-riel' : 'ml-auto'}
      />
      <span className="sr-only">
        {`, ${t('nav.insigniaAlertas', { count: total })}`}
        {criticas > 0 ? `, ${t('nav.insigniaCriticas', { count: criticas })}` : ''}
      </span>
    </>
  )
}

/**
 * Navegación compartida entre el riel y el cajón móvil, filtrada por rol
 * (HU-41). El ítem activo es estático: fondo `primary-tint` y barra de 2 px,
 * sin animación al cambiar de ruta (MOTION §5: el indicador del nav no se
 * anima; antes un `layoutId` corría en el hilo principal durante la carga).
 *
 * `sufijoId` distingue las dos instancias: con el cajón abierto hay dos `nav`
 * y dos juegos de encabezados; sin ids distintos, `aria-labelledby` se
 * duplicaba.
 */
export function NavegacionPrincipal({
  alNavegar,
  etiquetaNav,
  sufijoId,
  compacto = false,
}: {
  alNavegar?: () => void
  etiquetaNav: string
  sufijoId: string
  compacto?: boolean
}) {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  if (!usuario) return null

  return (
    <nav
      aria-label={etiquetaNav}
      className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 py-3 [@media(max-height:760px)]:space-y-3"
    >
      {seccionesPermitidas(usuario.rol).map((seccion) => {
        const idTitulo = `${sufijoId}-${seccion.claveI18n.replace(/\./g, '-')}`
        return (
          <div key={seccion.claveI18n}>
            <div className="relative mb-1 h-5">
              <p
                id={idTitulo}
                className={cn(
                  'truncate px-3 text-micro font-semibold tracking-[0.08em] text-faint uppercase transition-opacity duration-(--duration-press)',
                  compacto && 'opacity-0',
                )}
              >
                {t(seccion.claveI18n)}
              </p>
              {compacto && <span aria-hidden className="absolute top-1/2 left-1/2 h-px w-6 -translate-x-1/2 bg-border-strong" />}
            </div>
            <ul aria-labelledby={idTitulo} className="space-y-px">
              {seccion.items.map((item) => (
                <li key={item.ruta}>
                  <Tooltip contenido={t(item.claveI18n)} desactivado={!compacto}>
                    <NavLink
                      to={item.ruta}
                      onClick={() => {
                        marcarNavegacionDesdeMenu()
                        alNavegar?.()
                      }}
                      onPointerEnter={(evento) => {
                        if (evento.pointerType === 'mouse') precargarRuta(item.ruta)
                      }}
                      onFocus={() => precargarRuta(item.ruta)}
                      className={({ isActive }) =>
                        cn(
                          'group/item relative flex h-11 items-center gap-3 rounded-(--radius-field) px-3 text-body font-medium whitespace-nowrap outline-none transition-colors duration-(--duration-micro) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:h-9 lg:pointer-coarse:h-11 lg:[@media(max-height:700px)]:h-8',
                          isActive ? 'bg-primary-tint text-foreground' : 'text-muted hover:bg-surface-hover hover:text-foreground',
                          compacto && 'justify-center px-0',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span aria-hidden className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                          )}
                          <item.icono
                            aria-hidden
                            className={cn(
                              'size-[18px] shrink-0 transition-colors duration-(--duration-micro)',
                              isActive ? 'text-primary-text' : 'text-faint group-hover/item:text-foreground',
                            )}
                          />
                          <span className={cn('truncate', compacto && 'sr-only')}>{t(item.claveI18n)}</span>
                          {item.ruta === '/alertas' && <InsigniaAlertas compacto={compacto} />}
                        </>
                      )}
                    </NavLink>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
