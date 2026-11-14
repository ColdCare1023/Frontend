import { useTranslation } from 'react-i18next'
import { CircleAlert, Loader } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent } from './ui/card'
import { IlustracionVacia, type VarianteIlustracion } from './ui/ilustracion-vacia'

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
      className={cn('flex items-center gap-2 py-8 text-body text-muted', className)}
    >
      <Loader className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      {texto ?? t('app.cargando')}
    </p>
  )
}

/**
 * Estado vacío compacto y alineado a la izquierda (DIRECTION §13.6, 21st
 * Empty States): ilustración de instrumento a la izquierda, texto a la
 * derecha, alto máximo de 160 px. Lleva una acción (children) y, si existe,
 * un dato de contexto (p. ej. la última alerta atendida). Sin `ilustracion`,
 * usa el icono en línea, sin baldosa de color.
 */
export function EstadoVacio({
  icono: Icono,
  ilustracion,
  titulo,
  detalle,
  contexto,
  className,
  children,
}: {
  icono?: React.ComponentType<{ className?: string }>
  ilustracion?: VarianteIlustracion
  titulo: string
  detalle?: string
  contexto?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Card className={cn('animate-(--animate-swap)', className)}>
      <CardContent role="status" className="flex max-h-40 items-center gap-4 p-4 sm:gap-5 sm:px-5">
        {ilustracion ? (
          <IlustracionVacia variante={ilustracion} />
        ) : (
          Icono && <Icono aria-hidden className="size-6 shrink-0 text-faint" />
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-title text-foreground">{titulo}</p>
          {detalle && <p className="max-w-prose text-body text-muted">{detalle}</p>}
          {contexto && <div className="text-meta text-faint">{contexto}</div>}
          {children && <div className="flex flex-wrap items-center gap-2 pt-1">{children}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export function EstadoError({ mensaje, children }: { mensaje: string; children?: React.ReactNode }) {
  return (
    <Card className="animate-(--animate-swap) border-danger-200 bg-danger-50">
      <CardContent role="alert" className="flex items-start gap-3 p-4">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger-700" aria-hidden />
        <div>
          <p className="text-body text-danger-700">{mensaje}</p>
          {children}
        </div>
      </CardContent>
    </Card>
  )
}
