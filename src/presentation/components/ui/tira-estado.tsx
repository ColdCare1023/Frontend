import { OctagonAlert, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/utils'

export type TonoSegmento = 'neutro' | 'vivo' | 'aviso' | 'critico'

export interface SegmentoTira {
  clave: string
  etiqueta: React.ReactNode
  valor: React.ReactNode
  /** El tono acompaña al valor con un icono de forma propia; nunca solo color. */
  tono?: TonoSegmento
  detalle?: React.ReactNode
  /** Clases del segmento (p. ej. ocultarlo bajo cierto ancho). */
  className?: string
}

const VALOR: Record<TonoSegmento, string> = {
  neutro: 'text-foreground',
  vivo: 'text-foreground',
  aviso: 'text-warning-700',
  critico: 'text-critical',
}

/**
 * Tira de estado (DIRECTION §5.1): sustituye la grilla de tarjetas KPI
 * idénticas. Una franja con hairline de 64 px, segmentos de ancho automático
 * separados por divisores de 1 px —nada se estira para llenar— y, delante,
 * una frase guía opcional («1 de 2 equipos sin datos desde 09:37»).
 *
 * Es una lista de definiciones: el lector de pantalla lee «Equipos, 2».
 */
export function TiraEstado({
  segmentos,
  etiqueta,
  guia,
  className,
}: {
  segmentos: readonly SegmentoTira[]
  etiqueta: string
  guia?: React.ReactNode
  className?: string
}) {
  return (
    <section aria-label={etiqueta} className={cn('superficie overflow-hidden', className)}>
      <div className="-mt-px -ml-px flex flex-wrap">
        {guia && (
          <p className="flex min-h-16 min-w-0 basis-full items-center border-t border-l border-border px-4 py-3 text-body text-subtle sm:basis-auto sm:max-w-sm">
            {guia}
          </p>
        )}
        <dl className="contents">
          {segmentos.map(({ clave, etiqueta: texto, valor, tono = 'neutro', detalle, className: claseSegmento }) => (
            <div
              key={clave}
              data-tono={tono}
              className={cn(
                'flex min-h-16 min-w-0 flex-[1_1_8rem] flex-col justify-center border-t border-l border-border px-4 py-2.5 sm:flex-none',
                claseSegmento,
              )}
            >
              <dt className="truncate text-meta font-medium text-muted">{texto}</dt>
              <dd className={cn('nums flex items-center gap-1.5 text-page', VALOR[tono])}>
                {tono === 'critico' && <OctagonAlert aria-hidden className="size-4 shrink-0" />}
                {tono === 'aviso' && <TriangleAlert aria-hidden className="size-4 shrink-0" />}
                <span className="min-w-0 truncate">{valor}</span>
              </dd>
              {detalle && <dd className="truncate text-meta text-faint">{detalle}</dd>}
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
