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
        <div aria-hidden className="superficie min-h-[300px] p-6 sm:min-h-[240px]">
          <div className="esqueleto h-4 w-40 rounded" />
          <div className="esqueleto mt-8 h-14 w-52 rounded-md" />
          <div className="esqueleto mt-5 h-4 w-64 max-w-full rounded" />
        </div>
        <div aria-hidden className="grid grid-cols-2 gap-4">
          {[0, 1].map(key => <div key={key} className="superficie h-28 p-5"><div className="esqueleto h-4 w-32 rounded" /><div className="esqueleto mt-5 h-9 w-28 rounded-md" /></div>)}
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
        className="flex flex-col items-center gap-2 py-10 text-center sm:py-12"
      >
        <span className="mb-1 flex size-11 items-center justify-center rounded-xl border border-border bg-surface-sunken text-faint shadow-(--shadow-card)">
          <Icono className="size-5" />
        </span>
        <p className="text-[15px] font-medium text-foreground">{titulo}</p>
        {detalle && <p className="max-w-sm text-sm leading-5 text-muted">{detalle}</p>}
        {children}
      </CardContent>
    </Card>
  )
}

export function EstadoError({ mensaje, children }: { mensaje: string; children?: React.ReactNode }) {
  return (
    <Card className="animate-rise border-clay-200 bg-clay-100/60">
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
