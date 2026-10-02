import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import {
  ChevronRight,
  ClipboardCheck,
  Loader2,
  ShieldCheck,
  Thermometer,
  User,
} from 'lucide-react'
import type { Rol } from '@/domain/value-objects/Rol'
import { cn } from '@/lib/utils'
import {
  demoGridVariants,
  demoCardVariants,
  demoCardInteractiveMotion,
  getAccessibleVariants,
} from './loginMotion'

interface DemoRoleConfig {
  rol: Rol
  email: string
  claveI18n: 'administrador' | 'farmaceutico' | 'tecnico' | 'auditor'
  icono: typeof ShieldCheck
  colorFondo: string
  colorTexto: string
}

const ROLES_DEMO: DemoRoleConfig[] = [
  {
    rol: 'administrador',
    email: 'admin@demo.pe',
    claveI18n: 'administrador',
    icono: ShieldCheck,
    colorFondo: 'bg-primary-tint',
    colorTexto: 'text-primary',
  },
  {
    rol: 'farmaceutico',
    email: 'farmaceutico@demo.pe',
    claveI18n: 'farmaceutico',
    icono: Thermometer,
    colorFondo: 'bg-secondary-tint',
    colorTexto: 'text-glacier-700',
  },
  {
    rol: 'tecnico',
    email: 'tecnico@demo.pe',
    claveI18n: 'tecnico',
    icono: User,
    colorFondo: 'bg-primary-tint',
    colorTexto: 'text-primary',
  },
  {
    rol: 'auditor',
    email: 'cajero@demo.pe',
    claveI18n: 'auditor',
    icono: ClipboardCheck,
    colorFondo: 'bg-primary-tint',
    colorTexto: 'text-primary',
  },
]

interface DemoRoleGridProps {
  onSelectRole: (email: string, rolNombre: string) => Promise<void> | void
  cargandoGeneral?: boolean
  hideHeader?: boolean
  className?: string
}

/** Compact role choices retain the existing demo authentication flow. */
export function DemoRoleGrid({
  onSelectRole,
  cargandoGeneral = false,
  hideHeader = false,
  className,
}: DemoRoleGridProps) {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
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
    <div className={cn('space-y-2', !hideHeader && 'pt-4 border-t border-border', className)}>
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
              {t('demo.accesoRapido', { defaultValue: 'ACCESO DE DEMOSTRACIÓN' })}
            </span>
          </div>
          <span className="text-xs text-faint">
            {t('demo.accesoDetalle', { defaultValue: 'Explora el sistema con datos simulados.' })}
          </span>
        </div>
      )}

      {/* Feedback interactivo durante la autenticación de demo */}
      {rolActivo && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-tint px-3.5 py-2 text-xs font-semibold text-primary animate-fade"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          <span>{t('demo.entrandoComo', { rol: rolActivo, defaultValue: `Entrando como ${rolActivo}…` })}</span>
        </div>
      )}

      {/* Grid 2x2 interactivo animado */}
      <motion.div
        role="group"
        aria-label={t('demo.accesoRapido', { defaultValue: 'Acceso de demostración' })}
        variants={getAccessibleVariants(demoGridVariants, shouldReduceMotion)}
        initial={false}
        animate="visible"
        className="grid grid-cols-1 gap-0 overflow-hidden rounded-(--radius-field) border border-border min-[480px]:grid-cols-2 min-[480px]:gap-px min-[480px]:bg-border"
      >
        {ROLES_DEMO.map(({ rol, email, claveI18n, icono: Icono, colorFondo, colorTexto }) => {
          const titulo = t(`demo.roles.${claveI18n}.titulo`, {
            defaultValue: t(`roles.${rol}`, { defaultValue: rol }),
          })
          const descripcion = t(`demo.roles.${claveI18n}.descripcion`, {
            defaultValue: '',
          })
          const estaCargandoEsteRol = rolActivo === titulo
          const deshabilitado = cargandoGeneral || (rolActivo !== null && !estaCargandoEsteRol)

          return (
            <motion.button
              key={rol}
              type="button"
              disabled={deshabilitado}
              variants={getAccessibleVariants(demoCardVariants, shouldReduceMotion)}
              whileHover={shouldReduceMotion ? undefined : demoCardInteractiveMotion.whileHover}
              whileTap={shouldReduceMotion ? undefined : demoCardInteractiveMotion.whileTap}
              onClick={() => void manejarClick(email, titulo)}
              data-demo-role={rol}
              className={cn(
                'group relative flex min-h-[58px] items-center gap-2.5 border-b border-border bg-surface px-3 py-2.5 text-left transition-colors cursor-pointer last:border-b-0 min-[480px]:border-b-0',
                'hover:bg-primary-tint focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
                'disabled:cursor-not-allowed disabled:opacity-50',
                estaCargandoEsteRol && 'bg-primary-tint',
              )}
            >
              <div
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
                  colorFondo,
                  colorTexto,
                  estaCargandoEsteRol && 'bg-primary-tint',
                )}
              >
                {estaCargandoEsteRol ? (
                  <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                ) : (
                  <Icono className="size-4.5" aria-hidden />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground group-hover:text-primary leading-snug transition-colors">
                  {titulo}
                </p>
                {descripcion && (
                  <p className="text-xs text-muted leading-tight mt-0.5">
                    {descripcion}
                  </p>
                )}
              </div>

              <ChevronRight
                className="size-4 text-faint group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0"
                aria-hidden
              />
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}
