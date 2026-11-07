import { useTranslation } from 'react-i18next'
import { KeyRound, RotateCcw, ShieldCheck, UserX } from 'lucide-react'

import type { Usuario } from '@/domain/entities/Usuario'
import { cn } from '@/lib/utils'
import { Badge } from '../../components/ui/badge'
import { MenuItem, MenuLabel, MenuSeparator } from '../../components/ui/menu'
import { AvatarRol } from './AvatarPersona'
import { CELDA, iniciales, REJILLA_FILA } from './personas'
import { MenuOpciones } from './piezas'
import type { AccionTemporal } from './useAccionesPersonas'

function EstadoPersona({ usuario }: { usuario: Usuario }) {
  const { t } = useTranslation()
  if (usuario.is_active) {
    return (
      <span className="inline-flex items-center gap-2 text-[14px] leading-5 text-foreground">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-secondary" />
        {t('usuarios.activo')}
      </span>
    )
  }
  const motivo = usuario.motivo_desactivacion
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 text-[14px] leading-5 text-muted">
      <span aria-hidden className="size-2 shrink-0 rounded-full border border-faint" />
      <span className="font-medium">{t('usuarios.inactivo')}</span>
      {motivo && <span className="text-[13px]">· {t(`usuarios.motivos.${motivo}`, { defaultValue: motivo })}</span>}
    </span>
  )
}

/** Una persona: quién es, qué perfil tiene y si puede entrar. */
export function FilaPersona({
  usuario,
  esSesion,
  ultimoAdmin,
  onCambiarRol,
  onDesactivar,
  onTemporal,
}: {
  usuario: Usuario
  esSesion: boolean
  ultimoAdmin: boolean
  onCambiarRol: () => void
  onDesactivar: () => void
  onTemporal: (accion: AccionTemporal) => void
}) {
  const { t } = useTranslation()
  const conMenu = !(usuario.is_active && esSesion)
  return (
    <div
      role="row"
      className={cn(
        'group relative isolate flex min-h-[76px] flex-wrap content-center items-center gap-x-3 border-b border-border py-3.5 pl-14 last:border-b-0 md:grid md:min-h-[72px] md:py-3',
        conMenu && 'pr-12 md:pr-0',
        REJILLA_FILA,
      )}
    >
      <span
        aria-hidden
        className="absolute -inset-x-3 inset-y-1 -z-10 hidden rounded-(--radius-card) bg-surface opacity-0 shadow-(--shadow-card) transition-opacity duration-(--duration-ui) ease-(--ease-out-soft) group-hover:opacity-100 md:block"
      />
      <AvatarRol
        rol={usuario.rol}
        inactivo={!usuario.is_active}
        texto={iniciales(usuario.nombre)}
        className="absolute left-0 top-4 md:top-1/2 md:-translate-y-1/2"
      />
      <div role="rowheader" className={cn('w-full min-w-0 md:self-end', CELDA.nombre)}>
        <span className={cn('block text-[16px] leading-6 font-semibold tracking-[-0.015em] [overflow-wrap:anywhere] sm:text-[17px]', usuario.is_active ? 'text-foreground' : 'text-muted')}>
          {usuario.nombre}
        </span>
      </div>
      <div role="cell" className={cn('w-full min-w-0 text-[13.5px] leading-5 text-muted [overflow-wrap:anywhere] md:self-start', CELDA.email)}>
        {usuario.email}
      </div>
      <div role="cell" className={cn('mt-1 min-w-0 text-[13.5px] leading-5 text-foreground md:mt-0 md:self-center md:text-[14px]', CELDA.rol)}>
        {t(`roles.${usuario.rol}`)}
      </div>
      <div role="cell" className={cn('mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:mt-0 md:self-center', CELDA.estado)}>
        <EstadoPersona usuario={usuario} />
        {usuario.debe_cambiar_password && usuario.is_active && (
          <Badge variant="warn" title={t('usuarios.passwordPendienteAyuda')}>
            {t('usuarios.passwordTemporalTitulo')}
          </Badge>
        )}
      </div>
      <div
        role="cell"
        className={cn(
          'md:static md:justify-self-end md:self-center',
          conMenu ? 'absolute right-0 top-2.5' : 'mt-1 md:mt-0 md:text-right',
          CELDA.opciones,
        )}
      >
        {/* HU-41 (P8): un administrador no modifica su propia cuenta. */}
        {!conMenu && (
          <span className="capsula-clara inline-flex h-7 items-center whitespace-nowrap px-2.5 text-[12.5px] font-medium text-muted">
            {t('usuarios.tuCuenta')}
          </span>
        )}
        {conMenu && usuario.is_active && (
          <MenuOpciones etiqueta={usuario.nombre}>
            {ultimoAdmin && <MenuLabel className="max-w-64 leading-4">{t('usuarios.ultimoAdmin')}</MenuLabel>}
            <MenuItem
              aria-label={t('usuarios.cambiarRolA', { nombre: usuario.nombre })}
              disabled={ultimoAdmin}
              title={ultimoAdmin ? t('usuarios.ultimoAdmin') : undefined}
              onSelect={onCambiarRol}
            >
              <ShieldCheck aria-hidden />
              {t('usuarios.cambiarRol')}
            </MenuItem>
            <MenuItem onSelect={() => onTemporal('restablecer-password')}>
              <KeyRound aria-hidden />
              {t('usuarios.restablecerPassword')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              aria-label={t('usuarios.desactivarA', { nombre: usuario.nombre })}
              disabled={ultimoAdmin}
              title={ultimoAdmin ? t('usuarios.ultimoAdmin') : undefined}
              onSelect={onDesactivar}
              className="text-critical"
            >
              <UserX aria-hidden />
              {t('usuarios.desactivar')}
            </MenuItem>
          </MenuOpciones>
        )}
        {conMenu && !usuario.is_active && (
          <MenuOpciones etiqueta={usuario.nombre}>
            <MenuItem onSelect={() => onTemporal('reactivar')}>
              <RotateCcw aria-hidden />
              {t('usuarios.reactivar')}
            </MenuItem>
          </MenuOpciones>
        )}
      </div>
    </div>
  )
}

/** Mientras llegan las cuentas: filas con la misma geometría, sin saltos al cargar. */
export function EsqueletoPersonas() {
  const { t } = useTranslation()
  return (
    <div role="status" className="animate-fade">
      <span className="sr-only">{t('app.cargando')}</span>
      <div aria-hidden className="divide-y divide-border">
        {[46, 38, 42, 34, 44].map((ancho) => (
          <div key={ancho} className="flex min-h-[76px] items-center gap-3 md:min-h-[72px]">
            <div className="esqueleto size-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="esqueleto h-4 rounded" style={{ width: `${ancho}%` }} />
              <div className="esqueleto h-3 rounded" style={{ width: `${ancho + 12}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
