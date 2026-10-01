import { useTranslation } from 'react-i18next'
import { CircleAlert, Loader } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent } from './ui/card'

/**
 * Estados de carga, vacío y error compartidos por las 12 páginas.
 *
 * Antes cada pantalla los resolvía a su manera: unas con `TableEmpty`, otras
 * con un `<p>` suelto sin rol, otras sin estado vacío. El resultado era que la
 * misma situación —«no hay nada que mostrar»— se veía distinta según la
 * sección y, en la mitad de los casos, no se anunciaba a un lector de pantalla.
 *
 * Los tres comparten la misma caja para que el salto entre estados no mueva el
 * contenido de sitio, y todos declaran su rol: `status` para carga y vacío
 * (WCAG 4.1.3), `alert` para el error, que sí interrumpe.
 */
export function EstadoCarga({ texto, className, variant = 'inline', children }: { texto?: string; className?: string; variant?: 'inline' | 'dashboard'; children?: React.ReactNode }) {
  const { t } = useTranslation()
  if (variant === 'dashboard') {
    return (
      <div role="status" className={cn('space-y-4', className)}>
        <span className="sr-only">{texto ?? t('app.cargando')}</span>
        <div aria-hidden className="min-h-[300px] sm:min-h-[240px] rounded-(--radius-card) border border-border bg-surface p-6">
          <div className="h-4 w-40 rounded bg-cream-200" />
          <div className="mt-8 h-14 w-52 rounded bg-cream-200" />
          <div className="mt-5 h-4 w-64 max-w-full rounded bg-cream-200" />
        </div>
        <div aria-hidden className="grid grid-cols-2 gap-4">
          {[0, 1].map(key => <div key={key} className="h-28 rounded-(--radius-card) border border-border bg-surface p-5"><div className="h-4 w-32 rounded bg-cream-200" /><div className="mt-5 h-9 w-28 rounded bg-cream-200" /></div>)}
        </div>
        {children}
      </div>
    )
  }
  return (
    <p
      role="status"
      className={cn('animate-fade flex items-center gap-2 py-8 text-sm text-muted', className)}
    >
      <Loader className="size-4 animate-spin" aria-hidden />
      {texto ?? t('app.cargando')}
    </p>
  )
}

export function EstadoVacio({
  icono: Icono,
  titulo,
  detalle,
  children,
}: {
  icono: React.ComponentType<{ className?: string }>
  titulo: string
  detalle?: string
  children?: React.ReactNode
}) {
  return (
    <Card className="animate-rise">
      <CardContent
        role="status"
        className="flex flex-col items-center gap-3 py-9 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-cream-200 text-faint">
          <Icono className="size-6" />
        </span>
        <p className="font-medium text-foreground">{titulo}</p>
        {detalle && <p className="max-w-sm text-sm text-muted">{detalle}</p>}
        {children}
      </CardContent>
    </Card>
  )
}

export function EstadoError({ mensaje, children }: { mensaje: string; children?: React.ReactNode }) {
  return (
    <Card className="animate-rise border-clay-100 bg-clay-100/50">
      <CardContent role="alert" className="flex items-start gap-3 p-5">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-clay-700" aria-hidden />
        <div>
          <p className="text-sm leading-relaxed text-clay-700">{mensaje}</p>
          {children}
        </div>
      </CardContent>
    </Card>
  )
}
