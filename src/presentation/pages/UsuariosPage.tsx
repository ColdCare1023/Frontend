import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, RotateCcw, ShieldCheck, UserPlus, UserX, Users } from 'lucide-react'

import { useUsuarios } from '@/application/hooks/useUsuarios'
import { useAuthStore } from '@/application/stores/authStore'
import type { MotivoDesactivacion, PasswordTemporal, Usuario } from '@/domain/entities/Usuario'
import { MOTIVOS_DESACTIVACION } from '@/domain/entities/Usuario'
import { ROLES, type Rol } from '@/domain/value-objects/Rol'
import { rangoPagina } from '@/lib/paginacion'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { Paginacion } from '../components/Paginacion'
import { ActionMenu } from '../components/ActionMenu'
import { EstadoCarga, EstadoVacio } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Input, Label, NativeSelect } from '../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

type MensajeDialogo = { tipo: 'ok' | 'error'; texto: string } | null

const FORM_INICIAL = { nombre: '', email: '', password: '', rol: 'tecnico' as Rol }

export function UsuariosPage() {
  const { t } = useTranslation()
  const { usuarios, cargando, crear, desactivar, cambiarRol, asignarTemporal } = useUsuarios()
  const sesion = useAuthStore((s) => s.usuario)
  // HU-41: nunca puede quedar el sistema sin un administrador activo.
  const administradoresActivos = useMemo(
    () => usuarios.filter((u) => u.rol === 'administrador' && u.is_active).length,
    [usuarios],
  )
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  // La lista completa puede tener miles de filas; solo se pinta la página
  // visible. Al cambiar la lista (filtro nuevo) se vuelve a la primera.
  const visibles = useMemo(
    () => usuarios.slice(...rangoPagina(pagina, tamanoPagina)),
    [usuarios, pagina, tamanoPagina],
  )

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
  const [temporalPendiente, setTemporalPendiente] = useState<{
    usuario: Usuario
    accion: 'restablecer-password' | 'reactivar'
  } | null>(null)
  const [temporalEmitida, setTemporalEmitida] = useState<PasswordTemporal | null>(null)
  const [procesandoTemporal, setProcesandoTemporal] = useState(false)
  const [errorTemporal, setErrorTemporal] = useState<string | null>(null)
  const [temporalCopiada, setTemporalCopiada] = useState(false)

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
    const resultado = await crear(form.nombre, form.email, form.password, form.rol)
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

  return (
    <div>
      <PageHeader eyebrow={t('nav.seccionAdministracion')} titulo={t('usuarios.titulo')} descripcion={t('usuarios.descripcion')}>
        <Button onClick={() => setDialogoAbierto(true)}>
          <UserPlus />
          {t('usuarios.nuevo')}
        </Button>
      </PageHeader>

      {cargando ? (
        <EstadoCarga />
      ) : usuarios.length === 0 ? (
        <EstadoVacio icono={Users} titulo={t('usuarios.sinUsuarios')} />
      ) : (
        <div>
          <Table mobileLayout="stack" titulo={t('usuarios.titulo')}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[26%]">{t('usuarios.nombre')}</TableHead>
                <TableHead className="w-[30%]">{t('usuarios.email')}</TableHead>
                <TableHead className="w-[18%]">{t('usuarios.rol')}</TableHead>
                <TableHead className="w-[12%]">{t('usuarios.estado')}</TableHead>
                <TableHead className="w-[14%] text-right">{t('comunes.acciones')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((usuario) => {
                // HU-41: con un solo administrador activo no se le quita el rol ni se le desactiva.
                const ultimoAdmin = usuario.rol === 'administrador' && administradoresActivos <= 1
                return (
                  <TableRow key={usuario.id}>
                    <TableCell data-label={t('usuarios.nombre')} className="mobile-full font-semibold">{usuario.nombre}</TableCell>
                    <TableCell data-label={t('usuarios.email')} className="mobile-full break-all text-muted">{usuario.email}</TableCell>
                    <TableCell data-label={t('usuarios.rol')} className="sm:whitespace-nowrap">{t(`roles.${usuario.rol}`)}</TableCell>
                    <TableCell data-label={t('usuarios.estado')}>
                      {usuario.is_active ? (
                        <Badge variant="ok" dot>{t('usuarios.activo')}</Badge>
                      ) : (
                        <Badge variant="neutral" dot>
                          {t('usuarios.inactivo')}
                          {usuario.motivo_desactivacion && (
                            <span className="sr-only"> — {usuario.motivo_desactivacion}</span>
                          )}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell data-label={t('comunes.acciones')} className="mobile-full mobile-actions text-right">
                      {usuario.is_active && usuario.id === sesion?.id && (
                        // HU-41 (P8): un administrador no modifica su propia cuenta.
                        // Misma altura que el botón «Opciones»: todas las filas miden igual.
                        <span className="inline-flex h-11 items-center text-xs text-muted sm:h-9 sm:pointer-coarse:h-11">{t('usuarios.tuCuenta')}</span>
                      )}
                      {usuario.is_active && usuario.id !== sesion?.id && (
                        <ActionMenu label={usuario.nombre}>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t('usuarios.cambiarRolA', { nombre: usuario.nombre })}
                            disabled={ultimoAdmin}
                            title={ultimoAdmin ? t('usuarios.ultimoAdmin') : undefined}
                            onClick={() => {
                              setUsuarioCambiarRol(usuario)
                              setRolNuevo(usuario.rol)
                              setMensajeCambioRol(null)
                            }}
                          >
                            <ShieldCheck />
                            {t('usuarios.cambiarRol')}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label={t('usuarios.desactivarA', { nombre: usuario.nombre })}
                            disabled={ultimoAdmin}
                            title={ultimoAdmin ? t('usuarios.ultimoAdmin') : undefined}
                            onClick={() => {
                              setUsuarioDesactivar(usuario)
                              setMotivoDesactivacion(MOTIVOS_DESACTIVACION[0])
                              setMensajeDesactivacion(null)
                            }}
                          >
                            <UserX />
                            {t('usuarios.desactivar')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTemporalPendiente({ usuario, accion: 'restablecer-password' })}
                          >
                            <KeyRound />
                            {t('usuarios.restablecerPassword')}
                          </Button>
                        </ActionMenu>
                      )}
                      {!usuario.is_active && (
                        <ActionMenu label={usuario.nombre}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTemporalPendiente({ usuario, accion: 'reactivar' })}
                          >
                            <RotateCcw />
                            {t('usuarios.reactivar')}
                          </Button>
                        </ActionMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <Paginacion total={usuarios.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
        </div>
      )}

      {/* ── Diálogo de cambio de rol (HU-41) ────────────────── */}
      <Dialog open={usuarioCambiarRol !== null} onOpenChange={(abierto) => !abierto && setUsuarioCambiarRol(null)}>
        <DialogContent>
          <DialogTitle>{t('usuarios.cambiarRol')}</DialogTitle>
          <DialogDescription>
            {t('usuarios.confirmarCambiarRol', { nombre: usuarioCambiarRol?.nombre ?? '' })}
          </DialogDescription>
          <form onSubmit={enviarCambioRol} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="ur-rol">{t('usuarios.nuevoRol')}</Label>
              <NativeSelect
                id="ur-rol"
                value={rolNuevo}
                onChange={(e) => setRolNuevo(e.target.value as Rol)}
              >
                {ROLES.map((rol) => (
                  <option key={rol} value={rol}>
                    {t(`roles.${rol}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <MensajeFormulario mensaje={mensajeCambioRol} />

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setUsuarioCambiarRol(null)} disabled={cambiandoRol}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" disabled={cambiandoRol}>
                {cambiandoRol ? t('usuarios.cambiando') : t('usuarios.cambiarRol')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo de desactivación (HU-45) ────────────────── */}
      <Dialog open={usuarioDesactivar !== null} onOpenChange={(abierto) => !abierto && setUsuarioDesactivar(null)}>
        <DialogContent destructivo>
          <DialogTitle>{t('usuarios.desactivar')}</DialogTitle>
          <DialogDescription>
            {t('usuarios.confirmarDesactivar', { nombre: usuarioDesactivar?.nombre ?? '' })}
          </DialogDescription>
          <form onSubmit={enviarDesactivacion} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="ud-motivo">{t('usuarios.motivo')}</Label>
              <NativeSelect
                id="ud-motivo"
                value={motivoDesactivacion}
                onChange={(e) => setMotivoDesactivacion(e.target.value as MotivoDesactivacion)}
              >
                {MOTIVOS_DESACTIVACION.map((motivo) => (
                  <option key={motivo} value={motivo}>
                    {t(`usuarios.motivos.${motivo}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <MensajeFormulario mensaje={mensajeDesactivacion} />

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setUsuarioDesactivar(null)} disabled={desactivando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" variant="danger" disabled={desactivando}>
                {desactivando ? t('dispositivos.procesando') : t('dispositivos.confirmar')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── FE-004: contraseña temporal (restablecer / reactivar) ── */}
      <Dialog open={temporalPendiente !== null} onOpenChange={(abierto) => !abierto && cerrarTemporal()}>
        <DialogContent>
          <DialogTitle>
            {temporalEmitida
              ? t('usuarios.passwordTemporalTitulo')
              : t(temporalPendiente?.accion === 'reactivar' ? 'usuarios.reactivar' : 'usuarios.restablecerPassword')}
          </DialogTitle>
          <DialogDescription>
            {temporalEmitida
              ? t('usuarios.passwordTemporalDetalle', { nombre: temporalPendiente?.usuario.nombre ?? '' })
              : t(
                  temporalPendiente?.accion === 'reactivar' ? 'usuarios.reactivarConfirmar' : 'usuarios.restablecerConfirmar',
                  { nombre: temporalPendiente?.usuario.nombre ?? '' },
                )}
          </DialogDescription>
          {temporalEmitida ? (
            <div className="mt-4 space-y-3">
              <code
                data-testid="password-temporal"
                className="block break-all rounded-(--radius-field) border border-border bg-secondary-tint px-3 py-2 font-mono text-sm select-all"
              >
                {temporalEmitida.password_temporal}
              </code>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => void copiarTemporal()}>
                  <KeyRound />
                  {t(temporalCopiada ? 'usuarios.copiado' : 'usuarios.copiar')}
                </Button>
                <Button variant="ghost" onClick={cerrarTemporal}>{t('comunes.cerrar')}</Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <MensajeFormulario mensaje={errorTemporal ? { tipo: 'error', texto: errorTemporal } : null} />
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <Button variant="ghost" onClick={cerrarTemporal} disabled={procesandoTemporal}>
                  {t('usuarios.cancelar')}
                </Button>
                <Button onClick={() => void confirmarTemporal()} disabled={procesandoTemporal}>
                  {procesandoTemporal ? t('dispositivos.procesando') : t('usuarios.confirmar')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Diálogo de creación ─────────────────────────────── */}
      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent>
          <DialogTitle>{t('usuarios.nuevo')}</DialogTitle>
          <DialogDescription>{t('usuarios.descripcion')}</DialogDescription>
          <form onSubmit={enviar} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="u-nombre">{t('usuarios.nombre')}</Label>
              <Input
                id="u-nombre"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="u-email">{t('usuarios.email')}</Label>
              <Input
                id="u-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="u-password">{t('usuarios.password')}</Label>
              <Input
                id="u-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="u-rol">{t('usuarios.rol')}</Label>
              <NativeSelect
                id="u-rol"
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
              >
                {ROLES.map((rol) => (
                  <option key={rol} value={rol}>
                    {t(`roles.${rol}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <MensajeFormulario mensaje={mensaje} />

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setDialogoAbierto(false)} disabled={creando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" disabled={creando}>
                {creando ? t('usuarios.creando') : t('usuarios.crear')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Resultado de un diálogo: `status` si salió bien, `alert` si falló. */
function MensajeFormulario({ mensaje }: { mensaje: MensajeDialogo }) {
  if (!mensaje) return null
  return (
    <p
      role={mensaje.tipo === 'error' ? 'alert' : 'status'}
      className={
        mensaje.tipo === 'ok'
          ? 'rounded-(--radius-field) bg-success-100 px-3 py-2 text-[13px] text-success-700'
          : 'rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13px] text-critical'
      }
    >
      {mensaje.texto}
    </p>
  )
}
