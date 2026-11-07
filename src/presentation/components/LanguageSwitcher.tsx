import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'

import { IDIOMAS } from '@/infrastructure/i18n'
import { cn } from '@/lib/utils'
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from './ui/menu'

/** Las opciones de idioma dentro de cualquier menú. */
export function OpcionesIdioma() {
  const { t, i18n } = useTranslation()
  const actual = i18n.resolvedLanguage === 'en' ? 'en' : 'es'
  return (
    <>
      <MenuLabel>{t('comunes.idioma')}</MenuLabel>
      <MenuRadioGroup value={actual} onValueChange={(idioma) => void i18n.changeLanguage(idioma)}>
        {IDIOMAS.map((idioma) => (
          <MenuRadioItem key={idioma} value={idioma} lang={idioma}>
            <span className="w-6 text-xs font-semibold uppercase text-faint">{idioma}</span>
            {t(`idiomas.${idioma}`)}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </>
  )
}

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
            'realce flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-medium text-muted hover:text-foreground data-[state=open]:text-foreground sm:h-10 sm:pointer-coarse:h-11',
            className,
          )}
        >
          <Languages className="size-4" aria-hidden />
          <span className="uppercase tracking-wide max-[399px]:hidden" aria-hidden>{actual}</span>
        </button>
      </MenuTrigger>
      <MenuContent className="w-44">
        <OpcionesIdioma />
      </MenuContent>
    </Menu>
  )
}
