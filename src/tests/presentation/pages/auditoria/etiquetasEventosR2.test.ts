import { afterAll, describe, expect, it } from 'vitest'

import i18n from '@/infrastructure/i18n'
import { nombreAccion } from '@/presentation/pages/auditoria/categoriasAuditoria'
import { etiquetaEvento } from '@/presentation/pages/trazabilidad/iconosEvento'

/**
 * HU-43 esc. 4 / HU-44 esc. 3 / HU-13 esc. 2 / HU-35: las acciones nuevas del
 * backend tienen nombre propio en los dos idiomas (antes caían al código
 * humanizado: «Broker operacion sincronizada», sin tilde e igual en inglés).
 */
const ESPERADO = {
  es: {
    BROKER_OPERACION_SINCRONIZADA: 'Operación del broker sincronizada',
    BROKER_OPERACION_FALLIDA: 'Operación del broker fallida',
    PUERTA: 'Cambio de puerta',
    WIFI_RECONEXION_PROLONGADA: 'Reconexión prolongada del equipo',
    DESCONEXION_ORDENADA: 'Desconexión ordenada del equipo',
  },
  en: {
    BROKER_OPERACION_SINCRONIZADA: 'Broker operation synchronized',
    BROKER_OPERACION_FALLIDA: 'Broker operation failed',
    PUERTA: 'Door change',
    WIFI_RECONEXION_PROLONGADA: 'Prolonged device reconnection',
    DESCONEXION_ORDENADA: 'Orderly device disconnection',
  },
} as const

/** HU-42/HU-52/HU-29: resultados de sistema que ahora se registran como fallidos. */
const SOLO_BITACORA = {
  es: { NOTIFICACION_FALLIDA: 'Aviso por correo no enviado', RESPALDO_FALLIDO: 'Respaldo fallido' },
  en: { NOTIFICACION_FALLIDA: 'Email notice not sent', RESPALDO_FALLIDO: 'Backup failed' },
} as const

describe('Etiquetas de las acciones nuevas del backend', () => {
  afterAll(async () => {
    await i18n.changeLanguage('es')
  })

  for (const idioma of ['es', 'en'] as const) {
    it(`en la bitácora y en la trazabilidad (${idioma})`, async () => {
      await i18n.changeLanguage(idioma)
      const t = i18n.t.bind(i18n) as Parameters<typeof nombreAccion>[1]
      for (const [codigo, texto] of Object.entries(ESPERADO[idioma])) {
        expect(nombreAccion(codigo, t)).toBe(texto)
        expect(etiquetaEvento(codigo, t)).toBe(texto)
      }
      for (const [codigo, texto] of Object.entries(SOLO_BITACORA[idioma])) {
        expect(nombreAccion(codigo, t)).toBe(texto)
      }
    })
  }
})
