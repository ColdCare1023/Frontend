import { SeccionDetalle } from '@/presentation/components/ui/seccion-detalle'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, KeyRound, Search, RotateCcw, ShieldCheck, UserPlus, UserX } from 'lucide-react'

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
import { Input, NativeSelect } from '../components/ui/input'
import { EsqueletoTabla } from '../components/ui/esqueleto'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { TiraEstado } from '../components/ui/tira-estado'
import { DialogoCambioRol, DialogoDesactivar, DialogoTemporal, type AccionTemporal } from './usuarios/DialogosUsuario'
import { PanelNuevoUsuario } from './usuarios/PanelNuevoUsuario'
import { RielUsuarios } from './usuarios/RielUsuarios'
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
  const [consulta, setConsulta] = useState('')
  const [estadoCuenta, setEstadoCuenta] = useState('')
  const busqueda = consulta.trim().toLocaleLowerCase()
  const coincidentes = useMemo(() => usuarios.filter((u) => {
    if (estadoCuenta === 'pendiente' && (!u.is_active || !u.debe_cambiar_password)) return false
    if (estadoCuenta === 'inactiva' && u.is_active) return false
    return !busqueda || [u.nombre, u.email].some((v) => v.toLocaleLowerCase().includes(busqueda))
  }), [usuarios, busqueda, estadoCuenta])
  const paginaActual = Math.min(pagina, Math.max(1, Math.ceil(coincidentes.length / tamanoPagina)))
  const visibles = useMemo(() => coincidentes.slice(...rangoPagina(paginaActual, tamanoPagina)), [coincidentes, paginaActual, tamanoPagina])
  const nombresRepetidos = useMemo(() => {
    const vistos = new Set<string>()
    const duplicados = new Set<string>()
    for (const u of usuarios) {
      const nombre = u.nombre.trim().toLocaleLowerCase()
      if (vistos.has(nombre)) duplicados.add(nombre)
      vistos.add(nombre)
    }
    return duplicados
  }, [usuarios])

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
      setConsulta('')
      setEstadoCuenta('')
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
        meta={!cargando && !errorCarga && usuarios.length > 0 ? t('usuarios.meta', { count: usuarios.length }) : undefined}
      >
        {nuevo}
      </PageHeader>

      {cargando ? (
        <div role="status" className="esqueleto-diferido space-y-3">
          <span className="sr-only">{t('app.cargando')}</span>
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
          <div className="grid items-start gap-3 xl:grid-cols-12 xl:gap-4">
            {/* El recuento y la paginación van dentro de la tarjeta, como en
                Alertas y Dispositivos (antes quedaban sueltos debajo). */}
            <div className="superficie min-w-0 overflow-hidden xl:col-span-12">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
                <label className="relative block min-w-40 max-w-sm flex-1">
                  <span className="sr-only">{t('lectura.buscarCuenta')}</span>
                  <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                  <Input className="pl-9" type="search" value={consulta} placeholder={t('lectura.buscarCuenta')}
                    onChange={(e) => { setConsulta(e.target.value); setPagina(1) }} />
                </label>
                {(pendientes > 0 || activos.length !== usuarios.length || estadoCuenta) && (
                  <NativeSelect aria-label={t('usuarios.estado')} className="w-auto max-w-full"
                    value={estadoCuenta} onChange={(e) => { setEstadoCuenta(e.target.value); setPagina(1) }}>
                    <option value="">{t('usuarios.todosEstados')}</option>
                    <option value="pendiente">{t('usuarios.pendientePassword')}</option>
                    <option value="inactiva">{t('usuarios.sinAcceso')}</option>
                  </NativeSelect>
                )}
              </div>
              <Table variante="embebida" mobileLayout="stack" titulo={t('usuarios.titulo')}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('usuarios.nombre')}</TableHead>
                    <TableHead className="w-[18%]">{t('usuarios.estado')}</TableHead>
                    <TableHead className="w-[12%] text-right">{t('comunes.acciones')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coincidentes.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="mobile-full py-4 text-subtle">{t('lectura.cuentaSinResultados')}</TableCell></TableRow>
                  )}
                  {visibles.map((usuario) => {
                    // HU-41: con un solo administrador activo no se le quita el rol ni se le desactiva.
                    const ultimoAdmin = usuario.rol === 'administrador' && administradoresActivos <= 1
                    const motivo = motivoFecha(usuario)
                    return (
                      <TableRow key={usuario.id} className={resaltado === usuario.id ? 'fila-resaltada' : undefined}>
                        <TableCell className="mobile-full">
                          <details className="group/usuario" open={nombresRepetidos.has(usuario.nombre.trim().toLocaleLowerCase()) || (busqueda && usuario.email.toLocaleLowerCase().includes(busqueda)) || undefined}>
                            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                              <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted group-open/usuario:rotate-90" />
                              <span className="min-w-0">
                                <span className="block break-words text-body font-semibold">{usuario.nombre}</span>
                                <span className="sr-only">{t('usuarios.email')}</span>
                                <span className="block text-meta text-muted">{t(`roles.${usuario.rol}`)}</span>
                              </span>
                            </summary>
                            <p className="break-all pt-0.5 pb-1 pl-5 text-meta text-subtle">{usuario.email}</p>
                          </details>
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
                        {/* En móvil, estado y opciones comparten la última fila de la ficha. */}
                        <TableCell className="mobile-actions text-right max-sm:self-end max-sm:justify-self-end">
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
              <div className="border-t border-border px-4 py-2 empty:hidden [&>*]:mt-0">
                <Paginacion total={coincidentes.length} pagina={paginaActual} onCambiar={setPagina} tamano={tamanoPagina} />
              </div>
            </div>
            <SeccionDetalle titulo={t('lectura.cuentas')} className="xl:col-span-12">
              <TiraEstado
                etiqueta={t('usuarios.resumen')}
                apilarGuia
                guia={pendientes > 0 ? t('usuarios.guiaPendientes', { count: pendientes }) : t('usuarios.guiaTodoEnOrden')}
                segmentos={[
                  { clave: 'activas', etiqueta: t('usuarios.conAcceso'), valor: activos.length },
                  {
                    clave: 'admins',
                    // A 375 px «Administradores activos» se cortaba: etiqueta corta solo en móvil.
                    etiqueta: (
                      <>
                        <span className="sm:hidden">{t('usuarios.administradoresCorto')}</span>
                        <span className="max-sm:hidden">{t('usuarios.administradores')}</span>
                      </>
                    ),
                    valor: administradoresActivos,
                  },
                  { clave: 'pendientes', etiqueta: t('usuarios.pendientePassword'), valor: pendientes, tono: pendientes > 0 ? 'aviso' : 'neutro' },
                  { clave: 'inactivas', etiqueta: t('usuarios.sinAcceso'), valor: usuarios.length - activos.length },
                ]}
              />
              <RielUsuarios usuarios={usuarios} />
            </SeccionDetalle>
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
