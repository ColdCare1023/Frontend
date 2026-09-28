import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

const IDIOMAS = [
  { codigo: 'es', etiqueta: 'ES' },
  { codigo: 'en', etiqueta: 'EN' },
] as const

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()

  return (
    <div
      role="group"
      aria-label={t('comunes.idioma')}
      className={cn(
        'inline-flex items-center rounded-full border border-border-strong bg-surface p-0.5',
        className,
      )}
    >
      {IDIOMAS.map(({ codigo, etiqueta }) => (
        <button
          key={codigo}
          type="button"
          onClick={() => void i18n.changeLanguage(codigo)}
          aria-pressed={i18n.resolvedLanguage === codigo}
          className={cn(
            'flex min-h-11 min-w-11 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-150 cursor-pointer',
            i18n.resolvedLanguage === codigo
              ? 'bg-primary text-cream-50 shadow-sm shadow-pine-900/25'
              : 'text-muted hover:text-foreground',
          )}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  )
}
