import { cn } from '@/lib/utils'
import type { TonoCampo } from './estadoEquipo'
import './campo.css'

const TONOS: TonoCampo[] = ['rango', 'frio', 'cerca', 'preventivo', 'critico', 'sinDatos']

/**
 * El fondo de un campo: una capa por color. Cambiar de estado funde una con otra usando solo
 * opacidad, sin repintar toda la superficie cuadro a cuadro.
 */
export function CapasColor({ tono }: { tono: TonoCampo }) {
  return (
    <span aria-hidden className="capas-color">
      {TONOS.map((capa) => (
        <span key={capa} className="capas-color__capa" data-capa={capa} data-activa={capa === tono ? '' : undefined} />
      ))}
    </span>
  )
}

/**
 * Regla de 0 a 10 °C en el borde inferior del campo, con la zona 2–8 °C marcada. La marca se mueve
 * con `transform`: una lectura nueva no obliga a recalcular nada.
 */
export function BandaRango({ valor, title, className }: { valor: number | null; title?: string; className?: string }) {
  const posicion = valor != null && Number.isFinite(valor) ? Math.max(0, Math.min(100, valor * 10)) : null
  return (
    <div aria-hidden className={cn('banda-campo', className)} title={title}>
      <span className="banda-campo__pista" />
      <span className="banda-campo__zona" />
      <span className="banda-campo__cota" style={{ left: '20%' }}>2°</span>
      <span className="banda-campo__cota" style={{ left: '80%' }}>8°</span>
      {posicion != null && (
        <span className="banda-campo__recorrido" style={{ transform: `translateX(${posicion}%)` }}>
          <span className="banda-campo__marca" />
        </span>
      )}
    </div>
  )
}
