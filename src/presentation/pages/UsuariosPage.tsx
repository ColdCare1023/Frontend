import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, RotateCcw, ShieldCheck, UserPlus, UserX } from 'lucide-react'

import { useUsuarios } from '@/application/hooks/useUsuarios'
import { useAuthStore } from '@/application/stores/authStore'
import type { Usuario } from '@/domain/entities/Usuario'
import { rangoPagina } from '@/lib/paginacion'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { ActionMenu, ActionMenuLabel, ActionMenuSeparator } from '../components/ActionMenu'
import { EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Paginacion } from '../components/Paginacion'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Esqueleto, EsqueletoTabla } from '../components/ui/esqueleto'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { TiraEstado } from '../components/ui/tira-estado'
import { DialogoCambioRol, DialogoDesactivar, DialogoTemporal, type AccionTemporal } from './usuarios/DialogosUsuario'
import { PanelNuevoUsuario } from './usuarios/PanelNuevoUsuario'
import { Avatar, RielUsuarios } from './usuarios/RielUsuarios'
import { useMotivoFecha } from './usuarios/utilidadesUsuarios'

/**
 * Usuarios y roles (HU-41, HU-45), Plantilla Bandeja: tabla de cuentas a la
 * izquierda y un rail de contexto (por rol, contraseña pendiente, sin
 * acceso). El alta va en un panel lateral que, al terminar, explica la
 * activación por correo; al cerrarlo la fila nueva entra resaltada.
 */
