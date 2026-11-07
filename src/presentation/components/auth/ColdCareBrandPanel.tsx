import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { ColdCareBrand } from '../ColdCareBrand'

interface ColdCareBrandPanelProps {
  className?: string
}

/**
 * La foto del login que el asesor aprobó (Acta N.° 05) y que la dueña del proyecto pidió
 * de vuelta: no se quita. El titular es blanco sobre un velo fijo, así que no depende del
 * tema. El rango 2–8 °C es una referencia, no una lectura en vivo.
 */
export function ColdCareBrandPanel({ className }: ColdCareBrandPanelProps) {
  const { t } = useTranslation()
  return (
    <section aria-label={t('login.marcaSubtitulo')} className={cn('acceso-foto', className)}>
      <img
        className="acceso-foto__imagen"
        src={`${import.meta.env.BASE_URL}assets/coldcare-auth-editorial.webp`}
        alt=""
        width={1086}
        height={1448}
        decoding="async"
        fetchPriority="high"
      />
      <div aria-hidden="true" className="acceso-foto__velo" />

      <div className="acceso-capsula acceso-marca">
        <ColdCareBrand tone="light" subtitulo={t('login.marcaSubtitulo')} className="[&_svg]:size-8" />
      </div>

      <h1 className="acceso-titular">
        <span className="block">{t('login.esloganLinea1')}</span>{' '}
        <span className="acceso-titular__segunda block">{t('login.esloganLinea2')}</span>
      </h1>

      <p className="acceso-capsula acceso-rango">
        <span>{t('login.rangoReferencia')}</span> <span className="acceso-rango__cifra">2–8 °C</span>
      </p>
    </section>
  )
}
