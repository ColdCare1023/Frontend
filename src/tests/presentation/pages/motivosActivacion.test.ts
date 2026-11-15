import { afterEach, describe, expect, it } from 'vitest'

import i18n from '@/infrastructure/i18n'
import { clasificarRechazo, separarMotivos, textoMotivo } from '@/presentation/pages/metricas/motivosActivacion'

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

  it('traduce los motivos conocidos al inglés (paridad es/en)', async () => {
    await i18n.changeLanguage('en')
    const en = i18n.t.bind(i18n)
    expect(textoMotivo('falta el horizonte H de la etiqueta', en)).toBe('the label horizon H is missing')
    expect(textoMotivo('no cumple el criterio principal (por_incidente)', en)).toBe('it does not meet the main criterion (Per incident)')
    expect(textoMotivo('la versión no es la desplegada en IA_PREVENTIVO_VERSION (p-2)', en)).toBe('the version is not the deployed one (p-2)')
    expect(textoMotivo('el artefacto desplegado no coincide con el hash registrado', en)).toBe(
      'the deployed artifact does not match the registered fingerprint',
    )
  })
})