export function UsuariosPage() {
  const { t } = useTranslation()
  const { usuarios, cargando, errorCarga, reintentar, crear, desactivar, cambiarRol, asignarTemporal } = useUsuarios()
  const sesion = useAuthStore((s) => s.usuario)
  const motivoFecha = useMotivoFecha()
  // HU-41: nunca puede quedar el sistema sin un administrador activo.
  const administradoresActivos = useMemo(
    () => usuarios.filter((u) => u.rol === 'administrador' && u.is_active).length,
    [usuarios],
  )
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  const visibles = useMemo(() => usuarios.slice(...rangoPagina(pagina, tamanoPagina)), [usuarios, pagina, tamanoPagina])

  const [panelAbierto, setPanelAbierto] = useState(false)
  const [creadoEmail, setCreadoEmail] = useState<string | null>(null)
  const [resaltado, setResaltado] = useState<string | null>(null)
  const [usuarioDesactivar, setUsuarioDesactivar] = useState<Usuario | null>(null)
  const [usuarioCambiarRol, setUsuarioCambiarRol] = useState<Usuario | null>(null)
  const [temporal, setTemporal] = useState<AccionTemporal | null>(null)

  // El resalte de la fila nueva dura una vez (MOTION 4.4).
  useEffect(() => {
    if (!resaltado) return
    const id = setTimeout(() => setResaltado(null), 1600)
    return () => clearTimeout(id)
  }, [resaltado])

  const cerrarPanel = (abierto: boolean) => {
    setPanelAbierto(abierto)
    if (abierto || !creadoEmail) return
    const indice = usuarios.findIndex((u) => u.email.toLowerCase() === creadoEmail.toLowerCase())
    if (indice >= 0) {
      setPagina(Math.floor(indice / tamanoPagina) + 1)
      setResaltado(usuarios[indice].id)
    }
    setCreadoEmail(null)
  }

  const activos = usuarios.filter((u) => u.is_active)
  const pendientes = activos.filter((u) => u.debe_cambiar_password).length
  const nuevo = (
    <Button className="max-sm:w-full" onClick={() => setPanelAbierto(true)}>
      <UserPlus />
      {t('usuarios.nuevo')}
    </Button>
  )

  return (
    <div>
      <PageHeader
        titulo={t('usuarios.titulo')}
        descripcion={t('usuarios.descripcion')}
        meta={!cargando && !errorCarga && usuarios.length > 0 ? t('usuarios.meta', { count: usuarios.length }) : undefined}
      >
        {nuevo}
      </PageHeader>

      {cargando ? (
        <div role="status" className="esqueleto-diferido space-y-3">
          <span className="sr-only">{t('app.cargando')}</span>
          <Esqueleto aria-hidden className="h-16 w-full rounded-(--radius-card)" />
          <EsqueletoTabla filas={6} columnas={4} />
        </div>
      ) : errorCarga ? (
        <EstadoError mensaje={t('comunes.errorCargar')}>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void reintentar()}>
            {t('comunes.reintentar')}
          </Button>
        </EstadoError>
      ) : usuarios.length === 0 ? (
        <EstadoVacio ilustracion="sin-resultados" titulo={t('usuarios.sinUsuarios')} />
      ) : (
        <>
          <TiraEstado
            className="mb-3 xl:mb-4"
            etiqueta={t('usuarios.resumen')}
            guia={pendientes > 0 ? t('usuarios.guiaPendientes', { count: pendientes }) : t('usuarios.guiaTodoEnOrden')}
            segmentos={[
              { clave: 'activas', etiqueta: t('usuarios.conAcceso'), valor: activos.length },
              { clave: 'admins', etiqueta: t('usuarios.administradores'), valor: administradoresActivos },
              { clave: 'pendientes', etiqueta: t('usuarios.pendientePassword'), valor: pendientes, tono: pendientes > 0 ? 'aviso' : 'neutro' },
              { clave: 'inactivas', etiqueta: t('usuarios.sinAcceso'), valor: usuarios.length - activos.length },
            ]}
          />
          <div className="grid items-start gap-3 xl:grid-cols-12 xl:gap-4">
            <div className="min-w-0 xl:col-span-8 2xl:col-span-9">
              <Table mobileLayout="stack" titulo={t('usuarios.titulo')}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[48%]">{t('usuarios.nombre')}</TableHead>
                    <TableHead className="w-[22%]">{t('usuarios.rol')}</TableHead>
                    <TableHead className="w-[18%]">{t('usuarios.estado')}</TableHead>
                    <TableHead className="w-[12%] text-right">{t('comunes.acciones')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((usuario) => {
                    // HU-41: con un solo administrador activo no se le quita el rol ni se le desactiva.
                    const ultimoAdmin = usuario.rol === 'administrador' && administradoresActivos <= 1
                    const motivo = motivoFecha(usuario)
                    return (
                      <TableRow key={usuario.id} className={resaltado === usuario.id ? 'fila-resaltada' : undefined}>
                        <TableCell className="mobile-full">
                          <span className="flex min-w-0 items-center gap-3">
                            <Avatar nombre={usuario.nombre} activo={usuario.is_active} />
                            <span className="min-w-0">
                              <span className="block truncate text-body font-semibold">{usuario.nombre}</span>
                              <span className="block truncate text-meta text-muted max-sm:break-all max-sm:whitespace-normal" title={usuario.email}>
                                {usuario.email}
                              </span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell data-label={t('usuarios.rol')} className="text-body text-subtle sm:whitespace-nowrap">
                          {t(`roles.${usuario.rol}`)}
                        </TableCell>
                        <TableCell data-label={t('usuarios.estado')}>
                          {!usuario.is_active ? (
                            <>
                              <Badge variant="neutral" dot>{t('usuarios.inactivo')}</Badge>
                              {motivo && <span className="block text-meta text-faint">{motivo}</span>}
                            </>
                          ) : usuario.debe_cambiar_password ? (
                            <Badge variant="outline">
                              <KeyRound aria-hidden className="size-3.5" />
                              {t('usuarios.pendientePassword')}
                            </Badge>
                          ) : (
                            <Badge variant="ok" dot>{t('usuarios.activo')}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="mobile-full mobile-actions text-right">
                          {usuario.is_active && usuario.id === sesion?.id && (
                            // HU-41 (P8): un administrador no modifica su propia cuenta.
                            <span className="inline-flex h-11 items-center text-meta text-muted sm:h-9 sm:pointer-coarse:h-11">{t('usuarios.tuCuenta')}</span>
                          )}
                          {usuario.is_active && usuario.id !== sesion?.id && (
                            <ActionMenu label={usuario.nombre}>
                              {ultimoAdmin && <ActionMenuLabel>{t('usuarios.ultimoAdmin')}</ActionMenuLabel>}
                              <ActionMenuLabel>{t('usuarios.grupoCuenta')}</ActionMenuLabel>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={t('usuarios.cambiarRolA', { nombre: usuario.nombre })}
                                disabled={ultimoAdmin}
                                title={ultimoAdmin ? t('usuarios.ultimoAdmin') : undefined}
                                onClick={() => setUsuarioCambiarRol(usuario)}
                              >
                                <ShieldCheck />
                                {t('usuarios.cambiarRol')}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setTemporal({ usuario, accion: 'restablecer-password' })}>
                                <KeyRound />
                                {t('usuarios.restablecerPassword')}
                              </Button>
                              <ActionMenuSeparator />
                              <ActionMenuLabel>{t('usuarios.grupoRiesgo')}</ActionMenuLabel>
                              <Button
                                variant="secondary"
                                size="sm"
                                aria-label={t('usuarios.desactivarA', { nombre: usuario.nombre })}
                                data-peligro
                                disabled={ultimoAdmin}
                                title={ultimoAdmin ? t('usuarios.ultimoAdmin') : undefined}
                                onClick={() => setUsuarioDesactivar(usuario)}
                              >
                                <UserX />
                                {t('usuarios.desactivar')}
                              </Button>
                            </ActionMenu>
                          )}
                          {!usuario.is_active && (
                            <ActionMenu label={usuario.nombre}>
                              <Button variant="ghost" size="sm" onClick={() => setTemporal({ usuario, accion: 'reactivar' })}>
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
            <RielUsuarios usuarios={usuarios} />
          </div>
        </>
      )}

      <DialogoCambioRol usuario={usuarioCambiarRol} onCerrar={() => setUsuarioCambiarRol(null)} cambiarRol={cambiarRol} />
      <DialogoDesactivar usuario={usuarioDesactivar} onCerrar={() => setUsuarioDesactivar(null)} desactivar={desactivar} />
      <DialogoTemporal pendiente={temporal} onCerrar={() => setTemporal(null)} asignarTemporal={asignarTemporal} />
      <PanelNuevoUsuario
        abierto={panelAbierto}
        onAbiertoChange={cerrarPanel}
        crear={crear}
        onCreado={(_usuario, email) => setCreadoEmail(email)}
      />
    </div>
  )
}
