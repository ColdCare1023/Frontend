import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

/**
 * Cómo se atiende una alerta (HU-23/27), en tres pasos. Solo aparece con pocas
 * filas y sin atendidas que mostrar (una instalación nueva): el hueco bajo la
 * bandeja se llena con el procedimiento, no con datos de relleno.
 */
export function GuiaAtencion() {
  const { t } = useTranslation()
  const pasos = ['revisar', 'registrar', 'verificar'] as const
  return (
    <section aria-labelledby="guia-atencion-titulo" className="superficie p-4">
      <h2 id="guia-atencion-titulo" className="text-title text-foreground">
        {t('alertas.guiaAtencion.titulo')}
      </h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {pasos.map((paso, i) => (
          <li key={paso} className="flex gap-3 sm:flex-col sm:gap-2">
            <span
              aria-hidden
              className="nums inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-meta font-semibold text-muted ring-1 ring-inset ring-border"
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-body font-medium text-foreground">{t(`alertas.guiaAtencion.${paso}`)}</span>
              <span className="block text-meta text-muted text-pretty">
                {t(`alertas.guiaAtencion.${paso}Detalle`)}
                {paso === 'verificar' && (
                  <>
                    {' '}
                    <Link to="/historial" className="font-medium text-primary-text underline-offset-2 hover:underline">
                      {t('alertas.guiaAtencion.irHistorial')}
                    </Link>
                  </>
                )}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
