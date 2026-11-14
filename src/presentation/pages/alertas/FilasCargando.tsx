import { useTranslation } from 'react-i18next'

import { Esqueleto } from '../../components/ui/esqueleto'

/** Esqueleto con la geometría final (filas de 56 px, mismos botones por rol): CLS 0. */
export function FilasCargando({ puedeReconocer, puedeRegistrar }: { puedeReconocer: boolean; puedeRegistrar: boolean }) {
  const { t } = useTranslation()
  return (
    <>
      {[0, 1, 2].map((fila) => (
        <tr key={fila} aria-hidden={fila > 0 || undefined} className="h-14">
          <td className="py-2 pr-3 pl-4 shadow-[inset_3px_0_0_var(--color-border)] max-sm:block">
            {fila === 0 && <span className="sr-only">{t('app.cargando')}</span>}
            <Esqueleto className="h-4 w-3/5" />
            <Esqueleto className="mt-1.5 h-3 w-2/5" />
          </td>
          <td className="hidden px-3 py-2 md:table-cell">
            <Esqueleto className="h-[3px] w-16" />
          </td>
          <td className="py-2 pr-4 pl-3 max-sm:block">
            <div className="flex justify-end gap-2">
              {puedeReconocer && <Esqueleto className="h-9 w-[74px]" />}
              {puedeRegistrar && <Esqueleto className="h-9 w-32" />}
              <Esqueleto className="h-9 w-9" />
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}
