import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'

import type { VersionModeloIA } from '@/application/hooks/useVersionesModelo'
import i18n from '@/infrastructure/i18n'
import { VersionesModelo } from '@/presentation/pages/metricas/VersionesModelo'
import { FORM_VERSION_VACIO, validarNuevaVersion } from '@/presentation/pages/metricas/validarVersion'
import { instalarAdaptadorFalso } from '../../ayudas'
import { errores, esquemaPeticion, existeRuta } from '../../contrato/validarOpenApi'

const HUELLA = 'a'.repeat(64)

function version(over: Partial<VersionModeloIA> = {}): VersionModeloIA {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    version: '4.0.0-binario',
    model_hash: HUELLA,
    feature_schema_version: '4',
    dataset_version: 'sintetico-2026-10',
    scikit_learn_version: '1.9.0',
    python_version: '3.12',
    trained_at: '2026-10-20T10:00:00Z',
    aprobado_por: '00000000-0000-0000-0000-0000000000aa',
    aprobado_en: '2026-10-21T10:00:00Z',
    activa: false,
    activada_en: null,
    desactivada_en: null,
    horizonte_min: null,
    metricas: null,
    particiones: null,
    criterio_principal: 'por_incidente',
    activable: false,
    motivos_bloqueo: ['falta el horizonte H de la etiqueta'],
    ...over,
  }
}

type Respuesta = { status?: number; data?: unknown }

function montar(puedeGestionar: boolean, responder: (config: AxiosRequestConfig) => Respuesta | undefined = () => undefined, lista = [version()]) {
  const adaptador = instalarAdaptadorFalso((config) => {
    const propia = responder(config)
    if (propia) return propia
    if (config.method === 'get' && config.url === '/api/ia/modelo/versiones') return { data: lista }
    return { status: 500, data: {} }
  })
  render(<VersionesModelo puedeGestionar={puedeGestionar} />)
  return adaptador
}

let adaptador: ReturnType<typeof instalarAdaptadorFalso> | undefined
afterEach(() => adaptador?.restaurar())

