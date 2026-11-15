import { describe, expect, it } from 'vitest'

import { ROLES } from '@/domain/value-objects/Rol'
import { CARGADORES } from '@/presentation/rutas'
import { puedeAbrirRuta, seccionesPermitidas, ubicarRuta } from '@/presentation/navegacion'

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

  it('Estado del servicio (GET /health/detalle) es solo del administrador', () => {
    expect(puedeAbrirRuta('administrador', '/estado-servicio')).toBe(true)
    for (const rol of ['farmaceutico', 'tecnico', 'auditor'] as const) {
      expect(puedeAbrirRuta(rol, '/estado-servicio')).toBe(false)
    }
  })

  it('el menú solo muestra Estado del servicio al administrador, en Administración', () => {
    const rutasDe = (rol: (typeof ROLES)[number]) => seccionesPermitidas(rol).flatMap((s) => s.items.map((i) => i.ruta))
    expect(rutasDe('administrador')).toContain('/estado-servicio')
    expect(rutasDe('farmaceutico')).not.toContain('/estado-servicio')
    expect(rutasDe('tecnico')).not.toContain('/estado-servicio')
    expect(rutasDe('auditor')).not.toContain('/estado-servicio')
    expect(ubicarRuta('/estado-servicio')).toMatchObject({ seccion: { claveI18n: 'nav.seccionAdministracion' }, item: { claveI18n: 'nav.estadoServicio', roles: [] } })
    // La página se precarga como las demás (carga diferida por ruta).
    expect(CARGADORES['/estado-servicio']).toBeTypeOf('function')
  })

  it('sin sesión o con una ruta fuera del mapa, no', () => {
    expect(puedeAbrirRuta(null, '/trazabilidad')).toBe(false)
    expect(puedeAbrirRuta(undefined, '/trazabilidad')).toBe(false)
    expect(puedeAbrirRuta('administrador', '/no-existe')).toBe(false)
  })
})
