import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'

import type { MotivoDesactivacion, PasswordTemporal, Usuario } from '@/domain/entities/Usuario'
import { MOTIVOS_DESACTIVACION } from '@/domain/entities/Usuario'
import { ROLES, type Rol } from '@/domain/value-objects/Rol'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { Label, NativeSelect } from '../../components/ui/input'
import { MensajeFormulario, type MensajeDialogo } from './MensajeFormulario'

type Resultado = 'ok' | 'conflicto' | 'error'

/** HU-41: cambiar el rol de un usuario existente. */
export function DialogoCambioRol({
  usuario,
  onCerrar,
  cambiarRol,
}: {
  usuario: Usuario | null
  onCerrar: () => void
  cambiarRol: (id: string, rol: Rol) => Promise<Resultado>
}) {
  const { t } = useTranslation()
  const [rolNuevo, setRolNuevo] = useState<Rol>(usuario?.rol ?? 'tecnico')
  const [cambiando, setCambiando] = useState(false)
  const [mensaje, setMensaje] = useState<MensajeDialogo>(null)
  const [previo, setPrevio] = useState<Usuario | null>(usuario)
  if (usuario !== previo) {
    setPrevio(usuario)
    setRolNuevo(usuario?.rol ?? 'tecnico')
    setMensaje(null)
  }

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!usuario) return
    setCambiando(true)
    setMensaje(null)
    const resultado = await cambiarRol(usuario.id, rolNuevo)
    setCambiando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('usuarios.rolActualizadoOk') })
      setTimeout(onCerrar, 1000)
    } else {
      setMensaje({ tipo: 'error', texto: resultado === 'conflicto' ? t('usuarios.errorRbac') : t('comunes.error') })
    }
  }

  return (
    <Dialog open={usuario !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogTitle>{t('usuarios.cambiarRol')}</DialogTitle>
        <DialogDescription>{t('usuarios.confirmarCambiarRol', { nombre: usuario?.nombre ?? '' })}</DialogDescription>
        <form onSubmit={enviar} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="ur-rol">{t('usuarios.nuevoRol')}</Label>
            <NativeSelect id="ur-rol" aria-describedby="ur-rol-ayuda" value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value as Rol)}>
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>
                  {t(`roles.${rol}`)}
                </option>
              ))}
            </NativeSelect>
            <p id="ur-rol-ayuda" className="mt-1 text-meta text-muted">{t(`usuarios.rolAyuda.${rolNuevo}`)}</p>
          </div>
          <MensajeFormulario mensaje={mensaje} />
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onCerrar} disabled={cambiando}>
              {t('usuarios.cancelar')}
            </Button>
            <Button type="submit" disabled={cambiando}>
              {cambiando ? t('usuarios.cambiando') : t('usuarios.cambiarRol')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** HU-45: desactivar con motivo. */
export function DialogoDesactivar({
  usuario,
  onCerrar,
  desactivar,
}: {
  usuario: Usuario | null
  onCerrar: () => void
  desactivar: (id: string, motivo: string) => Promise<Resultado>
}) {
  const { t } = useTranslation()
  const [motivo, setMotivo] = useState<MotivoDesactivacion>(MOTIVOS_DESACTIVACION[0])
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<MensajeDialogo>(null)
  const [previo, setPrevio] = useState<Usuario | null>(usuario)
  if (usuario !== previo) {
    setPrevio(usuario)
    setMotivo(MOTIVOS_DESACTIVACION[0])
    setMensaje(null)
  }

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!usuario) return
    setProcesando(true)
    setMensaje(null)
    const resultado = await desactivar(usuario.id, motivo)
    setProcesando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('usuarios.desactivadoOk') })
      setTimeout(onCerrar, 1000)
    } else {
      setMensaje({ tipo: 'error', texto: resultado === 'conflicto' ? t('usuarios.errorRbac') : t('comunes.error') })
    }
  }

  return (
    <Dialog open={usuario !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent destructivo>
        <DialogTitle>{t('usuarios.desactivar')}</DialogTitle>
        <DialogDescription>{t('usuarios.confirmarDesactivar', { nombre: usuario?.nombre ?? '' })}</DialogDescription>
        <form onSubmit={enviar} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="ud-motivo">{t('usuarios.motivo')}</Label>
            <NativeSelect id="ud-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDesactivacion)}>
              {MOTIVOS_DESACTIVACION.map((m) => (
                <option key={m} value={m}>
                  {t(`usuarios.motivos.${m}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <MensajeFormulario mensaje={mensaje} />
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onCerrar} disabled={procesando}>
              {t('usuarios.cancelar')}
            </Button>
            <Button type="submit" variant="danger" disabled={procesando}>
              {procesando ? t('dispositivos.procesando') : t('dispositivos.confirmar')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export type AccionTemporal = { usuario: Usuario; accion: 'restablecer-password' | 'reactivar' }

/** FE-004: restablecer contraseña o reactivar; la temporal se muestra una vez. */
export function DialogoTemporal({
  pendiente,
  onCerrar,
  asignarTemporal,
}: {
  pendiente: AccionTemporal | null
  onCerrar: () => void
  asignarTemporal: (id: string, accion: AccionTemporal['accion']) => Promise<PasswordTemporal | null>
}) {
  const { t } = useTranslation()
  const [emitida, setEmitida] = useState<PasswordTemporal | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiada, setCopiada] = useState(false)

  const cerrar = () => {
    setEmitida(null)
    setError(null)
    setCopiada(false)
    onCerrar()
  }

  const confirmar = async () => {
    if (!pendiente) return
    setProcesando(true)
    setError(null)
    const resultado = await asignarTemporal(pendiente.usuario.id, pendiente.accion)
    setProcesando(false)
    if (resultado) setEmitida(resultado)
    else setError(t('comunes.error'))
  }

  const copiar = async () => {
    if (!emitida) return
    try {
      await navigator.clipboard.writeText(emitida.password_temporal)
      setCopiada(true)
    } catch {
      setCopiada(false)
    }
  }

  const nombre = pendiente?.usuario.nombre ?? ''
  return (
    <Dialog open={pendiente !== null} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent>
        <DialogTitle>
          {emitida
            ? t('usuarios.passwordTemporalTitulo')
            : t(pendiente?.accion === 'reactivar' ? 'usuarios.reactivar' : 'usuarios.restablecerPassword')}
        </DialogTitle>
        <DialogDescription>
          {emitida
            ? t('usuarios.passwordTemporalDetalle', { nombre })
            : t(pendiente?.accion === 'reactivar' ? 'usuarios.reactivarConfirmar' : 'usuarios.restablecerConfirmar', { nombre })}
        </DialogDescription>
        {emitida ? (
          <div className="mt-4 space-y-3">
            <code
              data-testid="password-temporal"
              className="codigo block break-all rounded-(--radius-field) border border-border bg-surface-sunken px-3 py-2 text-body select-all"
            >
              {emitida.password_temporal}
            </code>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => void copiar()}>
                <KeyRound />
                <span key={copiada ? 'si' : 'no'} className="animate-(--animate-swap)">
                  {t(copiada ? 'usuarios.copiado' : 'usuarios.copiar')}
                </span>
              </Button>
              <Button variant="ghost" onClick={cerrar}>{t('comunes.cerrar')}</Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <MensajeFormulario mensaje={error ? { tipo: 'error', texto: error } : null} />
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={cerrar} disabled={procesando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button onClick={() => void confirmar()} disabled={procesando}>
                {procesando ? t('dispositivos.procesando') : t('usuarios.confirmar')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
