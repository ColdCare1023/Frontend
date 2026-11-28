import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Hourglass, OctagonAlert, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/utils'

/** `sinDatos` es un estado operativo, no un riesgo: acero y reloj de arena (DIRECTION §3/§14). */
export type TonoSegmento = 'neutro' | 'vivo' | 'aviso' | 'critico' | 'sinDatos'

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
  sinDatos: 'text-nodata-700',
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
  resumir = false,
  apilarGuia = false,
  ajustarTexto = false,
  className,
}: {
  resumir?: boolean
  segmentos: readonly SegmentoTira[]
  etiqueta: string
  guia?: React.ReactNode
  /**
   * Bajo 1440 px la guía ocupa su propia fila y los segmentos se reparten la
   * siguiente. Sin esto, entre 640 y 1439 px la guía y los segmentos no caben
   * en una fila y el último segmento queda huérfano en otra, con medio borde.
   */
  apilarGuia?: boolean
  /**
   * Etiquetas y valores pasan a otra línea en vez de cortarse con «…». Para
   * tiras cuyos valores son palabras (estados), no cifras: entre 640 y 1279 px
   * los segmentos miden ~145 px y un estado con icono no cabe en una línea.
   */
  ajustarTexto?: boolean
  className?: string
}) {
  // Con algún «detalle» (tercera línea), los segmentos se alinean arriba: si
  // no, el valor del que lo lleva quedaba más alto que el de sus vecinos.
  const { t } = useTranslation()
  const id = useId()
  const [ampliado, setAmpliado] = useState(false)
  // La primera cifra y cualquier incidencia siguen visibles en la vista resumida.
  const principales = segmentos.filter((s, indice) =>
    indice === 0 || s.tono === 'critico' || s.tono === 'aviso' || s.tono === 'sinDatos',
  )
  const puedeResumir = resumir && principales.length < segmentos.length
  const visibles = puedeResumir && !ampliado ? principales : segmentos
  const conDetalle = segmentos.some((s) => s.detalle)
  return (
    <section aria-label={etiqueta} className={cn('superficie overflow-hidden', className)}>
      <div className="-mt-px -ml-px flex flex-wrap">
        {guia && (
          <p
            className={cn(
              'flex min-h-16 min-w-0 basis-full items-center border-t border-l border-border px-4 py-3 text-body text-subtle',
              apilarGuia ? 'min-[1440px]:basis-auto min-[1440px]:max-w-sm' : 'sm:basis-auto sm:max-w-sm',
            )}
          >
            {guia}
          </p>
        )}
        <dl id={id} className="contents">
          {visibles.map(({ clave, etiqueta: texto, valor, tono = 'neutro', detalle, className: claseSegmento }) => (
            <div
              key={clave}
              data-tono={tono}
              className={cn(
                'flex min-h-16 min-w-0 flex-[1_1_8rem] flex-col border-t border-l border-border px-4 py-2.5',
                conDetalle ? 'justify-start' : 'justify-center',
                apilarGuia ? 'min-[1440px]:flex-none' : 'sm:flex-none',
                resumir ? undefined : claseSegmento,
              )}
            >
              <dt className={cn('text-meta font-medium text-muted', ajustarTexto ? 'text-pretty break-words' : 'truncate')}>{texto}</dt>
              <dd className={cn('nums flex gap-1.5 text-page', ajustarTexto ? 'items-start' : 'items-center', VALOR[tono])}>
                {/* Con varias líneas, el icono se alinea con la primera (línea de 28 px, icono de 16). */}
                {tono === 'critico' && <OctagonAlert aria-hidden className={cn('size-4 shrink-0', ajustarTexto && 'mt-1.5')} />}
                {tono === 'aviso' && <TriangleAlert aria-hidden className={cn('size-4 shrink-0', ajustarTexto && 'mt-1.5')} />}
                {tono === 'sinDatos' && <Hourglass aria-hidden className={cn('size-4 shrink-0', ajustarTexto && 'mt-1.5')} />}
                <span className={cn('min-w-0', ajustarTexto ? 'text-pretty break-words' : 'truncate')}>{valor}</span>
              </dd>
              {detalle && <dd className="truncate text-meta text-faint">{detalle}</dd>}
            </div>
          ))}
        </dl>
        {puedeResumir && (
          <button type="button" aria-controls={id} aria-expanded={ampliado} onClick={() => setAmpliado(!ampliado)}
            className="ml-auto inline-flex min-h-11 items-center gap-2 self-center rounded-lg px-4 text-meta font-medium text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            {t(ampliado ? 'comunes.ocultarDetalles' : 'lectura.indicadores')}
            <ChevronDown aria-hidden className={cn('size-4', ampliado && 'rotate-180')} />
          </button>
        )}
      </div>
    </section>
  )
}