describe('VersionesModelo (HU-46)', () => {
  it('el auditor consulta las versiones en solo lectura', async () => {
    adaptador = montar(false)
    const fila = await screen.findByTestId('version-modelo-4.0.0-binario')
    expect(within(fila).getByText('No activable')).toBeInTheDocument()
    expect(within(fila).getByText('falta el horizonte H de la etiqueta')).toBeInTheDocument()
    expect(within(fila).getByText(HUELLA)).toBeInTheDocument()
    expect(screen.getByText(/Solo lectura/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Registrar versión/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Activar/ })).not.toBeInTheDocument()
    expect(adaptador.peticiones.every((p) => p.method === 'get')).toBe(true)
  })

  it('sin versiones explica que ninguna aprobada clasifica', async () => {
    adaptador = montar(false, undefined, [])
    expect(await screen.findByText(/No hay versiones registradas/)).toBeInTheDocument()
  })

  it('409: muestra el motivo del rechazo y la versión activa se mantiene', async () => {
    const activa = version({ version: '3.0.0', activa: true, activada_en: '2026-10-01T00:00:00Z', activable: true, motivos_bloqueo: [] })
    adaptador = montar(true, (config) =>
      config.method === 'post'
        ? { status: 409, data: { detail: 'La versión 4.0.0-binario no puede activarse: falta el horizonte H de la etiqueta' } }
        : undefined,
    [activa, version()])
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Activar la versión 4.0.0-binario' }))
    const dialogo = screen.getByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Reemplaza a la versión activa 3.0.0')
    expect(dialogo).toHaveTextContent('El sistema rechazará la activación')
    await user.click(within(dialogo).getByRole('button', { name: 'Activar versión' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No se activó la versión 4.0.0-binario: no cumple los requisitos de activación. La versión activa se mantiene.')
    expect(alerta).toHaveTextContent('Motivo informado por el sistema: La versión 4.0.0-binario no puede activarse: falta el horizonte H')
    const post = adaptador.peticiones.find((p) => p.method === 'post')!
    expect(post.url).toBe('/api/ia/modelo/versiones/4.0.0-binario/activar')
    expect(existeRuta('post', post.url)).toBe(true)
  })

  it('404: explica que la versión no está registrada ni aprobada', async () => {
    adaptador = montar(true, (config) =>
      config.method === 'post' ? { status: 404, data: { detail: 'La versión 4.0.0-binario no está registrada/aprobada; no puede activarse' } } : undefined,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Activar la versión 4.0.0-binario' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Activar versión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('no está registrada ni aprobada')
  })

  it('activa una versión que cumple los requisitos', async () => {
    const lista = version({ activable: true, motivos_bloqueo: [] })
    adaptador = montar(true, (config) =>
      config.method === 'post' ? { data: { ...lista, activa: true, activada_en: '2026-11-14T10:00:00Z' } } : undefined,
    [lista])
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Activar la versión 4.0.0-binario' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Hoy no hay ninguna versión activa.')
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Activar versión' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Versión 4.0.0-binario activada.')
  })

  it('registra una versión con el cuerpo exacto que acepta el backend', async () => {
    adaptador = montar(true, (config) =>
      config.method === 'post' && config.url === '/api/ia/modelo/versiones'
        ? { status: 201, data: version({ version: '5.0.0' }) }
        : undefined,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Registrar versión' }))
    const panel = screen.getByRole('dialog')
    await user.type(within(panel).getByLabelText('Identificador de versión'), '5.0.0')
    await user.type(within(panel).getByLabelText('Entrenado el'), '2026-11-01T09:30')
    await user.type(within(panel).getByLabelText('Huella SHA-256 del artefacto'), 'B'.repeat(64))
    await user.type(within(panel).getByLabelText('Esquema de características'), '4')
    await user.type(within(panel).getByLabelText('Conjunto de datos'), 'corridas-2026-11')
    await user.type(within(panel).getByLabelText('scikit-learn'), '1.9.0')
    await user.type(within(panel).getByLabelText('Python'), '3.12')
    await user.type(within(panel).getByLabelText('Horizonte H (minutos, opcional)'), '30')
    await user.click(within(panel).getByLabelText('Métricas (JSON, opcional)'))
    await user.paste('{"sensibilidad_incidente": 0.86, "incidentes_evaluables": 12}')
    await user.click(within(panel).getByLabelText('Particiones (JSON, opcional)'))
    await user.paste('{"entrenamiento": ["c1", "c2"], "prueba": ["c3"], "separacion_min": 60}')
    await user.click(within(panel).getByRole('button', { name: 'Registrar versión' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Versión 5.0.0 registrada. Aún no está activa'))
    const post = adaptador.peticiones.find((p) => p.method === 'post')!
    const cuerpo = JSON.parse(post.data as string)
    expect(errores(cuerpo, esquemaPeticion('post', post.url))).toEqual([])
    expect(cuerpo).toMatchObject({
      version: '5.0.0',
      model_hash: 'b'.repeat(64),
      horizonte_min: 30,
      metricas: { sensibilidad_incidente: 0.86 },
      particiones: { separacion_min: 60 },
    })
    expect(Date.parse(cuerpo.trained_at)).toBe(new Date(2026, 10, 1, 9, 30).getTime())
  })

  it('409 al registrar: muestra el motivo dentro del formulario', async () => {
    adaptador = montar(true, (config) =>
      config.method === 'post' ? { status: 409, data: { detail: 'La versión 4.0.0-binario ya está registrada' } } : undefined,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Registrar versión' }))
    const panel = screen.getByRole('dialog')
    for (const [etiqueta, valor] of [
      ['Identificador de versión', '4.0.0-binario'], ['Entrenado el', '2026-11-01T09:30'], ['Huella SHA-256 del artefacto', HUELLA],
      ['Esquema de características', '4'], ['Conjunto de datos', 'd'], ['scikit-learn', '1.9.0'], ['Python', '3.12'],
    ]) await user.type(within(panel).getByLabelText(etiqueta), valor)
    await user.click(within(panel).getByRole('button', { name: 'Registrar versión' }))
    const alerta = await within(panel).findByRole('alert')
    expect(alerta).toHaveTextContent('No se registró la versión.')
    expect(alerta).toHaveTextContent('ya está registrada')
  })
})

describe('validarNuevaVersion', () => {
  const t = i18n.t.bind(i18n)
  const base = {
    ...FORM_VERSION_VACIO,
    version: 'v', model_hash: HUELLA, feature_schema_version: '4', dataset_version: 'd',
    scikit_learn_version: '1.9.0', python_version: '3.12', trained_at: '2026-11-01T09:30',
  }

  it('rechaza una huella que no es SHA-256', () => {
    expect(validarNuevaVersion({ ...base, model_hash: 'xyz' }, t)).toEqual({ error: 'La huella debe tener 64 caracteres hexadecimales.' })
  })

  it('rechaza JSON inválido o métricas no numéricas', () => {
    expect(validarNuevaVersion({ ...base, metricas: '{no' }, t)).toEqual({ error: 'Métricas (JSON, opcional): escribe un objeto JSON válido.' })
    expect(validarNuevaVersion({ ...base, metricas: '{"f1_macro": "alto"}' }, t)).toEqual({ error: 'Métricas: cada valor debe ser un número.' })
    expect(validarNuevaVersion({ ...base, particiones: '[1]' }, t)).toHaveProperty('error')
  })

  it('rechaza un horizonte fuera de 1–1440', () => {
    expect(validarNuevaVersion({ ...base, horizonte_min: '0' }, t)).toHaveProperty('error')
    expect(validarNuevaVersion({ ...base, horizonte_min: '1441' }, t)).toHaveProperty('error')
  })

  it('deja fuera del cuerpo lo opcional vacío', () => {
    const resultado = validarNuevaVersion(base, t)
    expect(resultado).toMatchObject({ nueva: { horizonte_min: null, metricas: null, particiones: null } })
  })
})
