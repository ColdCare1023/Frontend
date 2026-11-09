import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, Moon, Sun } from 'lucide-react'

import { cambiarTema, usePreferenciaTema, useTemaResuelto, type PreferenciaTema } from '@/infrastructure/tema/tema'
import { cn } from '@/lib/utils'
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from './ui/menu'

const OPCIONES: Array<{ valor: PreferenciaTema; icono: typeof Sun; clave: string }> = [
  { valor: 'dark', icono: Moon, clave: 'tema.oscuro' },
  { valor: 'light', icono: Sun, clave: 'tema.claro' },
  { valor: 'system', icono: Monitor, clave: 'tema.sistema' },
]

const ICONO_GIRO = 'absolute size-[18px] transition-[transform,opacity] duration-(--duration-reveal) ease-(--ease-ui)'

/**
 * Selector de tema: oscuro (predeterminado), claro o el del sistema. Sol y
 * luna giran con CSS (sin motion: el acceso no carga la librería); el tema
 * nuevo se revela en círculo desde el botón (tema.ts).
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation()
  const preferencia = usePreferenciaTema()
  const oscuro = useTemaResuelto() === 'dark'
  const boton = useRef<HTMLButtonElement>(null)

  const elegir = (valor: string) => {
    const caja = boton.current?.getBoundingClientRect()
    cambiarTema(valor as PreferenciaTema, caja ? { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 } : undefined)
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          ref={boton}
          type="button"
          aria-label={`${t('tema.cambiar')}: ${t(OPCIONES.find((o) => o.valor === preferencia)?.clave ?? 'tema.oscuro')}`}
          className={cn(
            'relative flex size-11 cursor-pointer items-center justify-center overflow-hidden rounded-lg text-muted transition-colors duration-(--duration-micro) hover:bg-cream-200/70 hover:text-foreground data-[state=open]:bg-cream-200/70 data-[state=open]:text-foreground sm:size-9 sm:pointer-coarse:size-11',
            className,
          )}
        >
          <Moon aria-hidden className={cn(ICONO_GIRO, oscuro ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0')} />
          <Sun aria-hidden className={cn(ICONO_GIRO, oscuro ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100')} />
        </button>
      </MenuTrigger>
      <MenuContent className="w-44">
        <MenuLabel>{t('tema.titulo')}</MenuLabel>
        <MenuRadioGroup value={preferencia} onValueChange={elegir}>
          {OPCIONES.map(({ valor, icono: IconoOpcion, clave }) => (
            <MenuRadioItem key={valor} value={valor}>
              <IconoOpcion className="text-faint" aria-hidden />
              {t(clave)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}
