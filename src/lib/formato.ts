import i18n from '@/infrastructure/i18n'

/**
 * Formato de fechas ligado al idioma del interfaz.
 *
 * Las tablas llamaban a `toLocaleString('es-PE')` con el locale escrito a mano.
 * Con el interfaz en inglés eso producía documentos mixtos —cabeceras en inglés
 * y «14/03/2026, 8:05:12 p. m.» en las celdas— y, peor para una auditoría,
 * fechas en formato día/mes que un lector angloparlante interpreta al revés.
 */
export function localeActual(): string {
  return i18n.resolvedLanguage === 'en' ? 'en-US' : 'es-PE'
}

/** ISO date for date-only forms, derived from the user's local calendar day. */
export function fechaISOlocal(fecha = new Date()): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/**
 * La hora y su «a. m.» / «AM» van juntas: en celdas estrechas el navegador
 * cortaba «9:50:40 a.» en una línea y «m.» en la siguiente.
 */
function horaSinCortes(texto: string): string {
  return texto
    .replace(/(\d:\d{2}(?::\d{2})?)\s+([ap]\.)\s*(m\.)/gi, '$1\u00a0$2\u00a0$3')
    .replace(/(\d:\d{2}(?::\d{2})?)\s+([AP]M)\b/g, '$1\u00a0$2')
}

/** Fecha y hora completas, para celdas de tabla y registros de auditoría. */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return horaSinCortes(fecha.toLocaleString(localeActual()))
}

/** Solo la hora, con segundos: el eje temporal del monitoreo en vivo. */
export function hora(iso: string): string {
  return horaSinCortes(
    new Date(iso).toLocaleTimeString(localeActual(), {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  )
}

/** Solo la fecha, sin hora: encabezados de periodo y resúmenes. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleDateString(localeActual())
}

/** HU-35: duración de una apertura de puerta en "M:SS" — formato de reloj,
 * no traducible por diseño (igual que "3:20" en cualquier reproductor), así
 * que no depende de `i18n` a diferencia del resto de este módulo. */
export function duracionBreve(segundos: number): string {
  const total = Math.max(0, Math.round(segundos))
  const minutos = Math.floor(total / 60)
  const resto = total % 60
  return `${minutos}:${String(resto).padStart(2, '0')}`
}
