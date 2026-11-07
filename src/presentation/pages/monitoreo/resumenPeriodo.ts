import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { episodiosDeExcursion, huecosSinDatos, umbralHueco } from '@/infrastructure/charts/curvaTermica'

export type ClavePeriodo =
  | 'dashboard.periodoSinLecturas'
  | 'dashboard.periodoSalio'
  | 'dashboard.periodoSinConfirmar'
  | 'dashboard.periodoHastaUltima'
  | 'dashboard.periodoConHuecos'
  | 'dashboard.periodoHoraBien'
  | 'dashboard.periodoHoyBien'
  | 'dashboard.periodoSemanaBien'

/**
 * La línea del día en una frase. Solo afirma lo que las lecturas sostienen: «todo el día» exige
 * lecturas de punta a punta de la ventana, sin huecos, y ninguna fuera de 2–8 °C. Las salidas se
 * cuentan por episodio confirmado, igual que las franjas rojas de la gráfica, con el mismo umbral
 * de hueco que la curva.
 */
export function fraseDelPeriodo(
  serie: LecturaTermica[],
  ventana: { desde: number; hasta: number },
  horas: number,
  enSilencio: boolean,
): { clave: ClavePeriodo; count?: number } {
  const visibles = serie.filter((lectura) => {
    const ms = Date.parse(lectura.timestamp)
    return ms >= ventana.desde && ms <= ventana.hasta
  })
  const medidas = visibles.filter((lectura) => lectura.temperatura_interna != null && Number.isFinite(lectura.temperatura_interna))
  if (medidas.length === 0) return { clave: 'dashboard.periodoSinLecturas' }

  const umbral = umbralHueco(medidas)
  const veces = episodiosDeExcursion(visibles, umbral).length
  if (veces > 0) return { clave: 'dashboard.periodoSalio', count: veces }

  // Una lectura fuera de 2–8 °C que la regla no confirmó no es una salida, pero tampoco deja decir «dentro del rango».
  const fuera = medidas.some(({ temperatura_interna: t }) => t! < RANGO_TERMICO.minimo || t! > RANGO_TERMICO.maximo)
  if (fuera) return { clave: 'dashboard.periodoSinConfirmar' }
  if (enSilencio) return { clave: 'dashboard.periodoHastaUltima' }

  const primera = Date.parse(medidas[0].timestamp)
  const ultima = Date.parse(medidas[medidas.length - 1].timestamp)
  const completa = primera - ventana.desde < umbral && ventana.hasta - ultima < umbral && huecosSinDatos(medidas, umbral).length === 0
  if (!completa) return { clave: 'dashboard.periodoConHuecos' }
  if (horas <= 1) return { clave: 'dashboard.periodoHoraBien' }
  return { clave: horas <= 24 ? 'dashboard.periodoHoyBien' : 'dashboard.periodoSemanaBien' }
}
