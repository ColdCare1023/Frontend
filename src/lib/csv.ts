/**
 * FE-010: celdas CSV para hojas de cálculo (CWE-1236).
 *
 * Excel y LibreOffice evalúan como fórmula una celda que empieza por `=`,
 * `+`, `-` o `@` (también sus variantes de ancho completo) y tratan un
 * tabulador o retorno de carro inicial de la misma forma. Los campos de TEXTO
 * con ese inicio se prefijan con una comilla simple, que la hoja muestra como
 * texto. Los NÚMEROS que serializa el propio sistema no se tocan: prefijar
 * `-3.5` lo convertiría en texto y alteraría la evidencia exportada.
 */
const INICIO_FORMULA = /^[\t\r\n]|^\s*[=+\-@＝＋－＠]/
const REQUIERE_COMILLAS = /[";\r\n]/

function escapar(valor: string): string {
  return REQUIERE_COMILLAS.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor
}

/** Campo de texto (dato de usuario o de dispositivo): neutralizado y escapado. */
export function textoCsv(valor: string): string {
  return escapar(INICIO_FORMULA.test(valor) ? `'${valor}` : valor)
}

/** Número generado por el sistema: se exporta tal cual (o vacío si falta). */
export function numeroCsv(valor: number | null | undefined, decimales: number): string {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor.toFixed(decimales) : ''
}
