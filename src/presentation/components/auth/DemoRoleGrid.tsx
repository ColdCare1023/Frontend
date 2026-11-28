import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ClipboardCheck,
  Loader2,
  ShieldCheck,
  Thermometer,
  User,
} from 'lucide-react'
import type { Rol } from '@/domain/value-objects/Rol'
import { cn } from '@/lib/utils'

interface DemoRoleConfig {
  rol: Rol
  email: string
  claveI18n: 'administrador' | 'farmaceutico' | 'tecnico' | 'auditor'
  icono: typeof ShieldCheck
}

const ROLES_DEMO: DemoRoleConfig[] = [
  { rol: 'administrador', email: 'admin@demo.pe', claveI18n: 'administrador', icono: ShieldCheck },
  { rol: 'farmaceutico', email: 'farmaceutico@demo.pe', claveI18n: 'farmaceutico', icono: Thermometer },
  { rol: 'tecnico', email: 'tecnico@demo.pe', claveI18n: 'tecnico', icono: User },
  { rol: 'auditor', email: 'auditor@demo.pe', claveI18n: 'auditor', icono: ClipboardCheck },
]

interface DemoRoleGridProps {
  onSelectRole: (email: string, rolNombre: string) => Promise<void> | void
  cargandoGeneral?: boolean
  className?: string
}

/** Compact role choices retain the existing demo authentication flow. */
export function DemoRoleGrid({
  onSelectRole,
  cargandoGeneral = false,
  className,
}: DemoRoleGridProps) {
  const { t } = useTranslation()
  const [rolActivo, setRolActivo] = useState<string | null>(null)

  const manejarClick = async (email: string, tituloRol: string) => {
    if (cargandoGeneral || rolActivo) return
    setRolActivo(tituloRol)
    try {
      await onSelectRole(email, tituloRol)
    } finally {
      setRolActivo(null)
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-body font-medium text-foreground">{t('demo.accesoRapido')}</span>
        <span className="text-meta text-faint">{t('demo.avisoTitulo')}</span>
      </div>

      {/* Feedback interactivo durante la autenticación de demo */}
      {rolActivo && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-(--radius-field) bg-secondary-tint px-3 py-2 text-xs font-medium text-marca-texto ring-1 ring-inset ring-secondary/20 animate-fade"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          <span>{t('demo.entrandoComo', { rol: rolActivo })}</span>
        </div>
      )}

      <div
        role="group"
        aria-label={t('demo.accesoRapido')}
        className="grid grid-cols-2 gap-1.5"
      >
        {ROLES_DEMO.map(({ rol, email, claveI18n, icono: Icono }) => {
          const titulo = t(`demo.roles.${claveI18n}.titulo`, {
            defaultValue: t(`roles.${rol}`, { defaultValue: rol }),
          })
          const descripcion = t(`demo.roles.${claveI18n}.descripcion`, { defaultValue: '' })
          const estaCargandoEsteRol = rolActivo === titulo
          const deshabilitado = cargandoGeneral || (rolActivo !== null && !estaCargandoEsteRol)

          return (
            <button
              key={rol}
              type="button"
              disabled={deshabilitado}
              onClick={() => void manejarClick(email, titulo)}
              data-demo-role={rol}
              className={cn(
                'group relative flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-field) border border-border bg-surface px-2.5 py-2 text-left sm:px-3',
                'transition-[border-color,background-color,transform] duration-(--duration-micro) ease-(--ease-ui) hover:border-secondary/40 hover:bg-secondary/[0.05] active:scale-[0.985] motion-reduce:active:scale-100',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                estaCargandoEsteRol && 'border-secondary/50 bg-secondary-tint',
              )}
            >
              <span
                aria-hidden
                className="flex shrink-0 items-center text-muted group-hover:text-primary-text"
              >
                {estaCargandoEsteRol ? <Loader2 className="size-4 animate-spin" /> : <Icono className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body leading-snug font-medium text-foreground">{titulo}</span>
                {descripcion && <span className="sr-only">{descripcion}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
