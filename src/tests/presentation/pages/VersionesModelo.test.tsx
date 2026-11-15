import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { VersionModeloIA } from '@/application/hooks/useVersionesModelo'
import i18n from '@/infrastructure/i18n'
import { VersionesModelo, type ArtefactoGobernado } from '@/presentation/pages/metricas/VersionesModelo'
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

function montar(
  puedeGestionar: boolean,
  responder: (config: AxiosRequestConfig) => Respuesta | undefined = () => undefined,
  lista = [version()],
  extra: { artefacto?: ArtefactoGobernado | null; onCambio?: () => void } = {},
) {
  const adaptador = instalarAdaptadorFalso((config) => {
    const propia = responder(config)
    if (propia) return propia
    if (config.method === 'get' && config.url === '/api/ia/modelo/versiones') return { data: lista }
    return { status: 500, data: {} }
  })
  render(<VersionesModelo puedeGestionar={puedeGestionar} {...extra} />)
  return adaptador
}

/** Abre la confirmación de la versión 4.0.0-binario, confirma y devuelve el aviso. */
async function activarYLeerAviso() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Activar la versión 4.0.0-binario' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Activar versión' }))
  return screen.findByRole('alert')
}

const rechazo409 = (motivos: string) => (config: AxiosRequestConfig): Respuesta | undefined =>
  config.method === 'post' ? { status: 409, data: { detail: `La versión 4.0.0-binario no puede activarse: ${motivos}` } } : undefined

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
    // Los motivos se listan por grupo, en vez del texto crudo del 409.
    const grupo = within(alerta).getByTestId('motivos-rechazo').querySelector('[data-grupo="criterios"]') as HTMLElement
    expect(grupo).toHaveTextContent('Requisitos de la versión:')
    expect(within(grupo).getByRole('listitem')).toHaveTextContent('falta el horizonte H de la etiqueta')
    const post = adaptador.peticiones.find((p) => p.method === 'post')!
    expect(post.url).toBe('/api/ia/modelo/versiones/4.0.0-binario/activar')
    expect(existeRuta('post', post.url)).toBe(true)
  })

  it('409 por el artefacto legado: lo nombra y lista el motivo aparte de los requisitos', async () => {
    const activable = version({ activable: true, motivos_bloqueo: [] })
    adaptador = montar(true, rechazo409('el artefacto desplegado no coincide con el hash registrado'), [activable], {
      artefacto: { modelo: 'legado', version: null },
    })
    const alerta = await activarYLeerAviso()
    expect(alerta).toHaveTextContent(
      'No se activó la versión 4.0.0-binario: el artefacto del modelo legado desplegado no corresponde a esta versión. La versión activa se mantiene.',
    )
    const grupo = alerta.querySelector('[data-grupo="artefacto"]') as HTMLElement
    expect(grupo).toHaveTextContent('Artefacto del modelo legado:')
    expect(grupo).toHaveTextContent('el artefacto desplegado no coincide con la huella registrada')
    expect(alerta.querySelector('[data-grupo="criterios"]')).toBeNull()
  })

  it('409 por el artefacto preventivo: lo reconoce por sus motivos aunque no se sepa el modo', async () => {
    const activable = version({ activable: true, motivos_bloqueo: [] })
    adaptador = montar(
      true,
      rechazo409(
        'la versión no es la desplegada en IA_PREVENTIVO_VERSION (p-1.0.0); IA_PREVENTIVO_SHA256 no coincide con el hash registrado; ' +
          'el artefacto desplegado no coincide con el hash registrado; el manifiesto está en estado DRAFT; activar exige APPROVED_FOR_DEPLOYMENT',
      ),
      [activable],
    )
    const alerta = await activarYLeerAviso()
    expect(alerta).toHaveTextContent('el artefacto del modelo preventivo desplegado no corresponde a esta versión')
    const grupo = alerta.querySelector('[data-grupo="artefacto"]') as HTMLElement
    expect(grupo).toHaveTextContent('Artefacto del modelo preventivo:')
    expect(within(grupo).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'la versión no es la desplegada (p-1.0.0)',
      'la huella configurada (IA_PREVENTIVO_SHA256) no coincide con la registrada',
      'el artefacto desplegado no coincide con la huella registrada',
      'el manifiesto está en estado DRAFT; activar exige APPROVED_FOR_DEPLOYMENT',
    ])
  })

  it('409 por requisitos y artefacto a la vez: los separa en dos grupos', async () => {
    adaptador = montar(
      true,
      rechazo409('falta el horizonte H de la etiqueta; no cumple el criterio principal (por_incidente); el artefacto desplegado no coincide con el hash registrado'),
      [version()],
      { artefacto: { modelo: 'preventivo', version: 'p-1.0.0' } },
    )
    const alerta = await activarYLeerAviso()
    expect(alerta).toHaveTextContent('no cumple los requisitos de activación')
    expect(alerta.querySelector('[data-grupo="criterios"]')).toHaveTextContent('no cumple el criterio principal (Por incidente)')
    expect(alerta.querySelector('[data-grupo="artefacto"]')).toHaveTextContent('Artefacto del modelo preventivo:')
  })

  it('409 con un texto que no sigue el formato conocido: muestra el motivo del sistema tal cual', async () => {
    const activable = version({ activable: true, motivos_bloqueo: [] })
    adaptador = montar(true, (config) => (config.method === 'post' ? { status: 409, data: { detail: 'Conflicto inesperado' } } : undefined), [activable])
    const alerta = await activarYLeerAviso()
    expect(alerta).toHaveTextContent('Motivo informado por el sistema: Conflicto inesperado')
  })

  it('422: dice que la solicitud no es válida, con el detalle de la validación', async () => {
    const activable = version({ activable: true, motivos_bloqueo: [] })
    adaptador = montar(
      true,
      (config) => (config.method === 'post' ? { status: 422, data: { detail: [{ msg: 'String should have at most 50 characters' }] } } : undefined),
      [activable],
    )
    const alerta = await activarYLeerAviso()
    expect(alerta).toHaveTextContent('No se activó la versión 4.0.0-binario: la solicitud no es válida. La versión activa se mantiene.')
    expect(alerta).toHaveTextContent('String should have at most 50 characters')
  })

  it('la confirmación dice qué artefacto se comprobará y, tras intentarlo, avisa del cambio', async () => {
    const onCambio = vi.fn()
    const activable = version({ activable: true, motivos_bloqueo: [] })
    adaptador = montar(true, (config) => (config.method === 'post' ? { data: { ...activable, activa: true } } : undefined), [activable], {
      artefacto: { modelo: 'preventivo', version: '4.0.0-binario' },
      onCambio,
    })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Activar la versión 4.0.0-binario' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('comprueba el artefacto del modelo preventivo desplegado (versión 4.0.0-binario)')
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Activar versión' }))
    await screen.findByRole('status')
    expect(onCambio).toHaveBeenCalledTimes(1)
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

/** P-12: desactivar la versión activa (POST /api/ia/modelo/versiones/{v}/desactivar). */
describe('VersionesModelo: desactivar la versión activa (P-12)', () => {
  const ACTIVA = version({ version: '3.0.0', activa: true, activada_en: '2026-10-01T00:00:00Z', activable: true, motivos_bloqueo: [] })
  const MOTIVO = 'Rollback: falsas alarmas en el refrigerador 2'
  const RUTA = '/api/ia/modelo/versiones/3.0.0/desactivar'

  /** Lista que cambia tras una desactivación exitosa (el hook la vuelve a leer). */
  function montarConActiva(
    responderPost: (config: AxiosRequestConfig) => Respuesta,
    extra: { onCambio?: () => void } = {},
  ) {
    let lista = [ACTIVA, version()]
    return montar(
      true,
      (config) => {
        if (config.method === 'get') return { data: lista }
        const respuesta = responderPost(config)
        if ((respuesta.status ?? 200) < 400) lista = [{ ...ACTIVA, activa: false, desactivada_en: '2026-11-14T10:00:00Z' }, version()]
        return respuesta
      },
      lista,
      extra,
    )
  }

  async function abrirYEscribir(motivo = MOTIVO) {
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Desactivar la versión 3.0.0' }))
    const dialogo = screen.getByRole('alertdialog')
    if (motivo) await user.type(within(dialogo).getByLabelText('Motivo de la desactivación'), motivo)
    return { user, dialogo }
  }

  it('solo la versión activa ofrece «Desactivar», y solo al administrador', async () => {
    adaptador = montar(true, undefined, [ACTIVA, version()])
    const activa = await screen.findByTestId('version-modelo-3.0.0')
    expect(within(activa).getByRole('button', { name: 'Desactivar la versión 3.0.0' })).toBeInTheDocument()
    expect(within(activa).queryByRole('button', { name: /^Activar/ })).not.toBeInTheDocument()
    expect(within(screen.getByTestId('version-modelo-4.0.0-binario')).queryByRole('button', { name: /Desactivar/ })).not.toBeInTheDocument()
    adaptador.restaurar()
    cleanup()

    // El auditor (puedeGestionar=false) no recibe el botón: el backend le respondería 403.
    adaptador = montar(false, undefined, [ACTIVA])
    await screen.findByTestId('version-modelo-3.0.0')
    expect(screen.queryByRole('button', { name: /Desactivar/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Solo lectura\. Registrar, activar y desactivar versiones corresponde al administrador\./)).toBeInTheDocument()
  })

  it('la confirmación explica el efecto y exige un motivo de al menos 10 caracteres (sin llamar al backend)', async () => {
    adaptador = montarConActiva(() => ({ data: { ...ACTIVA, activa: false } }))
    const { user, dialogo } = await abrirYEscribir('corto')
    expect(dialogo).toHaveTextContent('¿Desactivar la versión 3.0.0?')
    expect(dialogo).toHaveTextContent('No quedará ninguna versión activa: el modelo preventivo no se carga')
    expect(dialogo).toHaveTextContent('Queda en la bitácora y en la cadena de trazabilidad con tu usuario, la fecha y el motivo.')
    const campo = within(dialogo).getByLabelText('Motivo de la desactivación')
    expect(campo).toHaveAttribute('maxLength', '500')
    expect(within(dialogo).getByText('5 de 500 caracteres')).toBeInTheDocument()

    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar versión' }))
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('Escribe un motivo de al menos 10 caracteres.')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveFocus()
    // Solo espacios alrededor no cuentan.
    await user.clear(campo)
    await user.type(campo, '   abc      ')
    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar versión' }))
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('al menos 10 caracteres')
    expect(adaptador.peticiones.some((p) => p.method === 'post')).toBe(false)
  })

  it('200: envía el motivo con el cuerpo del contrato, relee la lista y el estado, y lo anuncia', async () => {
    const onCambio = vi.fn()
    adaptador = montarConActiva(() => ({ data: { ...ACTIVA, activa: false, desactivada_en: '2026-11-14T10:00:00Z' } }), { onCambio })
    const { user, dialogo } = await abrirYEscribir(`  ${MOTIVO}  `)
    const lecturasAntes = adaptador.peticiones.filter((p) => p.method === 'get').length
    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar versión' }))

    const aviso = await screen.findByRole('status')
    expect(aviso).toHaveTextContent('Versión 3.0.0 desactivada. No hay versión activa')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    const post = adaptador.peticiones.find((p) => p.method === 'post')!
    expect(post.url).toBe(RUTA)
    expect(existeRuta('post', post.url)).toBe(true)
    const cuerpo = JSON.parse(post.data as string)
    expect(cuerpo).toEqual({ motivo: MOTIVO })
    expect(errores(cuerpo, esquemaPeticion('post', post.url))).toEqual([])
    // La lista se vuelve a leer: la versión queda inactiva y vuelve a ofrecer «Activar».
    expect(adaptador.peticiones.filter((p) => p.method === 'get').length).toBeGreaterThan(lecturasAntes)
    const fila = screen.getByTestId('version-modelo-3.0.0')
    expect(within(fila).getByRole('button', { name: 'Activar la versión 3.0.0' })).toBeInTheDocument()
    expect(within(fila).queryByText('Activa')).not.toBeInTheDocument()
    expect(onCambio).toHaveBeenCalledTimes(1)
    // El botón que abrió el diálogo ya no existe: el foco va al título de la sección.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Versiones del modelo' })).toHaveFocus())
  })

  it('409 version_no_activa: otra persona se adelantó; lo dice y relee la lista', async () => {
    const onCambio = vi.fn()
    adaptador = montarConActiva(() => ({ status: 409, data: { detail: 'version_no_activa' } }), { onCambio })
    const { user, dialogo } = await abrirYEscribir()
    const lecturasAntes = adaptador.peticiones.filter((p) => p.method === 'get').length
    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar versión' }))
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(
      'No se desactivó la versión 3.0.0: ya no es la versión activa (otra persona pudo desactivarla o activar otra). La lista se actualizó.',
    )
    expect(alerta).not.toHaveTextContent('version_no_activa')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(adaptador.peticiones.filter((p) => p.method === 'get').length).toBeGreaterThan(lecturasAntes)
    expect(onCambio).toHaveBeenCalledTimes(1)
  })

  it('409 con otro motivo: rechazo genérico con el texto del sistema', async () => {
    adaptador = montarConActiva(() => ({ status: 409, data: { detail: 'Conflicto inesperado' } }))
    const { user, dialogo } = await abrirYEscribir()
    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar versión' }))
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No se desactivó la versión 3.0.0: el sistema rechazó el cambio.')
    expect(alerta).toHaveTextContent('Motivo informado por el sistema: Conflicto inesperado')
  })

  it('404: la versión no está registrada', async () => {
    adaptador = montarConActiva(() => ({ status: 404, data: { detail: 'La versión 3.0.0 no está registrada' } }))
    const { user, dialogo } = await abrirYEscribir()
    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar versión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se desactivó la versión 3.0.0: no está registrada. La lista se actualizó.')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('422: el diálogo sigue abierto con el motivo escrito y el error del sistema', async () => {
    adaptador = montarConActiva(() => ({ status: 422, data: { detail: [{ msg: 'String should have at least 10 characters' }] } }))
    const { user, dialogo } = await abrirYEscribir()
    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar versión' }))
    const alerta = await within(dialogo).findByRole('alert')
    expect(alerta).toHaveTextContent('El sistema rechazó el motivo: debe tener entre 10 y 500 caracteres.')
    expect(alerta).toHaveTextContent('String should have at least 10 characters')
    const campo = within(dialogo).getByLabelText('Motivo de la desactivación')
    expect(campo).toHaveValue(MOTIVO)
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('version-modelo-3.0.0')).toHaveTextContent('Activa')
  })

  it('403: el rol no puede gestionar versiones', async () => {
    const onCambio = vi.fn()
    adaptador = montarConActiva(() => ({ status: 403, data: { detail: 'Permisos insuficientes' } }), { onCambio })
    const { user, dialogo } = await abrirYEscribir()
    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar versión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu rol no puede gestionar las versiones del modelo.')
    expect(onCambio).not.toHaveBeenCalled()
  })

  it('falla de red o 5xx: el diálogo sigue abierto para reintentar y conserva el motivo', async () => {
    adaptador = montarConActiva(() => ({ status: 503, data: {} }))
    const { user, dialogo } = await abrirYEscribir()
    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar versión' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No pudimos desactivar la versión. Inténtalo nuevamente; el motivo se conserva.')
    expect(within(dialogo).getByLabelText('Motivo de la desactivación')).toHaveValue(MOTIVO)
  })

  it('cancelar no llama al backend, descarta el motivo y devuelve el foco al botón', async () => {
    adaptador = montarConActiva(() => ({ data: {} }))
    const { user, dialogo } = await abrirYEscribir()
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    const boton = screen.getByRole('button', { name: 'Desactivar la versión 3.0.0' })
    await waitFor(() => expect(boton).toHaveFocus())
    await user.click(boton)
    expect(within(screen.getByRole('alertdialog')).getByLabelText('Motivo de la desactivación')).toHaveValue('')
    expect(adaptador.peticiones.some((p) => p.method === 'post')).toBe(false)
  })

  it('en inglés el flujo tiene sus propios textos (paridad es/en)', async () => {
    await i18n.changeLanguage('en')
    try {
      adaptador = montarConActiva(() => ({ status: 409, data: { detail: 'version_no_activa' } }))
      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: 'Deactivate version 3.0.0' }))
      const dialogo = screen.getByRole('alertdialog')
      expect(dialogo).toHaveTextContent('No version will remain active')
      await user.type(within(dialogo).getByLabelText('Reason for deactivation'), MOTIVO)
      await user.click(within(dialogo).getByRole('button', { name: 'Deactivate version' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('it is no longer the active version')
    } finally {
      await i18n.changeLanguage('es')
    }
  })
})

/** IA-B05 v6 y v7: códigos estables del 409 de /activar, traducidos en un solo lugar. */
describe('VersionesModelo: 409 de /activar por el manifiesto (B05 v6/v7)', () => {
  it('horizonte, scikit-learn y manifiesto se explican como artefacto preventivo', async () => {
    const activable = version({ activable: true, motivos_bloqueo: [] })
    adaptador = montar(true, rechazo409('horizonte_no_coincide; version_sklearn_no_coincide; manifiesto_no_coincide'), [activable], {
      artefacto: { modelo: 'preventivo', version: '4.0.0-binario' },
    })
    const alerta = await activarYLeerAviso()
    expect(alerta).toHaveTextContent('el artefacto del modelo preventivo desplegado no corresponde a esta versión')
    const grupo = alerta.querySelector('[data-grupo="artefacto"]') as HTMLElement
    expect(grupo).toHaveTextContent('Artefacto del modelo preventivo:')
    expect(within(grupo).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'el horizonte H registrado no coincide con el del manifiesto del artefacto desplegado',
      'la versión de scikit-learn registrada no coincide con la del manifiesto del artefacto desplegado',
      'el manifiesto desplegado no es el aprobado en el historial (su huella SHA-256 es otra)',
    ])
    expect(alerta).not.toHaveTextContent('horizonte_no_coincide')
  })

  it('un detail que es solo el código también se traduce', async () => {
    const activable = version({ activable: true, motivos_bloqueo: [] })
    adaptador = montar(true, (config) => (config.method === 'post' ? { status: 409, data: { detail: 'version_sklearn_no_coincide' } } : undefined), [activable])
    const alerta = await activarYLeerAviso()
    expect(alerta).toHaveTextContent('la versión de scikit-learn registrada no coincide con la del manifiesto del artefacto desplegado')
    expect(alerta).not.toHaveTextContent('Motivo informado por el sistema')
  })

  it('un detail como objeto con código estable también se traduce', async () => {
    const activable = version({ activable: true, motivos_bloqueo: [] })
    adaptador = montar(
      true,
      (config) => (config.method === 'post' ? { status: 409, data: { detail: { codigo: 'manifiesto_no_coincide', mensaje: 'x' } } } : undefined),
      [activable],
    )
    const alerta = await activarYLeerAviso()
    expect(alerta).toHaveTextContent('el manifiesto desplegado no es el aprobado en el historial')
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
