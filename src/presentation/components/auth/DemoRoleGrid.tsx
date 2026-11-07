import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardCheck, Loader2, ShieldCheck, Thermometer, User } from 'lucide-react'
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

/**
 * Accesos de demostración en cápsulas negras, a la vista y con el pulgar en mente. Mientras
 * entra un rol, su cápsula gira y las demás se apagan. El estado ocupa la línea del título,
 * que no se parte en ningún ancho: el formulario no salta.
 */
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
    <div className={cn('space-y-2.5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        {!rolActivo && (
          <span className="text-[13px] leading-5 font-medium text-foreground">{t('demo.accesoRapido')}</span>
        )}
        {/* Siempre presente: un lector de pantalla anuncia el cambio de texto. */}
        <span
          role="status"
          aria-live="polite"
          className={cn('text-xs leading-5', rolActivo ? 'font-medium text-primary' : 'text-faint')}
        >
          {rolActivo ? t('demo.entrandoComo', { rol: rolActivo }) : t('demo.accesoDetalle')}
        </span>
      </div>

      <div role="group" aria-label={t('demo.accesoRapido')} className="acceso-roles">
        {ROLES_DEMO.map(({ rol, email, claveI18n, icono: Icono }) => {
          const titulo = t(`demo.roles.${claveI18n}.titulo`, {
            defaultValue: t(`roles.${rol}`, { defaultValue: rol }),
          })
          const descripcion = t(`demo.roles.${claveI18n}.descripcion`, { defaultValue: '' })
          const estaCargandoEsteRol = rolActivo === titulo

          return (
            <button
              key={rol}
              type="button"
              disabled={cargandoGeneral || rolActivo !== null}
              aria-busy={estaCargandoEsteRol || undefined}
              onClick={() => void manejarClick(email, titulo)}
              data-demo-role={rol}
              className="acceso-capsula acceso-rol"
            >
              <span aria-hidden className="acceso-rol__icono">
                {estaCargandoEsteRol ? <Loader2 className="size-4 animate-spin" /> : <Icono className="size-4" />}
              </span>
              <span className="acceso-rol__nombre">{titulo}</span>{' '}
              {descripcion && <span className="sr-only">{descripcion}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
