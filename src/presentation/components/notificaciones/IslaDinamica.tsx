import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import * as Popover from '@radix-ui/react-popover'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Bell, CircleCheck, TriangleAlert, WifiOff, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FormaCapsula } from '../ui/forma-capsula'
import { NumeroAnimado } from '../ui/numero-animado'
import { limpiarAvisos, useAvisosIsla, type AvisoIsla, type NivelNotch } from './notificarNotch'
import type { EquipoIsla, ResumenIsla } from './useResumenIsla'

const RADIO = 26
const ANCHO_INICIAL = 148
/** Cuánto se cuenta un aviso antes de recogerse. Sigue en el panel y en la región viva. */
const CONTAR_MS: Record<NivelNotch, number> = { critico: 8000, aviso: 5500, ok: 4500 }
const ICONO_AVISO = { critico: TriangleAlert, aviso: TriangleAlert, ok: CircleCheck } as const
const ENFOCABLES = 'a[href], button:not([disabled])'

const FUNDIDO = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.1 } },
  transition: { duration: 0.2, delay: 0.08, ease: 'easeOut' },
} as const

/**
 * Si lo último fue el teclado. `:focus-visible` lo sabe en el navegador, pero no cuando el foco
 * llega por código (al cerrar un panel con Escape, por ejemplo); esto cubre los dos casos.
 */
function useConTeclado() {
  const conTeclado = useRef(false)
  useEffect(() => {
    const tecla = (evento: KeyboardEvent) => {
      if (!evento.metaKey && !evento.ctrlKey && !evento.altKey) conTeclado.current = true
    }
    const puntero = () => {
      conTeclado.current = false
    }
    document.addEventListener('keydown', tecla, true)
    document.addEventListener('pointerdown', puntero, true)
    return () => {
      document.removeEventListener('keydown', tecla, true)
      document.removeEventListener('pointerdown', puntero, true)
    }
  }, [])
  return conTeclado
}

function focoDeTeclado(elemento: EventTarget, conTeclado: boolean) {
  try {
    return conTeclado || (elemento instanceof Element && elemento.matches(':focus-visible'))
  } catch {
    return conTeclado
  }
}

