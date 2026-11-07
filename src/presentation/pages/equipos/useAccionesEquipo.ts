import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { useDispositivos } from '@/application/hooks/useDispositivos'
import {
  MOTIVOS_BAJA,
  PATRON_DEVICE_ID,
  type CausaRotacion,
  type CredencialRotada,
  type Dispositivo,
  type HistorialConfiguracion,
  type MotivoBaja,
} from '@/domain/entities/Dispositivo'

const FORM_BAJA_INICIAL: { motivo: MotivoBaja; descripcion: string; deviceIdReemplazo: string } = {
  motivo: MOTIVOS_BAJA[0],
  descripcion: '',
  deviceIdReemplazo: '',
}

// B-12: el backend calcula la próxima calibración con la vigencia en meses.
const FORM_CALIBRACION_INICIAL = { fecha: '', certificado: '', mesesVigencia: '12', observaciones: '' }
const FORM_INSTALACION_INICIAL = { ubicacion: '', fecha: '', observaciones: '' }
const FORM_RESPONSABLE_INICIAL = { nombre: '', email: '', telefono: '' }
const FORM_NUEVO_INICIAL = { id: '', nombre: '', ubicacion: '', mc38: false }

export type DialogoEquipo =
  | 'ficha' | 'crear' | 'simulacion' | 'baja' | 'calibracion' | 'instalacion' | 'responsable' | 'historial'
  | 'rotar' | 'revocar' | 'token' | 'broker'
  | null
export type EscenarioIoT = 'sin_datos' | 'buffer_pendiente' | 'buffer_lleno' | 'falla_sensor' | 'recuperar'
export type AccionesEquipo = ReturnType<typeof useAccionesEquipo>

