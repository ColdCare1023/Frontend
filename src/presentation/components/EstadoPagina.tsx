import { useTranslation } from 'react-i18next'
import { CircleAlert, Loader } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'

/**
 * Estados compartidos por todas las pantallas. Declaran su rol: `status` para carga y
 * vacío (WCAG 4.1.3), `alert` para el error, que sí interrumpe.
 */

/** Carga: una línea con indicador o, con `variant`, el esqueleto del contenido que viene. */
export function EstadoCarga({ texto, className, variant = 'inline', children }: { texto?: string; className?: string; variant?: 'inline' | 'dashboard' | 'tabla'; children?: React.ReactNode }) {
  const { t } = useTranslation()
  if (variant === 'dashboard') {
    return (
      <div role="status" className={cn('space-y-4', className)}>
        <span className="sr-only">{texto ?? t('app.cargando')}</span>
        <div aria-hidden className="superficie min-h-[300px] p-6 sm:min-h-[240px]">
          <div className="esqueleto h-4 w-40 rounded" />
          <div className="esqueleto mt-8 h-14 w-52 rounded-md" />
          <div className="esqueleto mt-5 h-4 w-64 max-w-full rounded" />
        </div>
        <div aria-hidden className="grid grid-cols-2 gap-4">
          {[0, 1].map((key) => <div key={key} className="superficie h-28 p-5"><div className="esqueleto h-4 w-32 rounded" /><div className="esqueleto mt-5 h-9 w-28 rounded-md" /></div>)}
        </div>
        {children}
      </div>
    )
  }
  if (variant === 'tabla') {
    return (
      <div role="status" className={cn('superficie overflow-hidden', className)}>
        <span className="sr-only">{texto ?? t('app.cargando')}</span>
        <div aria-hidden className="divide-y divide-border">
          {[72, 88, 64, 80, 56].map((ancho) => (
            <div key={ancho} className="flex h-11 items-center gap-6 px-4">
              <div className="esqueleto h-3.5 rounded" style={{ width: `${ancho * 0.4}%` }} />
              <div className="esqueleto h-3.5 flex-1 rounded" />
              <div className="esqueleto h-3.5 w-16 rounded" />
            </div>
          ))}
        </div>
        {children}
      </div>
    )
  }
  return (
    <p role="status" className={cn('animate-fade flex items-center gap-2 py-8 text-sm text-muted', className)}>
      <Loader className="size-4 animate-spin" aria-hidden />
      {texto ?? t('app.cargando')}
    </p>
  )
}

/** Vacío: dice qué falta y, en `children`, qué se puede hacer. `llenar` ocupa el alto libre. */
export function EstadoVacio({
  icono: Icono,
  titulo,
  detalle,
  llenar = false,
  children,
}: {
  icono: React.ComponentType<{ className?: string }>
  titulo: string
  detalle?: string
  /** Ocupa toda la altura disponible, sin dejar un hueco debajo. */
  llenar?: boolean
  children?: React.ReactNode
}) {
  return (
    <Card className={cn('animate-fade flex flex-col', llenar && 'flex-1')}>
      <CardContent role="status" className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center sm:py-16">
        <Icono className="mb-2 size-7 text-faint" />
        <p className="text-lg leading-6 font-semibold tracking-[-0.015em] text-foreground">{titulo}</p>
        {detalle && <p className="max-w-sm text-sm leading-5 text-muted">{detalle}</p>}
        {children && <div className="mt-3 flex flex-wrap justify-center gap-2">{children}</div>}
      </CardContent>
    </Card>
  )
}

/** Error: el mensaje, con `onReintentar` para el botón habitual o `children` para otra salida. */
export function EstadoError({ mensaje, onReintentar, children }: { mensaje: string; onReintentar?: () => void; children?: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <Card className="animate-fade border-critical/30">
      <CardContent role="alert" className="flex items-start gap-3 p-5 sm:px-5 sm:pb-5">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm leading-6 font-medium text-foreground">{mensaje}</p>
          {onReintentar && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={onReintentar}>
              {t('comunes.reintentar')}
            </Button>
          )}
          {children}
        </div>
      </CardContent>
    </Card>
  )
}
