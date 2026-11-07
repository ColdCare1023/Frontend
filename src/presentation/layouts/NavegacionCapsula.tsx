import { useId, useState, type MouseEvent } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import * as Popover from '@radix-ui/react-popover'
import { motion, useReducedMotion } from 'motion/react'
import { ChevronDown } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { HojaInferior } from '../components/ui/hoja-inferior'
import type { ResumenIsla } from '../components/notificaciones/useResumenIsla'
import { navegacionDe, type ItemNav } from './navegacion'

const RESORTE = { type: 'spring', visualDuration: 0.36, bounce: 0.12 } as const
/** Mitad del alto de la píldora: con píxeles, motion corrige el radio mientras cambia de ancho. */
const RADIO_PILDORA = { arriba: 20, abajo: 18 } as const
const MAXIMO_NUMERO = 99

type Posicion = keyof typeof RADIO_PILDORA

function esClicSimple(evento: MouseEvent) {
  return evento.button === 0 && !evento.metaKey && !evento.ctrlKey && !evento.shiftKey && !evento.altKey
}

function coincide(actual: string, ruta: string) {
  return actual === ruta || actual.startsWith(`${ruta}/`)
}

/** La palabra, en blanco y en tinta: al pasar la píldora solo cambia la opacidad de cada una. */
function Palabra({ texto }: { texto: string }) {
  return (
    <span className="cinta__palabra" data-texto={texto}>
      <span className="cinta__claro">{texto}</span>
    </span>
  )
}

function NumeroAlertas({ alertas }: { alertas: NonNullable<ResumenIsla['alertas']> }) {
  const { t } = useTranslation()
  return (
    <span className="cinta__numero" data-critica={alertas.criticas > 0}>
      <span aria-hidden>{alertas.total > MAXIMO_NUMERO ? `${MAXIMO_NUMERO}+` : alertas.total}</span>
      <span className="sr-only">{`, ${t('isla.alertas', { count: alertas.total })}`}</span>
    </span>
  )
}

/** Cada pantalla de «Más» con una línea que dice para qué sirve. */
function ListaMas({ items, alElegir }: { items: ItemNav[]; alElegir: () => void }) {
  const { t } = useTranslation()
  const base = useId()
  return (
    <nav aria-label={t('nav.masPantallas')}>
      <ul className="mas-lista">
        {items.map((item) => {
          const idNombre = `${base}-${item.ruta}-nombre`
          const idDetalle = `${base}-${item.ruta}-detalle`
          return (
            <li key={item.ruta}>
              <NavLink to={item.ruta} onClick={alElegir} aria-labelledby={idNombre} aria-describedby={idDetalle} className="mas-fila realce">
                <span id={idNombre} className="mas-fila__nombre">
                  {t(item.claveI18n)}
                </span>
                {item.claveDetalle && (
                  <span id={idDetalle} className="mas-fila__detalle">
                    {t(item.claveDetalle)}
                  </span>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * La navegación principal, con palabras: Inicio, Alertas con su número, Historial, Reportes
 * y Más. Es la misma arriba, en la cápsula central, y abajo en el teléfono, al alcance del
 * pulgar. Un rol solo ve lo suyo: lo que no le toca no aparece ni deja hueco.
 *
 * La píldora sale al tocar, sin esperar a la pantalla nueva: React la prepara en una
 * transición y puede tardar. `aria-current` sí dice dónde se está de verdad.
 */
export function NavPrincipal({
  posicion,
  alertas,
  masAbierto,
  alCambiarMas,
}: {
  posicion: Posicion
  alertas: ResumenIsla['alertas']
  masAbierto: boolean
  alCambiarMas: (abierto: boolean) => void
}) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const { pathname } = useLocation()
  const rol = useAuthStore((s) => s.usuario?.rol)
  const [yendo, setYendo] = useState<{ desde: string; hacia: string } | null>(null)
  if (!rol) return null

  const { principales, mas } = navegacionDe(rol)
  const activa = yendo?.desde === pathname ? yendo.hacia : pathname
  const enMas = !principales.some((item) => coincide(activa, item.ruta))
  const hayAlertas = alertas !== null && alertas.total > 0
  const pildora = (
    <motion.span
      layoutId={`nav-pildora-${posicion}`}
      layoutDependency={activa}
      aria-hidden
      transition={reducir ? { duration: 0 } : RESORTE}
      style={{ borderRadius: RADIO_PILDORA[posicion] }}
      className="cinta__pildora"
    />
  )
  const contenidoMas = (
    <>
      {enMas && pildora}
      <Palabra texto={t('nav.mas')} />
      {posicion === 'arriba' && <ChevronDown className="cinta__flecha" aria-hidden />}
    </>
  )
  const nombreMas = `${t('nav.mas')}: ${t('nav.abrirMenu')}`

  return (
    <nav aria-label={t('nav.principal')} className="cinta" data-posicion={posicion}>
      {/* La cápsula es fija: sin layoutRoot, la píldora saldría de donde estaba la página antes de subir. */}
      <motion.ul layoutRoot layoutDependency={activa} className="cinta__lista">
        {principales.map((item) => {
          const esActiva = coincide(activa, item.ruta)
          return (
            <li key={item.ruta}>
              <NavLink
                to={item.ruta}
                data-activo={esActiva}
                onClick={(evento) => {
                  if (esClicSimple(evento)) setYendo({ desde: pathname, hacia: item.ruta })
                }}
                className="cinta__enlace realce"
              >
                {esActiva && pildora}
                <Palabra texto={t(item.claveI18n)} />
                {item.ruta === '/alertas' && hayAlertas && <NumeroAlertas alertas={alertas} />}
              </NavLink>
            </li>
          )
        })}
        <li>
          {posicion === 'arriba' ? (
            <Popover.Root open={masAbierto} onOpenChange={alCambiarMas}>
              <Popover.Trigger asChild>
                <button type="button" aria-label={nombreMas} data-activo={enMas} className="cinta__enlace realce">
                  {contenidoMas}
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  side="bottom"
                  align="end"
                  alignOffset={-6}
                  sideOffset={12}
                  collisionPadding={8}
                  aria-label={t('nav.mas')}
                  className="panel-mas tema-capsula z-[45] data-[state=open]:animate-(--animate-pop-in) data-[state=closed]:animate-(--animate-pop-out)"
                >
                  <ListaMas items={mas} alElegir={() => alCambiarMas(false)} />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          ) : (
            <button
              type="button"
              aria-label={nombreMas}
              aria-haspopup="dialog"
              aria-expanded={masAbierto}
              data-activo={enMas}
              onClick={() => alCambiarMas(true)}
              className="cinta__enlace realce"
            >
              {contenidoMas}
            </button>
          )}
        </li>
      </motion.ul>
      {posicion === 'abajo' && (
        <HojaInferior abierta={masAbierto} onCambiar={alCambiarMas} titulo={t('nav.mas')} tono="noche" cuerpoClassName="pb-3">
          <ListaMas items={mas} alElegir={() => alCambiarMas(false)} />
        </HojaInferior>
      )}
    </nav>
  )
}
