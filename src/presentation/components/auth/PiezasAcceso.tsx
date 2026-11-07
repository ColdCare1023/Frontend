import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Hourglass,
  Loader2,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { CTA_ACCESO, ENLACE_ACCESO } from './clasesAcceso'

/** Título y bajada de cada pantalla, con el regreso al login cuando hace falta. */
export function EncabezadoAcceso({
  titulo,
  bajada,
  bajadaSoloEnEscritorio = false,
  volver,
}: {
  titulo: string
  bajada?: string
  /** En móvil el espacio es para el formulario: la bajada queda para el lector de pantalla. */
  bajadaSoloEnEscritorio?: boolean
  volver?: { a: string; texto: string }
}) {
  return (
    <div className="acceso-encabezado">
      {volver && (
        <Link to={volver.a} className={cn(ENLACE_ACCESO, '-mt-2 mb-1 lg:mb-3')}>
          <ArrowLeft className="size-4" aria-hidden />
          <span>{volver.texto}</span>
        </Link>
      )}
      <h2 className="acceso-titulo">{titulo}</h2>
      {bajada && <p className={cn('acceso-bajada', bajadaSoloEnEscritorio && 'max-lg:sr-only')}>{bajada}</p>}
    </div>
  )
}

export type TonoAviso = 'error' | 'bloqueo' | 'preventivo' | 'info'

/** Error en un formulario. `bloqueo` es el límite de intentos: no es un error de quien escribe. */
export interface ErrorAcceso {
  texto: string
  tono: 'error' | 'bloqueo'
}

const GLIFO = 'text-[13px] leading-none font-bold'
const ICONO_DISCO = 'size-3.5'

/*
 * Rojo sólido solo en el disco, nunca un fondo salmón. Miel para lo que pide esperar
 * o actuar. La tinta sobre miel es fija porque el disco es claro en ambos temas. Dentro del
 * disco va un glifo suelto: un icono con su propio círculo se vería como un doble aro.
 */
const TONOS: Record<TonoAviso, { caja: string; disco: string; marca: ReactNode }> = {
  error: {
    caja: 'bg-critical-tint text-foreground ring-critical/30',
    disco: 'bg-critical-solid text-on-critical',
    marca: <span className={GLIFO}>!</span>,
  },
  bloqueo: {
    caja: 'bg-honey-100 text-honey-700 ring-honey-600/30',
    disco: 'bg-honey-600 text-[#0f172a]',
    marca: <Hourglass className={ICONO_DISCO} strokeWidth={2.25} />,
  },
  preventivo: {
    caja: 'bg-honey-100 text-honey-700 ring-honey-600/30',
    disco: 'bg-honey-600 text-[#0f172a]',
    marca: <ShieldAlert className={ICONO_DISCO} strokeWidth={2.25} />,
  },
  info: {
    caja: 'bg-primary-tint text-foreground ring-primary/20',
    disco: 'bg-primary text-on-primary',
    marca: <span className={GLIFO}>i</span>,
  },
}

/** Aviso dentro del formulario: se funde al aparecer, sin desplazarse. */
export function AvisoAcceso({
  tono,
  id,
  className,
  children,
}: {
  tono: TonoAviso
  id?: string
  className?: string
  children: ReactNode
}) {
  const { caja, disco, marca } = TONOS[tono]
  return (
    <div
      id={id}
      role={tono === 'error' || tono === 'bloqueo' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-[14px] px-3 py-3 text-sm leading-5 text-pretty ring-1 ring-inset animate-fade',
        caja,
        className,
      )}
    >
      <span aria-hidden className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', disco)}>
        {marca}
      </span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </div>
  )
}

/**
 * Campo de color para los desenlaces: se lee desde lejos, como en la landing. Cian es
 * «todo en orden» y rojo sólido «no se puede seguir». La tinta es fija porque el fondo
 * no cambia de tono entre temas.
 */
export function CampoDesenlace({
  tono,
  titulo,
  role,
  children,
}: {
  tono: 'cian' | 'rojo'
  titulo: string
  role: 'alert' | 'status'
  children: ReactNode
}) {
  const Icono = tono === 'cian' ? CheckCircle2 : XCircle
  return (
    <div
      role={role}
      className={cn(
        'rounded-[14px] p-5 animate-fade lg:p-6',
        tono === 'cian' ? 'bg-secondary text-[#0f172a]' : 'bg-critical-solid text-on-critical',
      )}
    >
      <Icono className="size-7" strokeWidth={1.75} aria-hidden />
      <h3 className="mt-6 text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance lg:mt-10 lg:text-[30px]">
        {titulo}
      </h3>
      <p className="mt-2 text-[15px] leading-[1.45] text-pretty wrap-anywhere">{children}</p>
    </div>
  )
}

/** Acción principal. El texto de carga reemplaza al normal sin mover el botón. */
export function BotonAcceso({
  cargando,
  textoCargando,
  children,
  disabled,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & { cargando: boolean; textoCargando: string }) {
  return (
    <button
      type="submit"
      disabled={cargando || disabled}
      aria-busy={cargando || undefined}
      className={cn(CTA_ACCESO, cargando ? 'cursor-wait' : 'disabled:cursor-not-allowed disabled:opacity-45', className)}
      {...props}
    >
      {cargando ? (
        <>
          <Loader2 className="size-[18px] animate-spin" aria-hidden />
          <span>{textoCargando}</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          <ArrowRight
            className="size-[18px] transition-transform duration-(--duration-micro) ease-(--ease-ui) group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
            aria-hidden
          />
        </>
      )}
    </button>
  )
}

/** Mostrar u ocultar la contraseña. Ocupa 44 px dentro del campo aunque el icono mida 18. */
export function BotonVerClave({ visible, onAlternar }: { visible: boolean; onAlternar: () => void }) {
  const { t } = useTranslation()
  const Icono = visible ? EyeOff : Eye
  return (
    <button
      type="button"
      aria-label={t(visible ? 'login.ocultarPassword' : 'login.mostrarPassword')}
      aria-pressed={visible}
      onClick={onAlternar}
      className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted opacity-80 transition-opacity duration-(--duration-micro) hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
    >
      <Icono className="size-[18px]" aria-hidden />
    </button>
  )
}
