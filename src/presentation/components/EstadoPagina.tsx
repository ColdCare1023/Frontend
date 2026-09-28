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
export function EstadoCarga({ texto, className }: { texto?: string; className?: string }) {
  const { t } = useTranslation()
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
        className="flex flex-col items-center gap-3 py-16 text-center"
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
