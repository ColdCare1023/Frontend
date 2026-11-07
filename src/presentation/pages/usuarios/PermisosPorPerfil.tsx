import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

import { ROLES, tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { cn } from '@/lib/utils'
import { Detalles } from '../../components/ui/detalles'
import { SECCIONES, type ItemNav } from '../../layouts/navegacion'
import { AvatarRol } from './AvatarPersona'

/** Pantallas que abre un perfil, contadas en la misma lista que arma el menú. */
function pantallasDe(rol: Rol): number {
  return SECCIONES.flatMap((seccion) => seccion.items).filter((item) => tienePermiso(rol, item.roles)).length
}

/**
 * Celda de la tabla. Los permisos contiguos se funden en una sola banda: de un vistazo se
 * ve quién comparte qué y dónde se corta el acceso.
 */
function CeldaPermiso({ pantalla, indice }: { pantalla: ItemNav; indice: number }) {
  const { t } = useTranslation()
  const rol = ROLES[indice]
  const permitido = tienePermiso(rol, pantalla.roles)
  const previo = indice > 0 && tienePermiso(ROLES[indice - 1], pantalla.roles)
  const siguiente = indice < ROLES.length - 1 && tienePermiso(ROLES[indice + 1], pantalla.roles)
  return (
    <td className="p-0">
      <span className="relative flex h-8 items-center justify-center">
        {permitido ? (
          <>
            <span
              aria-hidden
              className={cn(
                'absolute inset-y-0.5 inset-x-0 bg-primary',
                !previo && 'left-0.5 rounded-l-full sm:left-2',
                !siguiente && 'right-0.5 rounded-r-full sm:right-2',
              )}
            />
            <Check aria-hidden className="relative size-4 text-on-primary" strokeWidth={2.75} />
          </>
        ) : (
          <span aria-hidden className="size-1 rounded-full bg-faint opacity-60" />
        )}
      </span>
      <span className="sr-only">{t(permitido ? 'usuarios.permisos.permitido' : 'usuarios.permisos.denegado')}</span>
    </td>
  )
}

/**
 * Qué puede hacer cada rol, en una frase de botica. La tabla de pantallas, leída de la misma lista
 * que arma el menú, queda a un clic para quien necesite el detalle.
 */
export function PermisosPorPerfil() {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="permisos-perfil" className="animate-fade min-w-0">
      <h2 id="permisos-perfil" className="text-[22px] leading-7 font-semibold tracking-[-0.025em] text-foreground sm:text-[26px] sm:leading-8">
        {t('usuarios.permisos.tituloSimple')}
      </h2>

      <ul className="mt-4 border-t border-border-strong sm:mt-5">
        {ROLES.map((rol) => (
          <li key={rol} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-1 border-b border-border py-4 md:grid-cols-[auto_minmax(0,16rem)_minmax(0,1fr)] md:items-center md:gap-x-6">
            <AvatarRol rol={rol} texto={t(`usuarios.permisos.sigla.${rol}`)} className="row-span-2 md:row-span-1" />
            <p className="text-[17px] leading-6 font-semibold tracking-[-0.015em] text-foreground">{t(`roles.${rol}`)}</p>
            <p className="col-start-2 text-[15px] leading-6 text-muted md:col-start-3">{t(`usuarios.permisos.resumen.${rol}`)}</p>
          </li>
        ))}
      </ul>

      <Detalles titulo={t('usuarios.permisos.verTabla')} className="mt-4">
        <TablaPermisos />
      </Detalles>
    </section>
  )
}

/** Qué pantallas abre cada perfil, leído de la misma lista que arma el menú. */
function TablaPermisos() {
  const { t } = useTranslation()
  return (
    <>
      {/* En un teléfono las columnas solo caben con su sigla: aquí se dice cuál es cuál. */}
      <ul aria-hidden className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 md:hidden">
        {ROLES.map((rol) => (
          <li key={rol} className="flex min-w-0 items-center gap-2 text-[13px] leading-4 text-muted">
            <AvatarRol rol={rol} tamano="sm" texto={t(`usuarios.permisos.sigla.${rol}`)} />
            <span className="min-w-0">{t(`roles.${rol}`)}</span>
          </li>
        ))}
      </ul>

      <table className="mt-4 w-full table-fixed border-collapse text-sm md:mt-2">
        <caption className="sr-only">{t('usuarios.permisos.titulo')}</caption>
        <thead>
          <tr className="border-b border-border-strong">
            <th scope="col" className="w-[42%] pb-3 text-left align-bottom text-[12.5px] font-medium text-muted md:w-[28%]">
              {t('usuarios.permisos.pantalla')}
            </th>
            {ROLES.map((rol) => (
              <th key={rol} scope="col" className="px-0 pb-3 align-bottom font-normal md:px-2">
                <span className="flex flex-col items-center gap-1.5 text-center">
                  <AvatarRol rol={rol} tamano="sm" texto={t(`usuarios.permisos.sigla.${rol}`)} className="md:size-11 md:text-[15px]" />
                  <span className="sr-only text-[13px] leading-4 font-semibold text-foreground md:not-sr-only">{t(`roles.${rol}`)}</span>
                  <span className="nums hidden text-xs leading-4 text-muted md:block">
                    {t('usuarios.permisos.pantallas', { count: pantallasDe(rol) })}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECCIONES.map((seccion) => (
            <Fragment key={seccion.claveI18n}>
              <tr>
                <th scope="colgroup" colSpan={ROLES.length + 1} className="pb-1 pt-5 text-left text-[12.5px] font-medium text-muted">
                  {t(seccion.claveI18n)}
                </th>
              </tr>
              {seccion.items.map((pantalla) => (
                <tr key={pantalla.ruta}>
                  <th scope="row" className="py-0.5 pr-1 text-left font-medium text-foreground">
                    <span className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                      <pantalla.icono aria-hidden className="size-4 shrink-0 text-faint" />
                      <span className="min-w-0 text-[13px] leading-4 sm:text-sm sm:leading-5">{t(pantalla.claveI18n)}</span>
                    </span>
                  </th>
                  {ROLES.map((rol, indice) => (
                    <CeldaPermiso key={rol} pantalla={pantalla} indice={indice} />
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </>
  )
}
