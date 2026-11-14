import { useTranslation } from 'react-i18next'

import type { Usuario } from '@/domain/entities/Usuario'
import { ROLES } from '@/domain/value-objects/Rol'
import { cn } from '@/lib/utils'
import { iniciales, useMotivoFecha } from './utilidadesUsuarios'

const MAX_FILAS = 5

export function Avatar({ nombre, activo = true, pequeno = false }: { nombre: string; activo?: boolean; pequeno?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-surface-sunken font-semibold ring-1 ring-inset ring-border',
        pequeno ? 'size-6 text-micro' : 'size-8 text-meta',
        activo ? 'text-subtle' : 'text-faint',
      )}
    >
      {iniciales(nombre)}
    </span>
  )
}

/** Rail de contexto (Plantilla Bandeja): cuentas por rol, pendientes y sin acceso. */
export function RielUsuarios({ usuarios }: { usuarios: readonly Usuario[] }) {
  const { t } = useTranslation()
  const motivoFecha = useMotivoFecha()
  const activos = usuarios.filter((u) => u.is_active)
  const porRol = ROLES.map((rol) => ({ rol, n: activos.filter((u) => u.rol === rol).length }))
  const maximo = Math.max(1, ...porRol.map((r) => r.n))
  const pendientes = activos.filter((u) => u.debe_cambiar_password)
  const sinAcceso = usuarios.filter((u) => !u.is_active)

  return (
    <aside aria-label={t('usuarios.rielEtiqueta')} className="grid gap-3 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1 2xl:col-span-3">
      <section aria-labelledby="riel-por-rol" className="superficie p-4">
        <h2 id="riel-por-rol" className="text-title text-foreground">{t('usuarios.rielPorRol')}</h2>
        <ul className="mt-2">
          {porRol.map(({ rol, n }) => (
            <li key={rol} data-rol={rol} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-2">
              <span className="text-body text-foreground">{t(`roles.${rol}`)}</span>
              <span className="nums text-body font-semibold text-foreground">{n}</span>
              <span aria-hidden className="col-span-2 h-1 overflow-hidden rounded-full bg-surface-sunken">
                <span className="block h-full origin-left rounded-full bg-grafica-1" style={{ transform: `scaleX(${n / maximo})` }} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="riel-pendientes" className="superficie p-4">
        <h2 id="riel-pendientes" className="text-title text-foreground">{t('usuarios.rielPendientes')}</h2>
        {pendientes.length === 0 ? (
          <p className="mt-2 text-meta text-muted">{t('usuarios.rielPendientesVacio')}</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {pendientes.slice(0, MAX_FILAS).map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2">
                <Avatar nombre={u.nombre} pequeno />
                <span className="min-w-0">
                  <span className="block truncate text-body text-foreground">{u.nombre}</span>
                  <span className="block text-meta text-muted">{t(`roles.${u.rol}`)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 border-t border-border pt-2 text-meta text-muted">{t('usuarios.rielPendientesAyuda')}</p>
      </section>

      <section aria-labelledby="riel-sin-acceso" className="superficie p-4 md:col-span-2 xl:col-span-1">
        <h2 id="riel-sin-acceso" className="text-title text-foreground">{t('usuarios.sinAcceso')}</h2>
        {sinAcceso.length === 0 ? (
          <p className="mt-2 text-meta text-muted">{t('usuarios.rielSinAccesoVacio')}</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {sinAcceso.slice(0, MAX_FILAS).map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2">
                <Avatar nombre={u.nombre} activo={false} pequeno />
                <span className="min-w-0">
                  <span className="block truncate text-body text-foreground">{u.nombre}</span>
                  {motivoFecha(u) && <span className="block text-meta text-muted">{motivoFecha(u)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}
