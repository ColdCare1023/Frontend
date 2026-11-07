import { useTranslation } from 'react-i18next'

import { MOTIVOS_DESACTIVACION, type MotivoDesactivacion } from '@/domain/entities/Usuario'
import { ROLES, tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { SECCIONES } from '../../layouts/navegacion'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { Campo, Input, NativeSelect } from '../../components/ui/input'
import { AvatarRol } from './AvatarPersona'
import { iniciales } from './personas'
import { BloqueSecreto, MensajeFormulario, PieDialogo } from './piezas'
import type { AccionesPersonas } from './useAccionesPersonas'

/** Debajo del rol: qué abrirá esa cuenta, leído de la misma lista que arma el menú. */
function AlcanceRol({ rol }: { rol: Rol }) {
  const { t } = useTranslation()
  const pantallas = SECCIONES.flatMap((seccion) => seccion.items)
  const visibles = pantallas.filter((pantalla) => tienePermiso(rol, pantalla.roles))
  return t('usuarios.alcanceRol', { n: visibles.length, total: pantallas.length, pantallas: visibles.map((p) => t(p.claveI18n)).join(', ') })
}

export function DialogosPersona({ a }: { a: AccionesPersonas }) {
  const { t } = useTranslation()
  return (
    <>
      {/* ── Diálogo de creación ─────────────────────────────── */}
      <Dialog open={a.dialogoAbierto} onOpenChange={a.setDialogoAbierto}>
        <DialogContent className="sm:max-w-xl">
          <div className="flex items-center gap-3.5 pr-10">
            <AvatarRol
              rol={a.form.rol}
              tamano="lg"
              inactivo={!iniciales(a.form.nombre)}
              texto={iniciales(a.form.nombre) || '?'}
              className="transition-transform duration-(--duration-ui) ease-(--ease-out-soft)"
            />
            <div className="min-w-0">
              <DialogTitle className="pr-0">{t('usuarios.nuevo')}</DialogTitle>
              <DialogDescription>{t('usuarios.descripcion')}</DialogDescription>
            </div>
          </div>
          <form onSubmit={a.enviar} className="mt-5 grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
            <Campo etiqueta={t('usuarios.nombre')} htmlFor="u-nombre">
              <Input
                id="u-nombre"
                required
                value={a.form.nombre}
                onChange={(e) => a.setForm({ ...a.form, nombre: e.target.value })}
              />
            </Campo>
            <Campo etiqueta={t('usuarios.email')} htmlFor="u-email">
              <Input
                id="u-email"
                type="email"
                required
                value={a.form.email}
                onChange={(e) => a.setForm({ ...a.form, email: e.target.value })}
              />
            </Campo>
            <Campo etiqueta={t('usuarios.password')} htmlFor="u-password">
              <Input
                id="u-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={a.form.password}
                onChange={(e) => a.setForm({ ...a.form, password: e.target.value })}
              />
            </Campo>
            <Campo etiqueta={t('usuarios.rol')} htmlFor="u-rol">
              <NativeSelect
                id="u-rol"
                aria-describedby="u-rol-alcance"
                value={a.form.rol}
                onChange={(e) => a.setForm({ ...a.form, rol: e.target.value as Rol })}
              >
                {ROLES.map((rol) => (
                  <option key={rol} value={rol}>
                    {t(`roles.${rol}`)}
                  </option>
                ))}
              </NativeSelect>
            </Campo>
            <p id="u-rol-alcance" className="-mt-1 text-[13px] leading-5 text-muted sm:col-span-2">
              <AlcanceRol rol={a.form.rol} />
            </p>
            <Campo etiqueta={t('usuarios.telefono')} htmlFor="u-telefono" ayuda={t('usuarios.telefonoAyuda')} className="sm:col-span-2">
              <Input
                id="u-telefono"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="+51999888777"
                pattern="^\+[1-9][0-9]{7,14}$"
                title={t('usuarios.telefonoAyuda')}
                aria-describedby="u-telefono-ayuda"
                value={a.form.telefono}
                onChange={(e) => a.setForm({ ...a.form, telefono: e.target.value })}
              />
            </Campo>

            <div className="sm:col-span-2 empty:hidden">
              <MensajeFormulario mensaje={a.mensaje} />
            </div>

            <PieDialogo className="mt-2 sm:col-span-2">
              <Button variant="ghost" onClick={() => a.setDialogoAbierto(false)} disabled={a.creando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" disabled={a.creando}>
                {a.creando ? t('usuarios.creando') : t('usuarios.crear')}
              </Button>
            </PieDialogo>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo de cambio de rol (HU-41) ────────────────── */}
      <Dialog open={a.usuarioCambiarRol !== null} onOpenChange={(abierto) => !abierto && a.setUsuarioCambiarRol(null)}>
        <DialogContent>
          <div className="flex items-center gap-3.5 pr-10">
            <AvatarRol rol={a.rolNuevo} tamano="lg" texto={iniciales(a.usuarioCambiarRol?.nombre ?? '')} />
            <DialogTitle className="min-w-0 pr-0">{t('usuarios.cambiarRol')}</DialogTitle>
          </div>
          <DialogDescription className="mt-3">
            {t('usuarios.confirmarCambiarRol', { nombre: a.usuarioCambiarRol?.nombre ?? '' })}
          </DialogDescription>
          <form onSubmit={a.enviarCambioRol} className="mt-4 space-y-3">
            <Campo etiqueta={t('usuarios.nuevoRol')} htmlFor="ur-rol">
              <NativeSelect
                id="ur-rol"
                aria-describedby="ur-rol-alcance"
                value={a.rolNuevo}
                onChange={(e) => a.setRolNuevo(e.target.value as Rol)}
              >
                {ROLES.map((rol) => (
                  <option key={rol} value={rol}>
                    {t(`roles.${rol}`)}
                  </option>
                ))}
              </NativeSelect>
            </Campo>
            <p id="ur-rol-alcance" className="text-[13px] leading-5 text-muted">
              <AlcanceRol rol={a.rolNuevo} />
            </p>

            <MensajeFormulario mensaje={a.mensajeCambioRol} />

            <PieDialogo>
              <Button variant="ghost" onClick={() => a.setUsuarioCambiarRol(null)} disabled={a.cambiandoRol}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" disabled={a.cambiandoRol}>
                {a.cambiandoRol ? t('usuarios.cambiando') : t('usuarios.cambiarRol')}
              </Button>
            </PieDialogo>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo de desactivación (HU-45) ────────────────── */}
      <Dialog open={a.usuarioDesactivar !== null} onOpenChange={(abierto) => !abierto && a.setUsuarioDesactivar(null)}>
        <DialogContent destructivo>
          <div className="flex items-center gap-3.5 pr-10">
            <AvatarRol rol={a.usuarioDesactivar?.rol ?? 'tecnico'} tamano="lg" inactivo texto={iniciales(a.usuarioDesactivar?.nombre ?? '')} />
            <DialogTitle className="min-w-0 pr-0">{t('usuarios.desactivar')}</DialogTitle>
          </div>
          <DialogDescription className="mt-3">
            {t('usuarios.confirmarDesactivar', { nombre: a.usuarioDesactivar?.nombre ?? '' })}
          </DialogDescription>
          <form onSubmit={a.enviarDesactivacion} className="mt-4 space-y-3">
            <Campo etiqueta={t('usuarios.motivo')} htmlFor="ud-motivo">
              <NativeSelect
                id="ud-motivo"
                value={a.motivoDesactivacion}
                onChange={(e) => a.setMotivoDesactivacion(e.target.value as MotivoDesactivacion)}
              >
                {MOTIVOS_DESACTIVACION.map((motivo) => (
                  <option key={motivo} value={motivo}>
                    {t(`usuarios.motivos.${motivo}`)}
                  </option>
                ))}
              </NativeSelect>
            </Campo>

            <MensajeFormulario mensaje={a.mensajeDesactivacion} />

            <PieDialogo>
              <Button variant="ghost" onClick={() => a.setUsuarioDesactivar(null)} disabled={a.desactivando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" variant="danger" disabled={a.desactivando}>
                {a.desactivando ? t('dispositivos.procesando') : t('dispositivos.confirmar')}
              </Button>
            </PieDialogo>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── FE-004: contraseña temporal (restablecer / reactivar) ── */}
      <Dialog open={a.temporalPendiente !== null} onOpenChange={(abierto) => !abierto && a.cerrarTemporal()}>
        <DialogContent>
          <DialogTitle>
            {a.temporalEmitida
              ? t('usuarios.passwordTemporalTitulo')
              : t(a.temporalPendiente?.accion === 'reactivar' ? 'usuarios.reactivar' : 'usuarios.restablecerPassword')}
          </DialogTitle>
          <DialogDescription>
            {a.temporalEmitida
              ? t('usuarios.passwordTemporalDetalle', { nombre: a.temporalPendiente?.usuario.nombre ?? '' })
              : t(
                  a.temporalPendiente?.accion === 'reactivar' ? 'usuarios.reactivarConfirmar' : 'usuarios.restablecerConfirmar',
                  { nombre: a.temporalPendiente?.usuario.nombre ?? '' },
                )}
          </DialogDescription>
          {a.temporalEmitida ? (
            <div className="mt-4">
              <BloqueSecreto
                valor={a.temporalEmitida.password_temporal}
                testId="password-temporal"
                copiado={a.temporalCopiada}
                textoCopiar={t('usuarios.copiar')}
                textoCopiado={t('usuarios.copiado')}
                onCopiar={() => void a.copiarTemporal()}
              />
              <PieDialogo>
                <Button variant="ghost" onClick={a.cerrarTemporal}>{t('comunes.cerrar')}</Button>
              </PieDialogo>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <MensajeFormulario mensaje={a.errorTemporal ? { tipo: 'error', texto: a.errorTemporal } : null} />
              <PieDialogo>
                <Button variant="ghost" onClick={a.cerrarTemporal} disabled={a.procesandoTemporal}>
                  {t('usuarios.cancelar')}
                </Button>
                <Button onClick={() => void a.confirmarTemporal()} disabled={a.procesandoTemporal}>
                  {a.procesandoTemporal ? t('dispositivos.procesando') : t('usuarios.confirmar')}
                </Button>
              </PieDialogo>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
