import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Ellipsis, Plus } from 'lucide-react'

import { localeActual } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Button } from '../../components/ui/button'
import { Menu, MenuContent, MenuTrigger } from '../../components/ui/menu'
import { NumeroAnimado } from '../../components/ui/numero-animado'

export type MensajeDialogo = { tipo: 'ok' | 'error'; texto: string } | null

/** Resultado de un diálogo: `status` si salió bien, `alert` si falló. */
export function MensajeFormulario({ mensaje }: { mensaje: MensajeDialogo }) {
  if (!mensaje) return null
  return (
    <p
      role={mensaje.tipo === 'error' ? 'alert' : 'status'}
      className={cn(
        'animate-fade rounded-(--radius-field) px-3 py-2 text-[13px] leading-5',
        mensaje.tipo === 'ok' ? 'bg-success-100 text-success-700' : 'bg-critical-solid font-medium text-on-critical',
      )}
    >
      {mensaje.texto}
    </p>
  )
}

/** Acciones al pie de un diálogo: no se pierden al desplazar un formulario largo. */
export function PieDialogo({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'sticky -bottom-5 z-10 -mx-5 -mb-5 mt-5 flex flex-wrap justify-end gap-2 border-t border-border bg-surface-raised px-5 py-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Las opciones de un registro, en un botón redondo que no compite con el dato. `tono="noche"`
 * es la cápsula negra que va sobre un campo de color.
 */
export function MenuOpciones({
  etiqueta,
  tono = 'superficie',
  children,
}: {
  etiqueta: string
  tono?: 'superficie' | 'noche'
  children: ReactNode
}) {
  const { t } = useTranslation()
  const nombre = `${t('comunes.acciones')}: ${etiqueta}`
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={nombre}
          title={t('comunes.acciones')}
          className={cn(
            'realce grid size-11 cursor-pointer place-items-center rounded-full transition-transform duration-(--duration-micro) ease-(--ease-ui) active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:active:scale-100 sm:size-10 sm:pointer-coarse:size-11',
            tono === 'noche' ? 'bg-capsula text-white shadow-(--shadow-capsula)' : 'capsula-clara text-foreground',
          )}
        >
          <Ellipsis aria-hidden className="size-5" />
        </button>
      </MenuTrigger>
      <MenuContent
        aria-label={nombre}
        className="max-h-[min(30rem,var(--radix-dropdown-menu-content-available-height))] w-72 max-w-[calc(100vw-24px)] overflow-y-auto"
      >
        {children}
      </MenuContent>
    </Menu>
  )
}

/**
 * Un secreto que se muestra una sola vez: bloque negro, letra de ancho fijo para distinguir
 * «l», «1» e «I», y su botón de copiar.
 */
export function BloqueSecreto({
  valor,
  testId,
  copiado,
  textoCopiar,
  textoCopiado,
  onCopiar,
}: {
  valor: string | undefined
  testId: string
  copiado: boolean
  textoCopiar: string
  textoCopiado: string
  onCopiar: () => void
}) {
  return (
    <div className="rounded-(--radius-card) bg-capsula p-1.5 text-white shadow-(--shadow-capsula)">
      <code
        data-testid={testId}
        className="block select-all px-3 pb-3 pt-2.5 text-[15px] leading-6 [font-family:ui-monospace,Menlo,Consolas,monospace] [overflow-wrap:anywhere]"
      >
        {valor}
      </code>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCopiar}
        className="w-full bg-white text-capsula hover:text-capsula"
      >
        {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copiado ? textoCopiado : textoCopiar}
      </Button>
    </div>
  )
}

/** Todavía no hay nada: el vacío es el propio gesto de crear el primero. */
export function BloqueVacio({
  titulo,
  detalle,
  accion,
  onAccion,
}: {
  titulo: string
  detalle: string
  accion: string
  onAccion: () => void
}) {
  return (
    <div role="status" className="animate-fade flex min-h-[320px] flex-1">
      <button
        type="button"
        onClick={onAccion}
        className="group realce flex w-full cursor-pointer flex-col justify-between gap-8 rounded-(--radius-card) border border-dashed border-border-strong p-6 text-left text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-8"
      >
        <span className="grid size-14 place-items-center rounded-full bg-capsula text-white shadow-(--shadow-capsula) transition-transform duration-(--duration-ui) ease-(--ease-out-soft) group-hover:rotate-90 motion-reduce:group-hover:rotate-0">
          <Plus aria-hidden className="size-6" />
        </span>
        <span className="block">
          <span className="block text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.04em]">{titulo}</span>
          <span className="mt-2 block max-w-md text-[15px] leading-6 text-muted">{detalle}</span>
          <span className="mt-4 inline-flex text-[15px] font-semibold text-primary">{accion}</span>
        </span>
      </button>
    </div>
  )
}

/**
 * La frase bajo el título: responde en palabras de botica la pregunta de la pantalla («5 personas
 * con acceso»). Va en lugar de una fila de indicadores.
 */
export function FrasePantalla({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p
      className={cn(
        'max-w-[52ch] text-[clamp(1.125rem,1rem+0.5vw,1.5rem)] leading-[1.3] font-medium tracking-[-0.018em] text-muted text-pretty',
        className,
      )}
    >
      {children}
    </p>
  )
}

/** Una cifra dentro de esa frase: rueda al cambiar. Para `<Trans components={{ n: <CifraFrase … /> }}>`. */
export function CifraFrase({ valor }: { valor: number }) {
  return (
    <strong className="nums font-semibold text-foreground">
      <NumeroAnimado valor={valor.toLocaleString(localeActual())} />
    </strong>
  )
}
