/**
 * El backend registra y responde todo en UTC, pero no siempre lo declara: con
 * PostgreSQL las fechas llegan con zona («…Z» / «+00:00»), mientras que con
 * SQLite (backend local de desarrollo) llegan «ingenuas», sin zona. El
 * navegador interpreta una fecha sin zona como hora LOCAL, así que en Lima
 * cada lectura aparecía cinco horas desplazada y «hace cuánto» se calculaba
 * mal. Aquí se declara la zona que el backend omitió.
 *
 * Solo se tocan fecha-hora ISO completas sin zona; las fechas sin hora
 * (`2026-12-01`, vencimientos de calibración) son días de calendario y no se
 * alteran.
 */
const FECHA_HORA_SIN_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/

export function normalizarFechasUtc<T>(valor: T): T {
  return normalizar(valor) as T
}

function normalizar(valor: unknown): unknown {
  if (typeof valor === 'string') {
    return FECHA_HORA_SIN_ZONA.test(valor) ? `${valor}Z` : valor
  }
  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) valor[i] = normalizar(valor[i])
  } else if (esObjetoPlano(valor)) {
    for (const clave of Object.keys(valor)) valor[clave] = normalizar(valor[clave])
  }
  return valor
}

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  if (valor === null || typeof valor !== 'object') return false
  const prototipo = Object.getPrototypeOf(valor)
  return prototipo === Object.prototype || prototipo === null
}
