import type { TFunction } from 'i18next'

import { perdidasDeBrecha, type BrechaTelemetria, type BufferLittleFS } from '@/domain/entities/Dispositivo'
import { fechaHora } from '@/lib/formato'

/**
 * HU-48 esc. 1: rango temporal de lo que el nodo retiene en LittleFS. Si el
 * firmware no lo informó, el backend lo estima (última lectura persistida →
 * último latido) y se dice. null si no hay pendientes o no hay rango.
 */
export function textoRangoBuffer(buffer: BufferLittleFS | null | undefined, t: TFunction): string | null {
  if (!buffer || buffer.pendientes <= 0 || (!buffer.desde && !buffer.hasta)) return null
  const rango = t('dispositivos.rangoBuffer', {
    desde: fechaHora(buffer.desde),
    hasta: buffer.hasta ? fechaHora(buffer.hasta) : '—',
  })
  return buffer.rango_estimado ? `${rango} (${t('dashboard.rangoEstimado')})` : rango
}

/**
 * HU-48 esc. 2: una brecha por buffer agotado en dos frases: cuántas muestras
 * se perdieron y por qué (con «en curso» si el nodo aún no puede almacenar),
 * y el periodo afectado. Sin hora del nodo, se identifica por arranque y
 * número de muestra en lugar de inventar un periodo.
 */
export function textosBrecha(brecha: BrechaTelemetria, t: TFunction): { resumen: string; periodo: string } {
  const resumen = [
    t('dashboard.brechaBuffer', { n: perdidasDeBrecha(brecha) }),
    t('dashboard.causaBufferAgotado'),
    brecha.abierta ? t('dashboard.brechaEnCurso') : null,
  ]
    .filter(Boolean)
    .join(' · ')
  if (brecha.desde || brecha.hasta) {
    return {
      resumen,
      periodo: t('dashboard.periodoBrecha', {
        desde: fechaHora(brecha.desde),
        hasta: brecha.hasta ? fechaHora(brecha.hasta) : brecha.abierta ? t('dashboard.brechaHastaAhora') : '—',
      }),
    }
  }
  const conSecuencia = brecha.desde_boot_id != null && brecha.desde_seq_no != null
  return {
    resumen,
    periodo: conSecuencia
      ? t('dashboard.periodoBrechaSecuencia', {
          boot: brecha.desde_boot_id,
          desde: brecha.desde_seq_no,
          hasta: brecha.hasta_seq_no ?? '…',
        })
      : t('dashboard.periodoBrechaSinHora'),
  }
}

/** Clave estable de una brecha para listas de React. */
export function claveBrecha(brecha: BrechaTelemetria, indice: number): string {
  return `${brecha.registrada_en ?? ''}|${brecha.desde ?? ''}|${brecha.desde_boot_id ?? ''}-${brecha.desde_seq_no ?? ''}|${indice}`
}
