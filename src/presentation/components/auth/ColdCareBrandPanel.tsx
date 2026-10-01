import { useTranslation } from 'react-i18next'
import { ColdCareBrand } from '../ColdCareBrand'

interface ColdCareBrandPanelProps {
  className?: string
}

/** Editorial pharmacy context; temperature bracket is a reference, not a live reading. */
export function ColdCareBrandPanel({ className = '' }: ColdCareBrandPanelProps) {
  const { t, i18n } = useTranslation()
  const en = i18n.language.startsWith('en')
  return (
    <section
      aria-label={t('login.marcaSubtitulo', { defaultValue: 'Control térmico para farmacias' })}
      className={`relative flex h-full min-h-[150px] flex-col justify-between overflow-hidden bg-ink-900 px-5 py-5 text-white sm:px-9 lg:min-h-dvh lg:px-12 lg:py-10 xl:px-16 ${className}`}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${import.meta.env.BASE_URL}assets/coldcare-auth-editorial.webp')` }} />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink-900/95 via-ink-900/40 to-ink-900/60" />
      <div className="relative"><ColdCareBrand tone="light" subtitulo={t('login.marcaSubtitulo', { defaultValue: 'Control térmico para farmacias' })} /></div>
      <div className="relative mt-5 max-w-[520px] lg:mt-auto lg:pt-12">
        <h1 className="text-[22px] leading-[1.2] font-semibold tracking-tight lg:text-[44px] xl:text-[52px]">
          {en ? 'Protect every dose.' : 'Protege cada dosis.'}<br />
          <span className="text-secondary">{en ? 'At every degree.' : 'En cada grado.'}</span>
        </h1>
        <p className="mt-5 hidden max-w-[42ch] text-base leading-7 text-white/90 lg:block">
          {t('login.descripcion', { defaultValue: 'Supervisa tus equipos, recibe alertas oportunas y conserva registros trazables para cada revisión.' })}
        </p>
        <div className="mt-8 hidden items-center justify-between gap-4 border-t border-white/25 pt-5 text-sm lg:flex">
          <span>{en ? 'Reference temperature range' : 'Rango térmico de referencia'}</span>
          <span className="nums text-xl font-semibold">2–8 °C</span>
        </div>
      </div>
    </section>
  )
}