/** Estado y envíos de los diálogos de Equipos. La pantalla solo decide cuándo abrirlos. */
export function useAccionesEquipo({
  dispositivos,
  darDeBaja,
  registrarCalibracion,
  actualizarInstalacion,
  actualizarResponsable,
  obtenerHistorialConfiguracion,
  registrarDispositivo,
  rotarCredencial,
  revocarCredencial,
  confirmarBroker,
  reenviarDesafio,
  simularEscenario,
}: ReturnType<typeof useDispositivos>) {
  const { t } = useTranslation()

  const [idActivo, setIdActivo] = useState<string | null>(null)
  // Siempre el dato vivo: una baja o un escenario se reflejan en la ficha abierta.
  const dispositivoActivo = dispositivos.find((d) => d.id === idActivo) ?? null
  const [dialogo, setDialogoCrudo] = useState<DialogoEquipo>(null)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [formBaja, setFormBaja] = useState(FORM_BAJA_INICIAL)
  const [formCalibracion, setFormCalibracion] = useState(FORM_CALIBRACION_INICIAL)
  // El selector de fecha no tiene `required` nativo: la fecha vacía se marca aquí.
  const [fechaCalibracionInvalida, setFechaCalibracionInvalida] = useState(false)
  const [formInstalacion, setFormInstalacion] = useState(FORM_INSTALACION_INICIAL)
  const [formResponsable, setFormResponsable] = useState(FORM_RESPONSABLE_INICIAL)
  const [historial, setHistorial] = useState<HistorialConfiguracion[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [mensajeFlota, setMensajeFlota] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [formNuevo, setFormNuevo] = useState(FORM_NUEVO_INICIAL)
  const [motivoCredencial, setMotivoCredencial] = useState('')
  const [causaRotacion, setCausaRotacion] = useState<CausaRotacion>('preventiva')
  const [notaBroker, setNotaBroker] = useState('')
  // FE-003: el token rotado vive solo mientras su diálogo está abierto; no se
  // persiste, no se registra y se descarta al cerrar.
  const [credencialRotada, setCredencialRotada] = useState<CredencialRotada | null>(null)
  const [tokenCopiado, setTokenCopiado] = useState(false)

  // Lo que se abre desde la ficha vuelve a ella al cerrarse, con el dato ya actualizado.
  const volverAFicha = useRef(false)
  const relojCierre = useRef<number | undefined>(undefined)

  const setDialogo = (siguiente: DialogoEquipo) => {
    if (dialogo === 'ficha' && siguiente !== 'ficha') volverAFicha.current = true
    setDialogoCrudo(siguiente)
  }

  const cerrarDialogo = () => {
    window.clearTimeout(relojCierre.current)
    setMensaje(null)
    setCredencialRotada(null)
    setTokenCopiado(false)
    if (volverAFicha.current) {
      volverAFicha.current = false
      setDialogoCrudo('ficha')
      return
    }
    setDialogoCrudo(null)
    setIdActivo(null)
  }

  const cerrarFicha = () => {
    volverAFicha.current = false
    cerrarDialogo()
  }

  /** Deja leer la confirmación un segundo antes de cerrar. */
  const cerrarTrasConfirmar = () => {
    window.clearTimeout(relojCierre.current)
    relojCierre.current = window.setTimeout(cerrarDialogo, 1000)
  }

  const abrirFicha = (dispositivo: Dispositivo) => {
    setIdActivo(dispositivo.id)
    setMensaje(null)
    // Dentro de la ficha solo se lee lo que ocurra desde ella.
    setMensajeFlota(null)
    setDialogo('ficha')
  }

  const abrirRegistro = () => {
    setFormNuevo(FORM_NUEVO_INICIAL)
    setMensaje(null)
    setDialogo('crear')
  }

  const enviarNuevoDispositivo = async (event: React.FormEvent) => {
    event.preventDefault()
    const deviceId = formNuevo.id.trim().toUpperCase()
    if (!PATRON_DEVICE_ID.test(deviceId)) {
      setMensaje({ tipo: 'error', texto: t('dispositivos.codigoInvalido') })
      return
    }
    setEnviando(true)
    setMensaje(null)
    const resultado = await registrarDispositivo({
      device_id: deviceId,
      nombre: formNuevo.nombre.trim(),
      ubicacion: formNuevo.ubicacion.trim(),
      sensores: formNuevo.mc38 ? ['DS18B20', 'SHT31', 'MC-38'] : ['DS18B20', 'SHT31'],
    })
    setEnviando(false)
    if (resultado.resultado === 'ok') {
      // HU-43: el alta emitió la credencial; se muestra UNA vez, como en la rotación.
      setFormNuevo(FORM_NUEVO_INICIAL)
      setCredencialRotada(resultado.credencial)
      setMensajeFlota({ tipo: 'ok', texto: t('dispositivos.equipoRegistrado') })
      setDialogo('token')
    } else {
      setMensaje({ tipo: 'error', texto: t(resultado.resultado === 'duplicado' ? 'dispositivos.codigoDuplicado' : 'comunes.error') })
    }
  }

  const abrirConfirmarBroker = (dispositivo: Dispositivo) => {
    setIdActivo(dispositivo.id)
    setNotaBroker('')
    setMensaje(null)
    setDialogo('broker')
  }

  const enviarConfirmarBroker = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await confirmarBroker(dispositivoActivo.id, notaBroker.trim())
    setEnviando(false)
    if (resultado === 'ok') {
      cerrarDialogo()
      setMensajeFlota({ tipo: 'ok', texto: t('dispositivos.brokerConfirmado') })
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  const enviarReenviarDesafio = async (dispositivo: Dispositivo) => {
    // Un doble clic expulsaría la sesión dos veces seguidas.
    if (enviando) return
    setEnviando(true)
    const resultado = await reenviarDesafio(dispositivo.id)
    setEnviando(false)
    setMensajeFlota(
      resultado === 'ok'
        ? { tipo: 'ok', texto: t('dispositivos.desafioReenviado') }
        : { tipo: 'error', texto: t('comunes.error') },
    )
  }

  const abrirSimulacion = (dispositivo: Dispositivo) => {
    setIdActivo(dispositivo.id)
    setMensaje(null)
    setDialogo('simulacion')
  }

  const ejecutarEscenario = async (escenario: EscenarioIoT) => {
    if (!dispositivoActivo) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await simularEscenario(dispositivoActivo.id, escenario)
    setEnviando(false)
    setMensaje({ tipo: resultado ? 'ok' : 'error', texto: t(resultado ? 'dispositivos.escenarioAplicado' : 'comunes.error') })
  }

  const abrirCredencial = (dispositivo: Dispositivo, accion: 'rotar' | 'revocar') => {
    setIdActivo(dispositivo.id)
    setMotivoCredencial('')
    setCausaRotacion('preventiva')
    setMensaje(null)
    setDialogo(accion)
  }

  const enviarCredencial = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo || !motivoCredencial.trim()) return
    setEnviando(true)
    setMensaje(null)
    if (dialogo === 'rotar') {
      const credencial = await rotarCredencial(dispositivoActivo.id, motivoCredencial.trim(), causaRotacion)
      setEnviando(false)
      if (credencial) {
        setCredencialRotada(credencial)
        setDialogo('token')
      } else {
        setMensaje({ tipo: 'error', texto: t('comunes.error') })
      }
      return
    }
    const resultado = await revocarCredencial(dispositivoActivo.id, motivoCredencial.trim())
    setEnviando(false)
    if (resultado === 'revocada') {
      cerrarDialogo()
      setMensajeFlota({ tipo: 'ok', texto: t('dispositivos.credencialRevocada') })
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  const copiarToken = async () => {
    if (!credencialRotada) return
    try {
      await navigator.clipboard.writeText(credencialRotada.token)
      setTokenCopiado(true)
    } catch {
      setTokenCopiado(false)
    }
  }

  const abrirBaja = (dispositivo: Dispositivo) => {
    setIdActivo(dispositivo.id)
    setFormBaja(FORM_BAJA_INICIAL)
    setMensaje(null)
    setDialogo('baja')
  }

  const abrirCalibracion = (dispositivo: Dispositivo) => {
    setIdActivo(dispositivo.id)
    setFormCalibracion({
      ...FORM_CALIBRACION_INICIAL,
      certificado: dispositivo.numero_certificado_calibracion ?? '',
      observaciones: dispositivo.observaciones_calibracion ?? '',
    })
    setFechaCalibracionInvalida(false)
    setMensaje(null)
    setDialogo('calibracion')
  }

  const abrirInstalacion = (dispositivo: Dispositivo) => {
    setIdActivo(dispositivo.id)
    setFormInstalacion({
      ...FORM_INSTALACION_INICIAL,
      ubicacion: dispositivo.ubicacion ?? '',
      fecha: dispositivo.fecha_instalacion ?? '',
      observaciones: dispositivo.observaciones_instalacion ?? '',
    })
    setMensaje(null)
    setDialogo('instalacion')
  }

  const abrirResponsable = (dispositivo: Dispositivo) => {
    setIdActivo(dispositivo.id)
    setFormResponsable({
      ...FORM_RESPONSABLE_INICIAL,
      nombre: dispositivo.responsable_nombre ?? '',
      email: dispositivo.responsable_email ?? '',
      telefono: dispositivo.responsable_telefono ?? '',
    })
    setMensaje(null)
    setDialogo('responsable')
  }

  const abrirHistorial = async (dispositivo: Dispositivo) => {
    setIdActivo(dispositivo.id)
    setDialogo('historial')
    setCargandoHistorial(true)
    try {
      setHistorial(await obtenerHistorialConfiguracion(dispositivo.id))
    } finally {
      setCargandoHistorial(false)
    }
  }

  const enviarBaja = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await darDeBaja(
      dispositivoActivo.id,
      formBaja.motivo,
      formBaja.descripcion,
      formBaja.deviceIdReemplazo,
    )
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.bajaExitosa') })
      cerrarTrasConfirmar()
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  const enviarCalibracion = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo) return
    if (!formCalibracion.fecha) {
      // Equivale al `required` del campo nativo: se marca y recibe el foco.
      setFechaCalibracionInvalida(true)
      document.getElementById('c-fecha')?.focus()
      return
    }
    if (!formCalibracion.certificado) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await registrarCalibracion(
      dispositivoActivo.id,
      formCalibracion.fecha,
      formCalibracion.certificado,
      formCalibracion.observaciones,
      Number(formCalibracion.mesesVigencia) || 12,
    )
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.calibracionGuardada') })
      cerrarTrasConfirmar()
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  const enviarInstalacion = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await actualizarInstalacion(
      dispositivoActivo.id,
      formInstalacion.ubicacion,
      formInstalacion.fecha,
      formInstalacion.observaciones,
    )
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.instalacionGuardada') })
      cerrarTrasConfirmar()
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  const enviarResponsable = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await actualizarResponsable(
      dispositivoActivo.id,
      formResponsable.nombre,
      formResponsable.email,
      formResponsable.telefono,
    )
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.responsableGuardado') })
      cerrarTrasConfirmar()
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  return {
    dispositivoActivo,
    dialogo,
    enviando,
    mensaje,
    mensajeFlota,
    setMensajeFlota,
    cerrarDialogo,
    cerrarFicha,
    abrirFicha,
    abrirRegistro,
    formNuevo,
    setFormNuevo,
    enviarNuevoDispositivo,
    abrirConfirmarBroker,
    notaBroker,
    setNotaBroker,
    enviarConfirmarBroker,
    enviarReenviarDesafio,
    abrirSimulacion,
    ejecutarEscenario,
    abrirCredencial,
    motivoCredencial,
    setMotivoCredencial,
    causaRotacion,
    setCausaRotacion,
    enviarCredencial,
    credencialRotada,
    tokenCopiado,
    copiarToken,
    abrirBaja,
    formBaja,
    setFormBaja,
    enviarBaja,
    abrirCalibracion,
    formCalibracion,
    setFormCalibracion,
    fechaCalibracionInvalida,
    setFechaCalibracionInvalida,
    enviarCalibracion,
    abrirInstalacion,
    formInstalacion,
    setFormInstalacion,
    enviarInstalacion,
    abrirResponsable,
    formResponsable,
    setFormResponsable,
    enviarResponsable,
    abrirHistorial,
    historial,
    cargandoHistorial,
  }
}