/** Dice cuánto mide un elemento ahora y cada vez que cambia, antes de pintarse. */
function useMedirAncho(ref: React.RefObject<HTMLElement | null>, alMedir: (ancho: number) => void) {
  useLayoutEffect(() => {
    const elemento = ref.current
    if (!elemento) return
    const medir = () => alMedir(elemento.offsetWidth)
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [ref, alMedir])
}

/** El aviso: se funde en su sitio y dice cuánto mide. La cápsula no sube ni baja. */
function VistaAviso({ alMedir, conMovimiento, children }: { alMedir: (ancho: number) => void; conMovimiento: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  useMedirAncho(ref, alMedir)
  return (
    <motion.span ref={ref} className="isla__vista" data-vista="aviso" {...(conMovimiento ? FUNDIDO : {})}>
      {children}
    </motion.span>
  )
}

/** Antigüedad legible, con unidades que no dependen del idioma. */
function tiempoRelativo(segundos: number) {
  if (segundos < 90) return `${segundos} s`
  if (segundos < 5400) return `${Math.round(segundos / 60)} min`
  if (segundos < 129_600) return `${Math.round(segundos / 3600)} h`
  return `${Math.round(segundos / 86_400)} d`
}

function textoTemperatura(equipo: EquipoIsla) {
  const temperatura = equipo.lectura?.temperatura_interna
  return temperatura == null ? null : `${temperatura.toFixed(1)}°`
}

/** Primero «Refrigerador principal», no su código: quien lee está en el mostrador. */
function enPalabras(texto: string, equipos: EquipoIsla[]) {
  return equipos.reduce((acumulado, equipo) => (equipo.nombre ? acumulado.replaceAll(equipo.id, equipo.nombre) : acumulado), texto)
}

/** Fila del panel: una lectura por equipo, con su antigüedad si ya no es vigente. */
function FilaEquipo({ equipo }: { equipo: EquipoIsla }) {
  const { t } = useTranslation()
  const texto = textoTemperatura(equipo)
  return (
    <li className="isla-panel__fila">
      <span className="isla__estado px-0" data-estado={equipo.estado}>
        <span className="isla__punto" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-medium text-white">{equipo.nombre ?? equipo.id}</span>
        <span className="block truncate text-xs text-white/60">
          {equipo.nombre && `${equipo.id} · `}
          {equipo.estado === 'sinDatos'
            ? equipo.antiguedad == null
              ? t('isla.sinLectura')
              : t('isla.sinLecturaHace', { tiempo: tiempoRelativo(equipo.antiguedad) })
            : t(equipo.estado === 'normal' ? 'riesgo.normal' : equipo.estado === 'aviso' ? 'riesgo.riesgo_preventivo' : 'riesgo.excursion_critica')}
        </span>
      </span>
      <span className="nums text-xl font-semibold tracking-[-0.02em] text-white">{texto ?? '—'}</span>
    </li>
  )
}

/** Lo que no cabe en la cápsula: crece hacia abajo cuando alguien lo pide. */
function PanelEquipos({
  resumen,
  verAlertas,
  alCerrar,
  align = 'center',
}: {
  resumen: ResumenIsla
  verAlertas: boolean
  alCerrar: () => void
  align?: 'center' | 'end'
}) {
  const { t } = useTranslation()
  const avisos = useAvisosIsla()
  const { equipos, alertas } = resumen
  const hayAlertas = (alertas?.total ?? 0) > 0
  return (
    <Popover.Portal>
      <Popover.Content
        side="bottom"
        align={align}
        sideOffset={10}
        collisionPadding={8}
        aria-label={t('isla.panel')}
        className="isla-panel tema-capsula z-[45] data-[state=open]:animate-(--animate-pop-in) data-[state=closed]:animate-(--animate-pop-out)"
      >
        <p className="isla-panel__rotulo">{t('isla.equipos')}</p>
        {equipos.length > 0 ? (
          <ul>
            {equipos.map((equipo) => (
              <FilaEquipo key={equipo.id} equipo={equipo} />
            ))}
          </ul>
        ) : (
          <p className="isla-panel__fila text-sm text-white/70">{t(resumen.cargando ? 'isla.conectando' : 'isla.sinLectura')}</p>
        )}
        {verAlertas && alertas && (
          <Link to="/alertas" onClick={alCerrar} className="isla-panel__fila realce mt-1 text-sm font-medium text-white">
            <Bell className="size-4 shrink-0 text-white/70" aria-hidden />
            <span className="flex-1">{hayAlertas ? t('isla.alertas', { count: alertas.total }) : t('isla.sinAlertas')}</span>
            <ArrowRight className="size-4 shrink-0 text-white/70" aria-hidden />
          </Link>
        )}
        {avisos.length > 0 && (
          <>
            <p className="isla-panel__rotulo mt-1">{t('isla.avisos')}</p>
            <ul>
              {avisos.map((aviso) => (
                <li key={aviso.id} className="isla-panel__fila items-start">
                  <FilaAviso aviso={aviso} equipos={equipos} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Popover.Content>
    </Popover.Portal>
  )
}

/**
 * La lectura actual: un punto de color, la temperatura y de qué equipo es. Al tocarla se
 * abre el estado de todos los equipos. El anuncio para lectores de pantalla sigue en
 * AvisosTiempoReal.
 */
export function LecturaActual({ resumen, verAlertas, align }: { resumen: ResumenIsla; verAlertas: boolean; align?: 'center' | 'end' }) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const [abierta, setAbierta] = useState(false)
  const { principal, alertas, conectado, cargando } = resumen
  const temperatura = principal ? textoTemperatura(principal) : null
  const estado = principal?.estado ?? 'sinDatos'
  const textoSinDatos = t(cargando ? 'isla.conectando' : principal?.lectura ? 'isla.sinLecturaNueva' : 'isla.sinLectura')
  const textoEstado =
    estado === 'sinDatos'
      ? textoSinDatos
      : t(estado === 'normal' ? 'riesgo.normal' : estado === 'aviso' ? 'riesgo.riesgo_preventivo' : 'riesgo.excursion_critica')
  const hayAlertas = (alertas?.total ?? 0) > 0
  const nombreEquipo = principal ? (principal.nombre ?? principal.id) : null
  const nombre = [
    nombreEquipo,
    estado === 'sinDatos' ? null : temperatura?.replace('°', ' °C'),
    textoEstado,
    hayAlertas ? t('isla.alertas', { count: alertas?.total }) : null,
    t('isla.abrir'),
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <Popover.Root open={abierta} onOpenChange={setAbierta}>
      <Popover.Trigger asChild>
        <button type="button" className="lectura realce" aria-label={nombre}>
          <span className="isla__estado" data-estado={estado}>
            {conectado === false ? (
              <WifiOff className="size-3.5 shrink-0 text-white/70" aria-hidden />
            ) : (
              <span className="isla__punto">{principal?.lectura && !reducir && <span key={principal.lectura.timestamp} className="isla__latido" />}</span>
            )}
            {temperatura && estado !== 'sinDatos' ? (
              <NumeroAnimado valor={temperatura} className="isla__valor" />
            ) : (
              <span className="isla__texto">{textoSinDatos}</span>
            )}
            {nombreEquipo && <span className="isla__equipo">{nombreEquipo}</span>}
          </span>
        </button>
      </Popover.Trigger>
      <PanelEquipos resumen={resumen} verAlertas={verAlertas} align={align} alCerrar={() => setAbierta(false)} />
    </Popover.Root>
  )
}

/**
 * La cápsula central. En calma muestra lo que le pasen (arriba, la navegación; en el
 * teléfono, la lectura). Cuando llega un aviso se abre para contarlo unos segundos y vuelve
 * sola. Solo cambia de ancho desde el centro: ni su posición ni su alto se mueven. Lo crítico
 * se adelanta y no se recoge mientras alguien lo lee.
 *
 * Lo de la calma sigue en su sitio mientras se cuenta el aviso, oculto pero alcanzable con el
 * teclado: llegar con el tabulador la recoge al instante, así el foco nunca se pierde ni
 * queda tapado. Por eso tampoco se abre si el foco de teclado ya está ahí (`retenida` hace lo
 * mismo para quien la usa: un panel abierto encima).
 */
export function IslaDinamica({
  resumen,
  verAlertas,
  retenida = false,
  children,
}: {
  resumen: ResumenIsla
  verAlertas: boolean
  retenida?: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const avisos = useAvisosIsla()
  const [anchoCalma, setAnchoCalma] = useState(ANCHO_INICIAL)
  const [anchoAviso, setAnchoAviso] = useState(ANCHO_INICIAL)
  const [contando, setContando] = useState<AvisoIsla | null>(null)
  const [abierta, setAbierta] = useState(false)
  const [punteroEncima, setPunteroEncima] = useState(false)
  const [focoEnAviso, setFocoEnAviso] = useState(false)
  const [focoEnCalma, setFocoEnCalma] = useState(false)
  const yaContados = useRef(new Set<string>())
  const calma = useRef<HTMLDivElement>(null)
  const mensaje = useRef<HTMLSpanElement>(null)
  const conTeclado = useConTeclado()

  useEffect(() => () => limpiarAvisos(), [])
  useMedirAncho(calma, setAnchoCalma)

  // Lo crítico se adelanta; lo demás, en orden de llegada.
  const enEspera = avisos.filter((a) => !yaContados.current.has(a.id)).reverse()
  const siguiente = enEspera.find((a) => a.nivel === 'critico') ?? enEspera[0] ?? null

  useEffect(() => {
    if (!siguiente || retenida || focoEnCalma) return
    if (contando && (contando.nivel === 'critico' || siguiente.nivel !== 'critico')) return
    yaContados.current.add(siguiente.id)
    // El puntero que ya estaba ahí no está leyendo: si no, el aviso no se recogería nunca.
    setPunteroEncima(false)
    setContando(siguiente)
  }, [siguiente, contando, retenida, focoEnCalma])

  // Se recoge solo, salvo mientras alguien lo está leyendo.
  const atendida = punteroEncima || focoEnAviso
  useEffect(() => {
    if (!contando || atendida || abierta) return
    const reloj = window.setTimeout(() => setContando(null), CONTAR_MS[contando.nivel])
    return () => window.clearTimeout(reloj)
  }, [contando, atendida, abierta])

  const alMedirAviso = useCallback((medida: number) => setAnchoAviso(medida), [])

  /** Recoger a mano: si el foco estaba en el aviso, pasa a lo que vuelve a verse. */
  const recoger = () => {
    const teniaFoco = mensaje.current?.contains(document.activeElement)
    setContando(null)
    setPunteroEncima(false)
    if (teniaFoco) calma.current?.querySelector<HTMLElement>(ENFOCABLES)?.focus({ preventScroll: true })
  }

  const ancho = contando ? anchoAviso : anchoCalma
  const detalle = contando ? enPalabras(contando.detalle, resumen.equipos) : ''

  return (
    <Popover.Root open={abierta} onOpenChange={setAbierta}>
      <Popover.Anchor asChild>
        <div className="isla tema-capsula" style={{ '--w': ancho } as React.CSSProperties}>
          <FormaCapsula izquierda={ancho / 2} derecha={ancho / 2} radio={RADIO} />
          <AnimatePresence initial={false}>
            {contando && (
              <VistaAviso key="aviso" alMedir={alMedirAviso} conMovimiento={!reducir}>
                <span
                  ref={mensaje}
                  className="isla__mensaje"
                  // Chrome avisa de un movimiento falso cuando algo aparece bajo un puntero quieto.
                  onPointerMove={(evento) => {
                    if (evento.movementX !== 0 || evento.movementY !== 0) setPunteroEncima(true)
                  }}
                  onPointerLeave={() => setPunteroEncima(false)}
                  onFocus={() => setFocoEnAviso(true)}
                  onBlur={() => setFocoEnAviso(false)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Escape' && !abierta) recoger()
                  }}
                >
                  <Popover.Trigger asChild>
                    <button type="button" className="isla__contar" aria-label={`${contando.titulo}. ${detalle}. ${t('isla.abrir')}`}>
                      <AvisoContado key={contando.id} aviso={contando} detalle={detalle} />
                    </button>
                  </Popover.Trigger>
                  <button type="button" className="isla__recoger realce" aria-label={t('isla.recoger')} onClick={recoger}>
                    <X className="size-4" aria-hidden />
                  </button>
                </span>
              </VistaAviso>
            )}
          </AnimatePresence>
          <div
            ref={calma}
            className="isla__calma"
            data-oculta={contando !== null}
            onFocus={(evento) => {
              if (!focoDeTeclado(evento.target, conTeclado.current)) return
              setFocoEnCalma(true)
              setContando(null)
            }}
            onBlur={() => setFocoEnCalma(false)}
          >
            {children}
          </div>
          {contando && enEspera.length > 0 && (
            <span aria-hidden className="isla__burbuja">
              +{enEspera.length}
            </span>
          )}
        </div>
      </Popover.Anchor>
      <PanelEquipos resumen={resumen} verAlertas={verAlertas} alCerrar={() => setAbierta(false)} />
    </Popover.Root>
  )
}

function AvisoContado({ aviso, detalle }: { aviso: AvisoIsla; detalle: string }) {
  const Icono = ICONO_AVISO[aviso.nivel]
  return (
    <span className="isla__aviso" data-nivel={aviso.nivel}>
      <span className="isla__icono">
        <Icono className="size-4" aria-hidden />
      </span>
      <span className="isla__textos">
        <strong>{aviso.titulo}</strong>
        <span>{detalle}</span>
      </span>
    </span>
  )
}

/** En el panel el detalle se lee entero: aquí no hay que cuidar el alto. */
function FilaAviso({ aviso, equipos }: { aviso: AvisoIsla; equipos: EquipoIsla[] }) {
  const Icono = ICONO_AVISO[aviso.nivel]
  const color = aviso.nivel === 'critico' ? 'text-[#ff8a80]' : aviso.nivel === 'aviso' ? 'text-[#ffb020]' : 'text-[#00d1ff]'
  return (
    <>
      <Icono className={`mt-0.5 size-4 shrink-0 ${color}`} aria-hidden />
      <span className="min-w-0 flex-1 text-[13px] leading-[18px] text-white/80">
        <strong className="block font-semibold text-white">{aviso.titulo}</strong>
        {enPalabras(aviso.detalle, equipos)}
      </span>
    </>
  )
}
