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
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-cover bg-center opacity-75" style={{ backgroundImage: `url('${import.meta.env.BASE_URL}assets/coldcare-auth-editorial.webp')` }} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-marca-noche via-marca-noche/40 to-marca-noche/25" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(760px_420px_at_0%_0%,rgb(0_209_255/0.12),transparent_62%),radial-gradient(640px_380px_at_100%_100%,rgb(11_92_255/0.12),transparent_60%)]" />

      <div className="relative animate-fade">
        <ColdCareBrand tone="light" subtitulo={t('login.marcaSubtitulo')} />
      </div>

      <div className="relative mt-7 max-w-[620px] lg:mt-auto">
        <p className="animate-rise text-[28px] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-[34px] lg:text-[42px] xl:text-[48px]">
          {t('login.esloganLinea1')}
          <br />
          <span className="text-secondary">{t('login.esloganLinea2')}</span>
        </p>
        <details className="group mt-5 max-w-[44ch] text-white/80">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm text-sm font-medium hover:text-white focus-visible:outline-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
            {t('lectura.acerca')}
            <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
          </summary>
          <p className="mt-2 max-w-[44ch] animate-rise text-[15px] leading-7 text-white/75 [animation-delay:70ms]">
            {t('login.descripcion')}
          </p>
          <div className="mt-3 flex animate-fade items-center justify-between gap-4 border-t border-white/15 pt-5 text-sm text-white/75 [animation-delay:140ms] lg:flex">
            <span>{t('login.rangoReferencia')}</span>
            <span className="nums flex items-center gap-2.5 text-[28px] leading-none font-semibold tracking-[-0.03em] text-white">
              <span aria-hidden className="size-2 rounded-full bg-secondary shadow-[0_0_12px_rgb(0_209_255/0.9)]" />
              2–8 °C
            </span>
          </div>
        </details>
      </div>
    </section>
  )
}
