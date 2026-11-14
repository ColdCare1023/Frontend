import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, KeyRound, ShieldAlert, TriangleAlert } from 'lucide-react'

import type { CredencialRotada } from '@/domain/entities/Dispositivo'
import { cn } from '@/lib/utils'
import { Button } from '../../components/ui/button'
import { ICONO_EQUIPO, TEXTO_EQUIPO, type EstadoVisual } from './estadoEquipo'

export type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null

/** Resultado de un formulario: `status` si salió bien, `alert` si falló. */
export function MensajeFormulario({ mensaje, className }: { mensaje: Mensaje; className?: string }) {
  if (!mensaje) return null
  return (
    <p
      role={mensaje.tipo === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-(--radius-field) px-3 py-2 text-meta',
        mensaje.tipo === 'ok' ? 'bg-success-100 text-success-700' : 'bg-critical-tint text-critical',
        className,
      )}
    >
      {mensaje.tipo === 'ok' && <Check aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
      {mensaje.texto}
    </p>
  )
}

/** Par «etiqueta — valor» dentro de un `dl`. */
export function Dato({ etiqueta, children, className }: { etiqueta: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 py-2', className)}>
      <dt className="text-meta text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-body text-foreground">{children}</dd>
    </div>
  )
}

/** Tarjeta de una pestaña: superficie plana con su título. */
export function Tarjeta({
  titulo,
  icono: Icono,
  accion,
  className,
  children,
  id,
}: {
  titulo: ReactNode
  icono?: React.ComponentType<{ className?: string }>
  accion?: ReactNode
  className?: string
  children: ReactNode
  id?: string
}) {
  const idTitulo = id ? `${id}-titulo` : undefined
  return (
    <section aria-labelledby={idTitulo} className={cn('superficie min-w-0 p-4 xl:p-5', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={idTitulo} className="flex items-center gap-2 text-title text-foreground">
          {Icono && <Icono aria-hidden className="size-4 text-muted" />}
          {titulo}
        </h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

/** Icono de forma propia por estado (el texto siempre lo acompaña). */
export function IconoEquipo({ estado, className }: { estado: EstadoVisual; className?: string }) {
  const Icono = ICONO_EQUIPO[estado]
  return <Icono aria-hidden className={cn('shrink-0', TEXTO_EQUIPO[estado], className)} />
}

/** Aviso en línea con su ayuda visible (Seguridad) o en `title` (fila). */
export function Aviso({ tono, children, ayuda, className }: { tono: 'warn' | 'critical'; children: ReactNode; ayuda?: ReactNode; className?: string }) {
  const Icono = tono === 'critical' ? ShieldAlert : TriangleAlert
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-(--radius-field) px-3 py-2 text-meta',
        tono === 'critical' ? 'bg-critical-tint text-critical' : 'bg-warning-100 text-warning-700',
        className,
      )}
    >
      <Icono aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium">{children}</p>
        {ayuda && <div className="mt-0.5 opacity-90">{ayuda}</div>}
      </div>
    </div>
  )
}

/**
 * FE-003: el token emitido (alta o rotación) se muestra UNA vez, aquí. No se
 * persiste ni se registra; quien lo monta lo descarta al pulsar «Listo».
 */
export function RevelarToken({
  credencial,
  alTerminar,
  textoTerminar,
}: {
  credencial: CredencialRotada
  alTerminar: () => void
  textoTerminar?: string
}) {
  const { t } = useTranslation()
  const [copiado, setCopiado] = useState(false)
  const copiar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    copiar.current?.focus()
  }, [])

  const copiarToken = async () => {
    try {
      await navigator.clipboard.writeText(credencial.token)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="space-y-3 animate-(--animate-pop-in)">
      <div>
        <p className="text-title text-foreground">{t('dispositivos.tokenTitulo')}</p>
        <p className="mt-1 text-meta text-muted">{t('dispositivos.tokenAdvertencia')}</p>
      </div>
      <code
        data-testid="token-rotado"
        className="codigo block break-all rounded-(--radius-field) border border-border bg-surface-sunken px-3 py-2 font-mono text-sm select-all"
      >
        {credencial.token}
      </code>
      {credencial.mensaje_broker && (
        <p role="alert" className="rounded-(--radius-field) bg-warning-100 px-3 py-2 text-meta text-warning-700">
          {credencial.mensaje_broker}
        </p>
      )}
      <p role="status" className="text-meta text-muted">
        {t('dispositivos.credencialRotada')}{' '}
        {credencial.sesion_broker_cerrada === true
          ? t('dispositivos.sesionBrokerCerrada')
          : credencial.sesion_broker_cerrada === false
            ? t('dispositivos.sesionBrokerNoCerrada')
            : t('dispositivos.sesionBrokerSinApi')}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button ref={copiar} variant="secondary" onClick={() => void copiarToken()} aria-live="polite">
          <KeyRound />
          {t(copiado ? 'dispositivos.tokenCopiado' : 'dispositivos.copiarToken')}
        </Button>
        <Button variant="ghost" onClick={alTerminar}>{textoTerminar ?? t('dispositivos.seguridadTab.tokenListo')}</Button>
      </div>
    </div>
  )
}

/** Pie de formulario en línea: fijo abajo en móvil, botones de 44 px. */
export function PieFormulario({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-2 pt-1 max-sm:sticky max-sm:bottom-0 max-sm:-mx-4 max-sm:border-t max-sm:border-border max-sm:bg-surface max-sm:px-4 max-sm:py-3">
      {children}
    </div>
  )
}
