import { cn } from '@/lib/utils'
import { TiraEstado, type SegmentoTira, type TonoSegmento } from '@/presentation/components/ui/tira-estado'

export type TonoCifra = TonoSegmento
export type CifraResumen = SegmentoTira

/**
 * Totales de una pantalla. Desde P2 son una tira de estado (DIRECTION §5.1)
 * en vez de una grilla de tarjetas iguales estiradas a todo el ancho. Mismas
 * props que antes; `guia` añade la frase delante.
 */
export function CifrasResumen({
  cifras,
  etiqueta,
  guia,
  className,
}: {
  cifras: CifraResumen[]
  etiqueta: string
  guia?: React.ReactNode
  className?: string
}) {
  return <TiraEstado segmentos={cifras} etiqueta={etiqueta} guia={guia} className={cn('mb-4 sm:mb-5', className)} />
}
