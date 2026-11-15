import { afterEach, describe, expect, it } from 'vitest'

import i18n from '@/infrastructure/i18n'
import {
  CODIGOS_ACTIVACION,
  clasificarRechazo,
  esMotivoPreventivo,
  esVersionNoActiva,
  separarMotivos,
  textoMotivo,
} from '@/presentation/pages/metricas/motivosActivacion'

const t = i18n.t.bind(i18n)

/** HU-46 / HU-16 esc. 4: motivos del 409 de POST /api/ia/modelo/versiones/{v}/activar. */
describe('motivos de activación', () => {
  afterEach(() => void i18n.changeLanguage('es'))

  it('separa los motivos sin partir «el manifiesto está en estado X; activar exige Y»', () => {
    expect(
      separarMotivos(
        'La versión v1 no puede activarse: falta el horizonte H de la etiqueta; el manifiesto está en estado DRAFT; activar exige APPROVED_FOR_DEPLOYMENT',
      ),
    ).toEqual(['falta el horizonte H de la etiqueta', 'el manifiesto está en estado DRAFT; activar exige APPROVED_FOR_DEPLOYMENT'])
    expect(separarMotivos('La versión v1 no está registrada/aprobada; no puede activarse')).toEqual([])
    expect(separarMotivos(null)).toEqual([])
  })

  it('el hash distinto se atribuye al artefacto que gobierna el registro', () => {
    const detalle = 'La versión v1 no puede activarse: el artefacto desplegado no coincide con el hash registrado'
    expect(clasificarRechazo(detalle, 'legado', t)).toMatchObject({ artefacto: 'legado', soloArtefacto: true })
    expect(clasificarRechazo(detalle, 'preventivo', t)).toMatchObject({ artefacto: 'preventivo', soloArtefacto: true })
    expect(clasificarRechazo(detalle, null, t)).toMatchObject({ artefacto: null, soloArtefacto: true })
  })

  it('un motivo propio del preventivo lo identifica aunque se crea que gobierna el legado', () => {
    const r = clasificarRechazo('La versión v1 no puede activarse: IA_PREVENTIVO_VERSION no está configurada', 'legado', t)
    expect(r).toMatchObject({ artefacto: 'preventivo', soloArtefacto: true })
  })

  it('solo requisitos: no hay artefacto que nombrar', () => {
    const r = clasificarRechazo('La versión v1 no puede activarse: faltan las particiones (entrenamiento, prueba)', 'preventivo', t)
    expect(r).toMatchObject({ artefacto: null, soloArtefacto: false })
    expect(r.motivos).toEqual([{ grupo: 'criterios', texto: 'faltan las particiones (entrenamiento, prueba)' }])
  })

  it('un motivo desconocido se conserva tal cual, en su propio grupo', () => {
    expect(clasificarRechazo('La versión v1 no puede activarse: motivo nuevo', null, t).motivos).toEqual([{ grupo: 'otros', texto: 'motivo nuevo' }])
  })

  it('B05 v6/v7: los códigos estables se reconocen solos o entre los motivos, con o sin detalle', () => {
    expect(separarMotivos('horizonte_no_coincide')).toEqual(['horizonte_no_coincide'])
    expect(separarMotivos('horizonte_no_coincide; manifiesto_no_coincide')).toEqual(['horizonte_no_coincide', 'manifiesto_no_coincide'])
    // Un texto libre sin el prefijo no se trocea: sigue siendo «otro motivo».
    expect(separarMotivos('Conflicto inesperado; otra cosa')).toEqual([])
    expect(textoMotivo('horizonte_no_coincide', t)).toBe('el horizonte H registrado no coincide con el del manifiesto del artefacto desplegado')
    expect(textoMotivo('horizonte_no_coincide (15 ≠ 30)', t)).toBe(
      'el horizonte H registrado no coincide con el del manifiesto del artefacto desplegado (15 ≠ 30)',
    )
    expect(textoMotivo('version_sklearn_no_coincide: 1.5.2 ≠ 1.9.0', t)).toBe(
      'la versión de scikit-learn registrada no coincide con la del manifiesto del artefacto desplegado (1.5.2 ≠ 1.9.0)',
    )
    expect(textoMotivo('manifiesto_no_coincide', t)).toBe('el manifiesto desplegado no es el aprobado en el historial (su huella SHA-256 es otra)')
    // Solo el preventivo tiene manifiesto: lo identifica aunque se crea que gobierna el legado.
    const r = clasificarRechazo('La versión v1 no puede activarse: falta el horizonte H de la etiqueta; version_sklearn_no_coincide', 'legado', t)
    expect(r).toMatchObject({ artefacto: 'preventivo', soloArtefacto: false })
    expect(r.motivos.map((m) => m.grupo)).toEqual(['criterios', 'artefacto'])
    expect(Object.keys(CODIGOS_ACTIVACION).every(esMotivoPreventivo)).toBe(true)
    // Un código parecido no se confunde.
    expect(esMotivoPreventivo('horizonte_no_coincide_x')).toBe(false)
  })

  it('P-12: el 409 de /desactivar se reconoce por su código', () => {
    expect(esVersionNoActiva('version_no_activa')).toBe(true)
    expect(esVersionNoActiva(' version_no_activa ')).toBe(true)
    expect(esVersionNoActiva('La versión v1 no puede activarse: x')).toBe(false)
    expect(esVersionNoActiva(null)).toBe(false)
  })

  it('traduce los motivos conocidos al inglés (paridad es/en)', async () => {
    await i18n.changeLanguage('en')
    const en = i18n.t.bind(i18n)
    expect(textoMotivo('falta el horizonte H de la etiqueta', en)).toBe('the label horizon H is missing')
    expect(textoMotivo('no cumple el criterio principal (por_incidente)', en)).toBe('it does not meet the main criterion (Per incident)')
    expect(textoMotivo('la versión no es la desplegada en IA_PREVENTIVO_VERSION (p-2)', en)).toBe('the version is not the deployed one (p-2)')
    expect(textoMotivo('el artefacto desplegado no coincide con el hash registrado', en)).toBe(
      'the deployed artifact does not match the registered fingerprint',
    )
    expect(textoMotivo('horizonte_no_coincide', en)).toBe('the registered horizon H does not match the one in the deployed artifact manifest')
    expect(textoMotivo('version_sklearn_no_coincide', en)).toBe(
      'the registered scikit-learn version does not match the one in the deployed artifact manifest',
    )
    expect(textoMotivo('manifiesto_no_coincide', en)).toBe(
      'the deployed manifest is not the one approved in the history (its SHA-256 fingerprint differs)',
    )
  })
})
