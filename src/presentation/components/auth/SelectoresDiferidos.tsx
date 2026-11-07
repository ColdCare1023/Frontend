import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Languages, Moon, Sun } from 'lucide-react'

import { usePreferenciaTema, useTemaResuelto } from '@/infrastructure/tema/tema'
import { cn } from '@/lib/utils'

/*
 * Idioma y tema en el acceso, sin traer el menú (Radix y Floating UI) hasta que alguien los quiera.
 * Mientras tanto se pinta un botón idéntico al real: mismas clases, mismo nombre accesible y el
 * mismo `aria-haspopup`. Al señalarlo o enfocarlo se precarga; al tocarlo (o con Intro, Espacio o
 * Flecha abajo) se monta el selector real, que hereda el foco y se abre con el mismo gesto.
 * Si se cambian los botones de `LanguageSwitcher` o `ThemeSwitcher`, cambiar también estos.
 */

const cargarIdioma = () => import('../LanguageSwitcher')
const cargarTema = () => import('../ThemeSwitcher')
const SelectorIdioma = lazy(() => cargarIdioma().then((m) => ({ default: m.LanguageSwitcher })))
const SelectorTema = lazy(() => cargarTema().then((m) => ({ default: m.ThemeSwitcher })))

const TECLAS_QUE_ABREN = ['Enter', ' ', 'ArrowDown']

type Gesto = { tipo: 'puntero' } | { tipo: 'tecla'; tecla: string }

/** Lo que el botón de espera necesita para despertar al selector real. */
interface PropsMarcador {
  className?: string
  onIntencion: (gesto: Gesto) => void
  onPrecargar: () => void
}

/** Abre el menú real con el mismo gesto que se hizo sobre el botón de espera. */
function repetirGesto(boton: HTMLButtonElement, gesto: Gesto) {
  boton.focus({ preventScroll: true })
  if (gesto.tipo === 'tecla') {
    boton.dispatchEvent(new KeyboardEvent('keydown', { key: gesto.tecla, bubbles: true, cancelable: true }))
  } else if (typeof PointerEvent === 'function') {
    boton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true }))
  }
}

/** Corre una vez, cuando el selector real ya está en pantalla (vive en el mismo `Suspense`). */
function AlMontar({ hacer }: { hacer: () => void }) {
  const hecho = useRef(false)
  useEffect(() => {
    if (hecho.current) return
    hecho.current = true
    hacer()
  }, [hacer])
  return null
}

function SelectorDiferido({
  Real,
  Marcador,
  precargar,
  className,
}: {
  Real: ComponentType<{ className?: string }>
  Marcador: ComponentType<PropsMarcador>
  precargar: () => Promise<unknown>
  className?: string
}) {
  const [despierto, setDespierto] = useState(false)
  const caja = useRef<HTMLSpanElement>(null)
  const gesto = useRef<Gesto | null>(null)

  // Ya pintado el acceso, en un momento libre: el primer toque no espera a la red.
  useEffect(() => {
    const ventana = window as Window & {
      requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (ventana.requestIdleCallback) {
      const id = ventana.requestIdleCallback(() => void precargar().catch(() => {}), { timeout: 4000 })
      return () => ventana.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(() => void precargar().catch(() => {}), 2500)
    return () => window.clearTimeout(id)
  }, [precargar])

  const alIntentar = (nuevo: Gesto) => {
    gesto.current = nuevo
    setDespierto(true)
  }
  const alPrecargar = () => void precargar().catch(() => {})
  const marcador = <Marcador className={className} onIntencion={alIntentar} onPrecargar={alPrecargar} />

  return (
    <span ref={caja} className="contents">
      {despierto ? (
        <Suspense fallback={marcador}>
          <Real className={className} />
          <AlMontar
            hacer={() => {
              const boton = caja.current?.querySelector('button')
              const pendiente = gesto.current
              gesto.current = null
              if (boton && pendiente) repetirGesto(boton, pendiente)
            }}
          />
        </Suspense>
      ) : (
        marcador
      )}
    </span>
  )
}

/** El botón de espera: un `<button>` con los mismos atributos que el disparador de Radix cerrado. */
function BotonEspera({
  etiqueta,
  className,
  onIntencion,
  onPrecargar,
  children,
}: PropsMarcador & { etiqueta: string; children: ReactNode }) {
  const alTeclear = (evento: KeyboardEvent<HTMLButtonElement>) => {
    if (!TECLAS_QUE_ABREN.includes(evento.key)) return
    evento.preventDefault()
    onIntencion({ tipo: 'tecla', tecla: evento.key })
  }
  return (
    <button
      type="button"
      aria-label={etiqueta}
      aria-haspopup="menu"
      aria-expanded={false}
      data-state="closed"
      onPointerEnter={onPrecargar}
      onFocus={onPrecargar}
      onPointerDown={(evento) => {
        if (evento.button !== 0 || evento.ctrlKey) return
        evento.preventDefault()
        onIntencion({ tipo: 'puntero' })
      }}
      onKeyDown={alTeclear}
      className={className}
    >
      {children}
    </button>
  )
}

function EsperaIdioma({ className, ...props }: PropsMarcador) {
  const { t, i18n } = useTranslation()
  const actual = i18n.resolvedLanguage === 'en' ? 'en' : 'es'
  return (
    <BotonEspera
      {...props}
      etiqueta={`${t('idiomas.cambiar')}: ${t(`idiomas.${actual}`)}`}
      className={cn(
        'realce flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-medium text-muted hover:text-foreground data-[state=open]:text-foreground sm:h-10 sm:pointer-coarse:h-11',
        className,
      )}
    >
      <Languages className="size-4" aria-hidden />
      <span className="uppercase tracking-wide max-[399px]:hidden" aria-hidden>{actual}</span>
    </BotonEspera>
  )
}

const CLAVE_TEMA: Record<string, string> = { dark: 'tema.oscuro', light: 'tema.claro', system: 'tema.sistema' }
const ICONO_GIRO = 'absolute size-[18px] transition-[transform,opacity] duration-(--duration-reveal) ease-(--ease-ui)'

function EsperaTema({ className, ...props }: PropsMarcador) {
  const { t } = useTranslation()
  const preferencia = usePreferenciaTema()
  const oscuro = useTemaResuelto() === 'dark'
  return (
    <BotonEspera
      {...props}
      etiqueta={`${t('tema.cambiar')}: ${t(CLAVE_TEMA[preferencia] ?? 'tema.oscuro')}`}
      className={cn(
        'realce relative flex size-11 cursor-pointer items-center justify-center overflow-hidden rounded-[10px] text-muted hover:text-foreground data-[state=open]:text-foreground sm:size-10 sm:pointer-coarse:size-11',
        className,
      )}
    >
      <Moon aria-hidden className={cn(ICONO_GIRO, oscuro ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0')} />
      <Sun aria-hidden className={cn(ICONO_GIRO, oscuro ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100')} />
    </BotonEspera>
  )
}

export function IdiomaDiferido({ className }: { className?: string }) {
  return <SelectorDiferido Real={SelectorIdioma} Marcador={EsperaIdioma} precargar={cargarIdioma} className={className} />
}

export function TemaDiferido({ className }: { className?: string }) {
  return <SelectorDiferido Real={SelectorTema} Marcador={EsperaTema} precargar={cargarTema} className={className} />
}
