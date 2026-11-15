import { describe, expect, it } from 'vitest'

import { ROLES } from '@/domain/value-objects/Rol'
import { puedeAbrirRuta } from '@/presentation/navegacion'

/**
 * HU-41: `puedeAbrirRuta` responde con el mismo mapa que RequireRoles en
 * App.tsx y el riel. Un enlace dentro de una pantalla (p. ej. «Verificar
 * cadena del equipo», HU-28) solo se ofrece a quien puede abrir el destino.
 */
describe('puedeAbrirRuta', () => {
  it.each(ROLES)('%s puede abrir /trazabilidad (App.tsx no la restringe por rol)', (rol) => {
    expect(puedeAbrirRuta(rol, '/trazabilidad')).toBe(true)
    expect(puedeAbrirRuta(rol, '/trazabilidad?cadena=FARM-01-CDL')).toBe(true)
  })

  it('respeta las rutas restringidas', () => {
    expect(puedeAbrirRuta('tecnico', '/reportes')).toBe(false)
    expect(puedeAbrirRuta('auditor', '/reportes')).toBe(true)
    expect(puedeAbrirRuta('farmaceutico', '/auditoria')).toBe(false)
    expect(puedeAbrirRuta('auditor', '/usuarios')).toBe(false)
    expect(puedeAbrirRuta('administrador', '/usuarios')).toBe(true)
  })

  it('sin sesión o con una ruta fuera del mapa, no', () => {
    expect(puedeAbrirRuta(null, '/trazabilidad')).toBe(false)
    expect(puedeAbrirRuta(undefined, '/trazabilidad')).toBe(false)
    expect(puedeAbrirRuta('administrador', '/no-existe')).toBe(false)
  })
})
