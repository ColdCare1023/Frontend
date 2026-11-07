import type { EChartsCoreOption } from 'echarts/core'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { construirOpcionCurvaTermica, type EtiquetasCurvaTermica } from '@/infrastructure/charts/curvaTermica'
import { temaGrafica, type TemaGrafica } from '@/infrastructure/charts/temaColdCare'

type Colores = ReturnType<typeof temaGrafica>

/** La tinta del papel: lo mismo que el tema claro, con la rejilla del color de los renglones. */
const TINTA: Colores = {
  foreground: '#0F172A',
  muted: '#5A6A80',
  surface: '#FBFAF4',
  raised: '#FFFFFF',
  border: '#CFDBE8',
  borderStrong: '#B4C2D3',
  grid: '#E6EBF1',
  primary: '#0B5CFF',
  secondary: '#08738F',
  safe: '#008EAF',
  safeText: '#07546A',
  critical: '#B42318',
  criticalSolid: '#D92D20',
  equipos: ['#0B5CFF', '#008EAF', '#E75A85', '#DC6803'],
}

/** Una serie de miles de puntos no tiene colores: no hace falta recorrerla. */
function esSoloDatos(lista: unknown[]) {
  const primero = lista[0]
  return typeof primero === 'number' || (Array.isArray(primero) && typeof primero[0] === 'number')
}

interface Tintas {
  general: Map<string, string>
  /** Banda del rango: el cian de la línea de noche pasa aquí a su cian de día, más su rótulo legible. */
  rango: string
  rotuloRango: string
  cianNoche: string
}

function repintar(valor: unknown, tintas: Tintas, contexto: 'general' | 'rango' | 'rotuloRango'): unknown {
  if (typeof valor === 'string') {
    const clave = valor.toLowerCase()
    if (contexto !== 'general' && clave === tintas.cianNoche) return contexto === 'rango' ? tintas.rango : tintas.rotuloRango
    return tintas.general.get(clave) ?? valor
  }
  if (Array.isArray(valor)) return esSoloDatos(valor) ? valor : valor.map((v) => repintar(v, tintas, contexto))
  if (valor && typeof valor === 'object') {
    const copia: Record<string, unknown> = {}
    for (const [clave, interior] of Object.entries(valor)) {
      // El tooltip flota sobre la hoja y arma su HTML con los colores del tema: se queda como está.
      if (clave === 'tooltip') copia[clave] = interior
      else if (clave === 'markArea' || clave === 'markLine') copia[clave] = repintar(interior, tintas, 'rango')
      else if (clave === 'label' && contexto === 'rango') copia[clave] = repintar(interior, tintas, 'rotuloRango')
      else copia[clave] = repintar(interior, tintas, contexto)
    }
    return copia
  }
  return valor
}

/**
 * La curva de siempre, con tinta de papel. El papel no cambia de noche, pero `temaGrafica` lee los
 * tokens de la raíz y de noche daría texto casi blanco sobre papel: en oscuro se sustituye cada color
 * del tema por su tinta. No se toca la raíz para leerlos, porque arrancaría sus transiciones.
 */
export function opcionCurvaSobrePapel(
  serie: LecturaTermica[],
  etiquetas: EtiquetasCurvaTermica,
  tema: TemaGrafica,
): EChartsCoreOption {
  const opcion = construirOpcionCurvaTermica(serie, etiquetas, undefined, tema)
  if (tema !== 'dark') return opcion

  const oscuro = temaGrafica('dark')
  const general = new Map<string, string>()
  // De noche varios tokens comparten valor: gana el primero. `grid` antes que `raised` (el tooltip no
  // pasa por aquí) y `primary` antes que `safe` (fuera de la banda, ese cian es la línea).
  const orden: Array<keyof Omit<Colores, 'equipos'>> = [
    'foreground',
    'muted',
    'surface',
    'border',
    'borderStrong',
    'grid',
    'primary',
    'secondary',
    'critical',
    'criticalSolid',
  ]
  for (const clave of orden) {
    const color = oscuro[clave].toLowerCase()
    if (!general.has(color)) general.set(color, TINTA[clave])
  }
  oscuro.equipos.forEach((color, i) => {
    if (!general.has(color.toLowerCase())) general.set(color.toLowerCase(), TINTA.equipos[i] ?? TINTA.primary)
  })
  const tintas: Tintas = { general, rango: TINTA.safe, rotuloRango: TINTA.safeText, cianNoche: oscuro.safe.toLowerCase() }
  return repintar(opcion, tintas, 'general') as EChartsCoreOption
}
