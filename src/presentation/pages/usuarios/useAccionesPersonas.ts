import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { useUsuarios } from '@/application/hooks/useUsuarios'
import type { MotivoDesactivacion, PasswordTemporal, Usuario } from '@/domain/entities/Usuario'
import { MOTIVOS_DESACTIVACION } from '@/domain/entities/Usuario'
import type { Rol } from '@/domain/value-objects/Rol'
import type { MensajeDialogo } from './piezas'

const FORM_INICIAL = { nombre: '', email: '', telefono: '', password: '', rol: 'tecnico' as Rol }

export type AccionTemporal = 'restablecer-password' | 'reactivar'
export type AccionesPersonas = ReturnType<typeof useAccionesPersonas>

/** Estado y envíos de los diálogos de Usuarios. La pantalla solo decide cuándo abrirlos. */
export function useAccionesPersonas({
  crear,
  desactivar,
  cambiarRol,
  asignarTemporal,
}: Pick<ReturnType<typeof useUsuarios>, 'crear' | 'desactivar' | 'cambiarRol' | 'asignarTemporal'>) {
  const { t } = useTranslation()

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [creando, setCreando] = useState(false)
  const [mensaje, setMensaje] = useState<MensajeDialogo>(null)

  const [usuarioDesactivar, setUsuarioDesactivar] = useState<Usuario | null>(null)
  const [motivoDesactivacion, setMotivoDesactivacion] = useState<MotivoDesactivacion>(MOTIVOS_DESACTIVACION[0])
  const [desactivando, setDesactivando] = useState(false)
  const [mensajeDesactivacion, setMensajeDesactivacion] = useState<MensajeDialogo>(null)

  // HU-41 criterio 1: cambiar el rol de un usuario YA existente, no solo
  // fijarlo al crearlo.
  const [usuarioCambiarRol, setUsuarioCambiarRol] = useState<Usuario | null>(null)
  const [rolNuevo, setRolNuevo] = useState<Rol>('tecnico')
  const [cambiandoRol, setCambiandoRol] = useState(false)
  const [mensajeCambioRol, setMensajeCambioRol] = useState<MensajeDialogo>(null)

  // FE-004: restablecer contraseña / reactivar. La contraseña temporal solo
  // vive en este estado mientras su diálogo está abierto.
  const [temporalPendiente, setTemporalPendiente] = useState<{ usuario: Usuario; accion: AccionTemporal } | null>(null)
  const [temporalEmitida, setTemporalEmitida] = useState<PasswordTemporal | null>(null)
  const [procesandoTemporal, setProcesandoTemporal] = useState(false)
  const [errorTemporal, setErrorTemporal] = useState<string | null>(null)
  const [temporalCopiada, setTemporalCopiada] = useState(false)

  const abrirCambioRol = (usuario: Usuario) => {
    setUsuarioCambiarRol(usuario)
    setRolNuevo(usuario.rol)
    setMensajeCambioRol(null)
  }

  const abrirDesactivacion = (usuario: Usuario) => {
    setUsuarioDesactivar(usuario)
    setMotivoDesactivacion(MOTIVOS_DESACTIVACION[0])
    setMensajeDesactivacion(null)
  }

  const cerrarTemporal = () => {
    setTemporalPendiente(null)
    setTemporalEmitida(null)
    setErrorTemporal(null)
    setTemporalCopiada(false)
  }

  const confirmarTemporal = async () => {
    if (!temporalPendiente) return
    setProcesandoTemporal(true)
    setErrorTemporal(null)
    const resultado = await asignarTemporal(temporalPendiente.usuario.id, temporalPendiente.accion)
    setProcesandoTemporal(false)
    if (resultado) setTemporalEmitida(resultado)
    else setErrorTemporal(t('comunes.error'))
  }

  const copiarTemporal = async () => {
    if (!temporalEmitida) return
    try {
      await navigator.clipboard.writeText(temporalEmitida.password_temporal)
      setTemporalCopiada(true)
    } catch {
      setTemporalCopiada(false)
    }
  }

  const enviarCambioRol = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!usuarioCambiarRol) return
    setCambiandoRol(true)
    setMensajeCambioRol(null)
    const resultado = await cambiarRol(usuarioCambiarRol.id, rolNuevo)
    setCambiandoRol(false)

    if (resultado === 'ok') {
      setMensajeCambioRol({ tipo: 'ok', texto: t('usuarios.rolActualizadoOk') })
      setTimeout(() => setUsuarioCambiarRol(null), 1000)
    } else {
      setMensajeCambioRol({
        tipo: 'error',
        texto: resultado === 'conflicto' ? t('usuarios.errorRbac') : t('comunes.error'),
      })
    }
  }

  const enviarDesactivacion = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!usuarioDesactivar) return
    setDesactivando(true)
    setMensajeDesactivacion(null)
    const resultado = await desactivar(usuarioDesactivar.id, motivoDesactivacion)
    setDesactivando(false)

    if (resultado === 'ok') {
      setMensajeDesactivacion({ tipo: 'ok', texto: t('usuarios.desactivadoOk') })
      setTimeout(() => setUsuarioDesactivar(null), 1000)
    } else {
      setMensajeDesactivacion({
        tipo: 'error',
        texto: resultado === 'conflicto' ? t('usuarios.errorRbac') : t('comunes.error'),
      })
    }
  }

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreando(true)
    setMensaje(null)
    const resultado = await crear(form.nombre, form.email, form.password, form.rol, form.telefono.trim() || undefined)
    setCreando(false)

    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('usuarios.creado') })
      setTimeout(() => {
        setDialogoAbierto(false)
        setForm(FORM_INICIAL)
        setMensaje(null)
      }, 1000)
    } else if (resultado === 'duplicado') {
      setMensaje({ tipo: 'error', texto: t('usuarios.errorDuplicado') })
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  return {
    dialogoAbierto,
    setDialogoAbierto,
    form,
    setForm,
    creando,
    mensaje,
    enviar,
    usuarioDesactivar,
    setUsuarioDesactivar,
    motivoDesactivacion,
    setMotivoDesactivacion,
    desactivando,
    mensajeDesactivacion,
    abrirDesactivacion,
    enviarDesactivacion,
    usuarioCambiarRol,
    setUsuarioCambiarRol,
    rolNuevo,
    setRolNuevo,
    cambiandoRol,
    mensajeCambioRol,
    abrirCambioRol,
    enviarCambioRol,
    temporalPendiente,
    setTemporalPendiente,
    temporalEmitida,
    procesandoTemporal,
    errorTemporal,
    temporalCopiada,
    cerrarTemporal,
    confirmarTemporal,
    copiarTemporal,
  }
}
