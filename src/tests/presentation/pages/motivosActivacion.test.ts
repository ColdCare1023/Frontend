import { afterEach, describe, expect, it } from 'vitest'

import i18n from '@/infrastructure/i18n'
import {
  MOTIVOS_POR_CODIGO,
  clasificarRechazo,
  esMotivoPreventivo,
  esVersionNoActiva,
  separarMotivos,
  textoMotivo,
} from '@/presentation/pages/metricas/motivosActivacion'

const t = i18n.t.bind(i18n)

/**
 * 409 real de POST /activar en el backend (ia_router.py, be-r2b-gobierno):
 * `detail` con los textos de prediccion_preventiva/servicio.py y `codigos`
 * con un código estable por motivo, en el mismo orden (IA-B05 v6 y v7).
 */
const RECHAZO_B05 = {
  detail:
    'La versión rf-preventivo-1.0.0 no puede activarse: ' +
    'el horizonte registrado (15 min) no es el del manifiesto desplegado (30 min); ' +
    'la versión de scikit-learn registrada (1.8.2) no es la del manifiesto (1.9.0); ' +
    'el modelo se entrenó con scikit-learn 1.0.2 y el instalado es 1.9.0; no cargaría; ' +
    'el SHA-256 del manifiesto no coincide con el último anotado en historial.json ' +
    '(el manifiesto se modificó fuera de la CLI de registro)',
  codigos: [
    'horizonte_distinto_del_manifiesto',
    'sklearn_distinto_del_manifiesto',
    'sklearn_incompatible_con_el_instalado',
    'manifiesto_distinto_del_historial',
  ],
}

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

  it('B05 v6/v7: el 409 real del backend se agrupa como artefacto preventivo por sus códigos', () => {
    // «…; no cargaría» es parte del motivo de scikit-learn, como «…; activar exige Y».
    expect(separarMotivos(RECHAZO_B05.detail)).toHaveLength(4)
    const r = clasificarRechazo(RECHAZO_B05.detail, 'legado', t, RECHAZO_B05.codigos)
    expect(r).toMatchObject({ artefacto: 'preventivo', soloArtefacto: true })
    expect(r.motivos).toEqual([
      { grupo: 'artefacto', texto: 'el horizonte H registrado (15 min) no es el del manifiesto del artefacto desplegado (30 min)' },
      { grupo: 'artefacto', texto: 'la versión de scikit-learn registrada (1.8.2) no es la del manifiesto del artefacto desplegado (1.9.0)' },
      { grupo: 'artefacto', texto: 'el modelo se entrenó con scikit-learn 1.0.2 y la instalada es 1.9.0: no se podría cargar' },
      {
        grupo: 'artefacto',
        texto: 'el manifiesto desplegado se modificó fuera de la herramienta de registro: su huella SHA-256 no es la anotada en el historial',
      },
    ])
  })

  it('B05 v6/v7: sin códigos, los mismos textos se reconocen como respaldo', () => {
    const conCodigos = clasificarRechazo(RECHAZO_B05.detail, 'legado', t, RECHAZO_B05.codigos)
    expect(clasificarRechazo(RECHAZO_B05.detail, 'legado', t)).toEqual(conCodigos)
    expect(clasificarRechazo(RECHAZO_B05.detail, 'legado', t, [])).toEqual(conCodigos)
    expect(esMotivoPreventivo('el modelo se entrenó con scikit-learn 1.0.2 y el instalado es 1.9.0; no cargaría')).toBe(true)
    // Un texto libre sin el prefijo no se trocea: sigue siendo «otro motivo».
    expect(separarMotivos('Conflicto inesperado; otra cosa')).toEqual([])
  })

  it('con códigos, el código decide el grupo aunque el texto haya cambiado de forma', () => {
    const detalle = 'La versión v1 no puede activarse: huella ausente (texto nuevo); horizonte 15 frente a 30; algo distinto'
    const r = clasificarRechazo(detalle, 'legado', t, ['sha256_no_configurado', 'horizonte_distinto_del_manifiesto', 'otro'])
    expect(r.motivos).toEqual([
      // Sin valores que leer: se traduce igual.
      { grupo: 'artefacto', texto: 'falta la huella esperada del artefacto (IA_PREVENTIVO_SHA256)' },
      // Con valores que no se pueden leer: el texto original, que los trae, en su grupo.
      { grupo: 'artefacto', texto: 'horizonte 15 frente a 30' },
      // `otro` (motivo sin código) se clasifica por su texto.
      { grupo: 'otros', texto: 'algo distinto' },
    ])
    expect(r).toMatchObject({ artefacto: 'preventivo', soloArtefacto: false })
  })

  it('con códigos, los criterios no se confunden con el artefacto y el hash distinto es del artefacto gobernado', () => {
    const detalle =
      'La versión v1 no puede activarse: faltan las particiones (prueba); no cumple el criterio principal (por_incidente); ' +
      'el artefacto desplegado no coincide con el hash registrado'
    const codigos = ['faltan_particiones', 'no_cumple_criterio_principal', 'artefacto_distinto_del_registrado']
    const r = clasificarRechazo(detalle, 'legado', t, codigos)
    expect(r.motivos.map((m) => m.grupo)).toEqual(['criterios', 'criterios', 'artefacto'])
    expect(r.motivos[1].texto).toBe('no cumple el criterio principal (Por incidente)')
    expect(r).toMatchObject({ artefacto: 'legado', soloArtefacto: false })
  })

  it('si la cuenta de códigos no cuadra con la de motivos, cada código busca su texto', () => {
    const r = clasificarRechazo(RECHAZO_B05.detail, null, t, ['sklearn_incompatible_con_el_instalado'])
    expect(r.motivos).toEqual([{ grupo: 'artefacto', texto: 'el modelo se entrenó con scikit-learn 1.0.2 y la instalada es 1.9.0: no se podría cargar' }])
    // Un `detail` que es solo un código (sin textos de donde leer los valores).
    expect(clasificarRechazo('sklearn_incompatible_con_el_instalado', null, t).motivos).toEqual([
      { grupo: 'artefacto', texto: 'el modelo se entrenó con scikit-learn … y la instalada es …: no se podría cargar' },
    ])
    expect(clasificarRechazo('manifiesto_distinto_del_historial; falta_horizonte', null, t).motivos.map((m) => m.grupo)).toEqual([
      'artefacto',
      'criterios',
    ])
  })

  it('cada código del backend tiene su texto en español y en inglés', () => {
    const codigosBackend = [
      'falta_horizonte', 'falta_esquema_features', 'faltan_particiones', 'separacion_menor_que_horizonte',
      'criterio_principal_desconocido', 'faltan_metricas_criterio_principal', 'no_cumple_criterio_principal',
      'version_preventiva_no_configurada', 'version_distinta_de_la_desplegada', 'sha256_no_configurado',
      'sha256_distinto_del_registrado', 'artefacto_distinto_del_registrado', 'manifiesto_ilegible', 'manifiesto_no_aprobado',
      'manifiesto_distinto_del_historial', 'horizonte_distinto_del_manifiesto', 'esquema_features_distinto_del_manifiesto',
      'sklearn_distinto_del_manifiesto', 'sklearn_incompatible_con_el_instalado',
    ]
    expect(Object.keys(MOTIVOS_POR_CODIGO).sort()).toEqual([...codigosBackend].sort())
    for (const { clave } of Object.values(MOTIVOS_POR_CODIGO)) {
      expect(i18n.exists(`metricasIA.versiones.motivos.${clave}`, { lng: 'es' })).toBe(true)
      expect(i18n.exists(`metricasIA.versiones.motivos.${clave}`, { lng: 'en' })).toBe(true)
    }
  })

  it('B05 v6: el esquema de features registrado distinto del manifiesto es del artefacto preventivo (es/en)', async () => {
    const detalle =
      'La versión rf-preventivo-1.0.0 no puede activarse: ' +
      'el esquema de features registrado (esquema_inventado) no es el del manifiesto (termico_minimo)'
    const codigos = ['esquema_features_distinto_del_manifiesto']
    const r = clasificarRechazo(detalle, 'legado', t, codigos)
    expect(r).toMatchObject({ artefacto: 'preventivo', soloArtefacto: true })
    expect(r.motivos).toEqual([
      {
        grupo: 'artefacto',
        texto:
          'el esquema de características registrado (esquema_inventado) no es el del manifiesto del artefacto desplegado (termico_minimo)',
      },
    ])
    // Sin códigos, el texto se reconoce igual.
    expect(clasificarRechazo(detalle, 'legado', t)).toEqual(r)
    await i18n.changeLanguage('en')
    expect(clasificarRechazo(detalle, null, i18n.t.bind(i18n), codigos).motivos.map((m) => m.texto)).toEqual([
      'the registered feature schema (esquema_inventado) is not the one in the deployed artifact manifest (termico_minimo)',
    ])
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
    // B05 v6/v7: ningún motivo del 409 real queda en español en la interfaz en inglés.
    expect(clasificarRechazo(RECHAZO_B05.detail, null, en, RECHAZO_B05.codigos).motivos.map((m) => m.texto)).toEqual([
      'the registered horizon H (15 min) is not the one in the deployed artifact manifest (30 min)',
      'the registered scikit-learn version (1.8.2) is not the one in the deployed artifact manifest (1.9.0)',
      'the model was trained with scikit-learn 1.0.2 and 1.9.0 is installed: it could not be loaded',
      'the deployed manifest was changed outside the registration tool: its SHA-256 fingerprint is not the one recorded in the history',
    ])
  })
})
