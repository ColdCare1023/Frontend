import { useTranslation } from 'react-i18next'
import { ColdCareBrand } from '../ColdCareBrand'

interface ColdCareBrandPanelProps {
  className?: string
}

/**
 * Contexto editorial de farmacia sobre el lienzo de marca. Siempre oscuro: el
 * texto blanco no depende del tema elegido. El rango 2–8 °C es una referencia,
 * no una lectura en vivo.
 */
export function ColdCareBrandPanel({ className = '' }: ColdCareBrandPanelProps) {
  const { t } = useTranslation()
  return (
    <section
      aria-label={t('login.marcaSubtitulo')}
      className={`relative isolate flex h-full flex-col justify-between overflow-hidden bg-marca-noche px-5 pt-5 pb-7 text-white sm:px-9 lg:min-h-dvh lg:px-12 lg:py-10 xl:px-16 ${className}`}
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-cover bg-center opacity-50" style={{ backgroundImage: `url('${import.meta.env.BASE_URL}assets/coldcare-auth-editorial.webp')` }} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-marca-noche via-marca-noche/80 to-marca-noche/40" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(720px_380px_at_0%_0%,rgb(92_214_232/0.14),transparent_62%)]" />

      <div className="relative animate-fade">
        <ColdCareBrand tone="light" subtitulo={t('login.marcaSubtitulo')} />
      </div>

      <div className="relative mt-7 max-w-[540px] lg:mt-auto">
        <h1 className="animate-rise text-[26px] leading-[1.15] font-semibold tracking-[-0.025em] sm:text-[32px] lg:text-[46px] xl:text-[54px]">
          {t('login.esloganLinea1')}
          <br />
          <span className="text-marca-glaciar">{t('login.esloganLinea2')}</span>
        </h1>
        <p className="mt-5 hidden max-w-[44ch] animate-rise text-[15px] leading-7 text-white/75 [animation-delay:70ms] lg:block">
          {t('login.descripcion')}
        </p>
        <div className="mt-9 hidden animate-fade items-center justify-between gap-4 border-t border-white/15 pt-5 text-sm text-white/75 [animation-delay:140ms] lg:flex">
          <span>{t('login.rangoReferencia')}</span>
          <span className="nums text-xl font-semibold text-white">2–8 °C</span>
        </div>
      </div>
    </section>
  )
}
