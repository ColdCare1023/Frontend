import { cn } from '@/lib/utils'

export type TonoCifra = 'neutro' | 'vivo' | 'aviso' | 'critico'

export interface CifraResumen {
  clave: string
  etiqueta: React.ReactNode
  valor: React.ReactNode
  /** El tono acompaña a la etiqueta; nunca la sustituye. */
  tono?: TonoCifra
  detalle?: React.ReactNode
}

const CIFRA: Record<TonoCifra, string> = {
  neutro: 'text-foreground',
  vivo: 'text-foreground',
  aviso: 'text-warning-700',
  critico: 'text-critical',
}

/**
 * Totales de una pantalla como fichas de instrumento: la etiqueta y la cifra
 * grande, tabular y apretada, como las lecturas de la landing. Es una lista de definiciones: el lector
 * de pantalla lee «Equipos registrados, 2».
 */
export function CifrasResumen({ cifras, etiqueta, className }: { cifras: CifraResumen[]; etiqueta: string; className?: string }) {
  return (
    <section aria-label={etiqueta} className={cn('mb-5', className)}>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
        {cifras.map(({ clave, etiqueta: texto, valor, tono = 'neutro', detalle }) => (
          <div
            key={clave}
            data-tono={tono}
            className={cn(
              'tarjeta-cristal relative flex min-w-0 flex-col rounded-(--radius-card) border px-4 py-3.5 sm:px-5 sm:py-4',
              tono === 'critico' && 'border-critical/30',
              tono === 'aviso' && 'border-warning-600/30',
            )}
          >
            <dt className="min-w-0 text-[13px] leading-[18px] font-medium text-pretty text-muted">{texto}</dt>
            <dd className={cn('nums mt-auto pt-2 text-[30px] leading-none font-semibold tracking-[-0.03em] sm:text-[34px]', CIFRA[tono])}>{valor}</dd>
            {detalle && <dd className="mt-1.5 text-xs leading-4 text-faint">{detalle}</dd>}
          </div>
        ))}
      </dl>
    </section>
  )
}
