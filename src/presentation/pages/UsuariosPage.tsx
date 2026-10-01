import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, UserPlus, UserX, Users } from 'lucide-react'

import { useUsuarios } from '@/application/hooks/useUsuarios'
import type { MotivoDesactivacion, Usuario } from '@/domain/entities/Usuario'
import { MOTIVOS_DESACTIVACION } from '@/domain/entities/Usuario'
import { ROLES, type Rol } from '@/domain/value-objects/Rol'
import { rangoPagina } from '@/lib/paginacion'
import { Paginacion } from '../components/Paginacion'
import { ActionMenu } from '../components/ActionMenu'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Input, Label, NativeSelect } from '../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const VARIANTE_POR_ROL = {
  administrador: 'neutral',
  farmaceutico: 'neutral',
  tecnico: 'neutral',
  auditor: 'neutral',
} as const

const FORM_INICIAL = { nombre: '', email: '', password: '', rol: 'tecnico' as Rol }

export function UsuariosPage() {
  const { t } = useTranslation()
  const { usuarios, cargando, crear, desactivar, cambiarRol } = useUsuarios()
  const [pagina, setPagina] = useState(1)
  // La lista completa puede tener miles de filas; solo se pinta la página
  // visible. Al cambiar la lista (filtro nuevo) se vuelve a la primera.
  const visibles = useMemo(
    () => usuarios.slice(...rangoPagina(pagina)),
    [usuarios, pagina],
  )

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [creando, setCreando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [usuarioDesactivar, setUsuarioDesactivar] = useState<Usuario | null>(null)
  const [motivoDesactivacion, setMotivoDesactivacion] = useState<MotivoDesactivacion>(MOTIVOS_DESACTIVACION[0])
  const [desactivando, setDesactivando] = useState(false)
  const [mensajeDesactivacion, setMensajeDesactivacion] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(
    null,
  )

  // HU-41 criterio 1: cambiar el rol de un usuario YA existente, no solo
  // fijarlo al crearlo.
  const [usuarioCambiarRol, setUsuarioCambiarRol] = useState<Usuario | null>(null)
  const [rolNuevo, setRolNuevo] = useState<Rol>('tecnico')
  const [cambiandoRol, setCambiandoRol] = useState(false)
  const [mensajeCambioRol, setMensajeCambioRol] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

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
      setMensajeCambioRol({ tipo: 'error', texto: t('comunes.error') })
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
      setMensajeDesactivacion({ tipo: 'error', texto: t('comunes.error') })
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

      <div className="animate-rise border-t border-border pt-5 [&_thead]:bg-primary-tint/60 sm:[&_tbody_tr]:h-20">
        <Table mobileLayout="stack" className="min-w-[900px]" titulo={t('usuarios.titulo')} cargando={cargando}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('usuarios.nombre')}</TableHead>
              <TableHead>{t('usuarios.email')}</TableHead>
              <TableHead>{t('usuarios.rol')}</TableHead>
              <TableHead>{t('usuarios.estado')}</TableHead>
              <TableHead>{t('comunes.acciones')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableEmpty colSpan={5}>{t('app.cargando')}</TableEmpty>
            ) : usuarios.length === 0 ? (
              <TableEmpty colSpan={5}>
                <span className="inline-flex flex-col items-center gap-2">
                  <Users className="size-5 text-faint" />
                  {t('usuarios.sinUsuarios')}
                </span>
              </TableEmpty>
            ) : (
              visibles.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell data-label={t('usuarios.nombre')} className="mobile-full font-semibold">{usuario.nombre}</TableCell>
                  <TableCell data-label={t('usuarios.email')} className="mobile-full break-all text-muted">{usuario.email}</TableCell>
                  <TableCell data-label={t('usuarios.rol')}>
                    <Badge variant={VARIANTE_POR_ROL[usuario.rol]}>
                      {t(`roles.${usuario.rol}`)}
                    </Badge>
                  </TableCell>
                  <TableCell data-label={t('usuarios.estado')}>
                    {usuario.is_active ? (
                      <Badge variant="ok">{t('usuarios.activo')}</Badge>
                    ) : (
                      <Badge variant="critical">
                        {t('usuarios.inactivo')}
                        {usuario.motivo_desactivacion && (
                          <span className="sr-only"> — {usuario.motivo_desactivacion}</span>
                        )}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell data-label={t('comunes.acciones')} className="mobile-full mobile-actions text-right">
                    {usuario.is_active && (
                      <ActionMenu label={usuario.nombre}>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t('usuarios.cambiarRolA', { nombre: usuario.nombre })}
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
                          onClick={() => {
                            setUsuarioDesactivar(usuario)
                            setMotivoDesactivacion(MOTIVOS_DESACTIVACION[0])
                            setMensajeDesactivacion(null)
                          }}
                        >
                          <UserX />
                          {t('usuarios.desactivar')}
                        </Button>
                      </ActionMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Paginacion total={usuarios.length} pagina={pagina} onCambiar={setPagina} />
      </div>

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

            {mensajeCambioRol && (
              <p
                role={mensajeCambioRol.tipo === 'error' ? 'alert' : 'status'}
                className={
                  mensajeCambioRol.tipo === 'ok'
                    ? 'rounded-(--radius-field) bg-success-100 px-3 py-2 text-[13px] text-success-700'
                    : 'rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700'
                }
              >
                {mensajeCambioRol.texto}
              </p>
            )}

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

            {mensajeDesactivacion && (
              <p
                role={mensajeDesactivacion.tipo === 'error' ? 'alert' : 'status'}
                className={
                  mensajeDesactivacion.tipo === 'ok'
                    ? 'rounded-(--radius-field) bg-success-100 px-3 py-2 text-[13px] text-success-700'
                    : 'rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700'
                }
              >
                {mensajeDesactivacion.texto}
              </p>
            )}

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

            {mensaje && (
              <p
                role={mensaje.tipo === 'error' ? 'alert' : 'status'}
                className={
                  mensaje.tipo === 'ok'
                    ? 'rounded-(--radius-field) bg-success-100 px-3 py-2 text-[13px] text-success-700'
                    : 'rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700'
                }
              >
                {mensaje.texto}
              </p>
            )}

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
