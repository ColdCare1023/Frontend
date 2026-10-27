/**
 * B-12: validador mínimo de cuerpos de petición contra el OpenAPI del backend
 * (src/tests/contrato/openapi-backend.json, generado con
 * `python -m scripts.exportar_openapi` en el repositorio Backend).
 *
 * Cubre lo que usan los esquemas Pydantic del backend: `$ref`, `anyOf`,
 * `type`, `required`, `additionalProperties: false`, `items`, `enum`,
 * `pattern`, `maxLength`/`minLength` y `minimum`/`maximum`.
 */
import openapi from './openapi-backend.json'

type Esquema = Record<string, unknown>
const documento = openapi as unknown as {
  paths: Record<string, Record<string, { requestBody?: { content: Record<string, { schema: Esquema }> } }>>
  components: { schemas: Record<string, Esquema> }
}

function resolver(esquema: Esquema): Esquema {
  const ref = esquema.$ref as string | undefined
  return ref ? resolver(documento.components.schemas[ref.split('/').at(-1)!]) : esquema
}

function tipoDe(valor: unknown): string {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'array'
  if (typeof valor === 'number') return Number.isInteger(valor) ? 'integer' : 'number'
  return typeof valor
}

export function errores(valor: unknown, esquemaCrudo: Esquema, ruta = '$'): string[] {
  const esquema = resolver(esquemaCrudo)
  if (esquema.anyOf) {
    const opciones = (esquema.anyOf as Esquema[]).map((o) => errores(valor, o, ruta))
    return opciones.some((e) => e.length === 0) ? [] : [`${ruta}: no coincide con ninguna opción (${opciones.flat().join('; ')})`]
  }
  const tipo = esquema.type as string | undefined
  const real = tipoDe(valor)
  if (tipo && !(tipo === real || (tipo === 'number' && real === 'integer'))) return [`${ruta}: se esperaba ${tipo}, llegó ${real}`]
  const fallos: string[] = []
  if (esquema.enum && !(esquema.enum as unknown[]).includes(valor)) fallos.push(`${ruta}: valor fuera del enum`)
  if (typeof valor === 'string') {
    if (esquema.pattern && !new RegExp(esquema.pattern as string).test(valor)) fallos.push(`${ruta}: no cumple ${esquema.pattern}`)
    if (typeof esquema.maxLength === 'number' && valor.length > esquema.maxLength) fallos.push(`${ruta}: excede maxLength`)
    if (typeof esquema.minLength === 'number' && valor.length < esquema.minLength) fallos.push(`${ruta}: menor que minLength`)
  }
  if (typeof valor === 'number') {
    if (typeof esquema.minimum === 'number' && valor < esquema.minimum) fallos.push(`${ruta}: menor que minimum`)
    if (typeof esquema.maximum === 'number' && valor > esquema.maximum) fallos.push(`${ruta}: mayor que maximum`)
  }
  if (real === 'array' && esquema.items) {
    ;(valor as unknown[]).forEach((item, i) => fallos.push(...errores(item, esquema.items as Esquema, `${ruta}[${i}]`)))
  }
  if (real === 'object' && (esquema.properties || esquema.additionalProperties === false)) {
    const propiedades = (esquema.properties ?? {}) as Record<string, Esquema>
    const objeto = valor as Record<string, unknown>
    for (const requerida of (esquema.required ?? []) as string[]) {
      if (!(requerida in objeto)) fallos.push(`${ruta}.${requerida}: obligatorio y ausente`)
    }
    for (const [clave, v] of Object.entries(objeto)) {
      if (propiedades[clave]) fallos.push(...errores(v, propiedades[clave], `${ruta}.${clave}`))
      else if (esquema.additionalProperties === false) fallos.push(`${ruta}.${clave}: campo no admitido (el backend responde 422)`)
    }
  }
  return fallos
}

/** Esquema del cuerpo de `metodo url` (con los parámetros de ruta ya sustituidos). */
export function esquemaPeticion(metodo: string, url: string): Esquema {
  const ruta = Object.keys(documento.paths).find((plantilla) =>
    new RegExp(`^${plantilla.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(url.split('?')[0]),
  )
  if (!ruta) throw new Error(`La ruta ${url} no existe en el OpenAPI del backend`)
  const operacion = documento.paths[ruta][metodo.toLowerCase()]
  if (!operacion) throw new Error(`${metodo.toUpperCase()} ${ruta} no existe en el OpenAPI del backend`)
  const contenido = operacion.requestBody?.content['application/json']
  if (!contenido) throw new Error(`${metodo.toUpperCase()} ${ruta} no recibe JSON`)
  return contenido.schema
}

export function existeRuta(metodo: string, url: string): boolean {
  return Object.entries(documento.paths).some(
    ([plantilla, operaciones]) =>
      new RegExp(`^${plantilla.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(url.split('?')[0]) && metodo.toLowerCase() in operaciones,
  )
}
