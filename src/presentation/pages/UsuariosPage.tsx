import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { RotateCw, UserPlus } from 'lucide-react'

import { useUsuarios } from '@/application/hooks/useUsuarios'
import { useAuthStore } from '@/application/stores/authStore'
import { rangoPagina } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { EstadoError } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Paginacion } from '../components/Paginacion'
import { Button } from '../components/ui/button'
import { Segmentado } from '../components/ui/segmentado'
import { DialogosPersona } from './usuarios/DialogosPersona'
import { EsqueletoPersonas, FilaPersona } from './usuarios/FilaPersona'
import { CELDA, REJILLA_FILA } from './usuarios/personas'
import { PermisosPorPerfil } from './usuarios/PermisosPorPerfil'
import { BloqueVacio, CifraFrase, FrasePantalla } from './usuarios/piezas'
import { useAccionesPersonas } from './usuarios/useAccionesPersonas'

type Vista = 'personas' | 'permisos'

const CABECERA_FILA = 'text-[12.5px] leading-4 font-medium text-muted'

export function UsuariosPage() {
  const { t } = useTranslation()
  const estado = useUsuarios()
  const { usuarios, cargando } = estado
  // useUsuarios todavía no distingue un fallo de una lista vacía; la pantalla ya lo atiende.
  const errorCarga = 'errorCarga' in estado && estado.errorCarga === true
  const a = useAccionesPersonas(estado)
  const sesion = useAuthStore((s) => s.usuario)
  const [vista, setVista] = useState<Vista>('personas')

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

  // Sin cuentas, el gesto es el bloque grande de la vista de personas.
  const sinUsuarios = vista === 'personas' && !cargando && !errorCarga && usuarios.length === 0

  // Una frase en lugar de cuatro indicadores: cuántas personas pueden entrar hoy.
  const conAcceso = usuarios.filter((u) => u.is_active).length
  const desactivadas = usuarios.length - conAcceso

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader eyebrow={t('nav.seccionAdministracion')} titulo={t('usuarios.titulo')} descripcion={t('usuarios.descripcion')}>
        {/* Sin cuentas, el gesto es el bloque grande de abajo: no hacen falta dos. */}
        {!sinUsuarios && (
          <Button onClick={() => a.setDialogoAbierto(true)}>
            <UserPlus aria-hidden />
            {t('usuarios.nuevo')}
          </Button>
        )}
      </PageHeader>

      <div className="-mt-2 mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 sm:-mt-4 sm:mb-8">
        <FrasePantalla className="min-h-7">
          {!cargando && !errorCarga && usuarios.length > 0 && (
            <>
              <Trans t={t} i18nKey="usuarios.personasConAcceso" count={conAcceso} components={{ n: <CifraFrase valor={conAcceso} /> }} />
              {desactivadas > 0 && <> · {t('usuarios.cuentasDesactivadas', { count: desactivadas })}</>}
            </>
          )}
        </FrasePantalla>
        <Segmentado<Vista>
          etiqueta={t('usuarios.vistas')}
          valor={vista}
          onCambiar={setVista}
          // En oscuro el riel se hunde: si no, la opción elegida no se distingue de él.
          className="dark:bg-surface-sunken"
          botonClassName="px-3 sm:px-3.5"
          opciones={[
            { valor: 'personas', etiqueta: t('usuarios.vistaPersonas') },
            { valor: 'permisos', etiqueta: t('usuarios.vistaPermisos') },
          ]}
        />
      </div>

      {vista === 'permisos' ? (
        <PermisosPorPerfil />
      ) : cargando ? (
        <EsqueletoPersonas />
      ) : errorCarga ? (
        <EstadoError mensaje={t('usuarios.errorCargar')}>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => window.location.reload()}>
            <RotateCw aria-hidden />
            {t('comunes.recargarPagina')}
          </Button>
        </EstadoError>
      ) : usuarios.length === 0 ? (
        <BloqueVacio
          titulo={t('usuarios.sinUsuarios')}
          detalle={t('usuarios.sinUsuariosAyuda')}
          accion={t('usuarios.nuevo')}
          onAccion={() => a.setDialogoAbierto(true)}
        />
      ) : (
        <div className="animate-fade min-w-0">
          <div role="table" aria-label={t('usuarios.titulo')} className="min-w-0">
            <div role="row" className={cn('max-md:sr-only border-b border-border-strong pb-2.5 pl-14', REJILLA_FILA)}>
              <div role="columnheader" className={cn(CABECERA_FILA, CELDA.nombre)}>{t('usuarios.nombre')}</div>
              <div role="columnheader" className={cn(CABECERA_FILA, 'md:sr-only', CELDA.email)}>{t('usuarios.email')}</div>
              <div role="columnheader" className={cn(CABECERA_FILA, CELDA.rol)}>{t('usuarios.rol')}</div>
              <div role="columnheader" className={cn(CABECERA_FILA, CELDA.estado)}>{t('usuarios.estado')}</div>
              <div role="columnheader" className={cn(CABECERA_FILA, 'text-right', CELDA.opciones)}>{t('comunes.acciones')}</div>
            </div>
            {visibles.map((usuario) => (
              <FilaPersona
                key={usuario.id}
                usuario={usuario}
                esSesion={usuario.id === sesion?.id}
                // HU-41: con un solo administrador activo no se le quita el rol ni se le desactiva.
                ultimoAdmin={usuario.rol === 'administrador' && administradoresActivos <= 1}
                onCambiarRol={() => a.abrirCambioRol(usuario)}
                onDesactivar={() => a.abrirDesactivacion(usuario)}
                onTemporal={(accion) => a.setTemporalPendiente({ usuario, accion })}
              />
            ))}
          </div>
          <Paginacion total={usuarios.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
        </div>
      )}

      <DialogosPersona a={a} />
    </div>
  )
}
