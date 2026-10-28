import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'

import { IDIOMAS } from '@/infrastructure/i18n'
import { cn } from '@/lib/utils'
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from './ui/menu'

/**
 * Selector de idioma (español principal, inglés). Cambiar de idioma no recarga:
 * la sesión, los formularios y la ruta actual se conservan.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const actual = i18n.resolvedLanguage === 'en' ? 'en' : 'es'

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t('idiomas.cambiar')}: ${t(`idiomas.${actual}`)}`}
          className={cn(
            'flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted transition-colors duration-(--duration-micro) hover:bg-cream-200/70 hover:text-foreground data-[state=open]:bg-cream-200/70 data-[state=open]:text-foreground pointer-coarse:h-11',
            className,
          )}
        >
          <Languages className="size-4" aria-hidden />
          <span className="uppercase tracking-wide" aria-hidden>{actual}</span>
        </button>
      </MenuTrigger>
      <MenuContent className="w-44">
        <MenuLabel>{t('comunes.idioma')}</MenuLabel>
        <MenuRadioGroup value={actual} onValueChange={(idioma) => void i18n.changeLanguage(idioma)}>
          {IDIOMAS.map((idioma) => (
            <MenuRadioItem key={idioma} value={idioma} lang={idioma}>
              <span className="w-6 text-xs font-semibold uppercase text-faint">{idioma}</span>
              {t(`idiomas.${idioma}`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}
