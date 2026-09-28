/**
 * HU-37: verificación diaria de Buenas Prácticas de Almacenamiento.
 *
 * Los diez ítems provienen del Manual de BPA (RM N.º 132-2015/MINSA). El
 * backend los persiste como columnas con estos mismos nombres, así que el
 * orden y las claves son contrato: cambiarlas rompe el histórico ya guardado.
 */

export const ITEMS_CHECKLIST_BPA = [
  'temperatura',
  'termometro',
  'registros',
  'alertas_revisadas',
  'acciones_documentadas',
  'puerta',
  'limpieza',
  'exclusivo',
  'rotulado',
  'respaldo',
] as const

export type ItemChecklistBPA = (typeof ITEMS_CHECKLIST_BPA)[number]

/**
 * Las traducciones existentes usan camelCase para dos ítems, mientras que las
 * columnas del backend usan snake_case. Se mantiene el mapeo explícito en vez
 * de renombrar: cambiar las claves de i18n rompería las traducciones ya
 * revisadas, y cambiar las del backend rompería los registros persistidos.
 */
const CLAVE_I18N: Record<ItemChecklistBPA, string> = {
  temperatura: 'temperatura',
  termometro: 'termometro',
  registros: 'registros',
  alertas_revisadas: 'alertasRevisadas',
  acciones_documentadas: 'accionesDocumentadas',
  puerta: 'puerta',
  limpieza: 'limpieza',
  exclusivo: 'exclusivo',
  rotulado: 'rotulado',
  respaldo: 'respaldo',
}

export function claveTraduccion(item: ItemChecklistBPA): string {
  return `checklist.items.${CLAVE_I18N[item]}`
}

export type ItemsChecklistBPA = Record<ItemChecklistBPA, boolean>

export interface ChecklistBPA extends ItemsChecklistBPA {
  id: string
  usuario_id: string
  fecha: string
  observaciones: string | null
  total_conformes: number
  conforme: boolean
  created_at: string
  updated_at: string
}

export interface ChecklistBPARequest extends ItemsChecklistBPA {
  fecha: string
  observaciones?: string | null
}
