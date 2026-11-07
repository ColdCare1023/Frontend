import { Trans } from 'react-i18next'

import { NumeroAnimado } from '../../components/ui/numero-animado'

/** Lo que trae la lista como mucho (`limite` de `useAlertas`): de ahí en adelante se dice «200+». */
export const TOPE_ALERTAS = 200

/**
 * «Tienes 3 alertas por revisar», con la cifra que rueda al cambiar. Cada rol lee lo que le toca:
 * el farmacéutico las revisa, el técnico las atiende y el auditor solo las consulta.
 */
export function FrasePendientes({
  n,
  puedeReconocer,
  puedeRegistrar,
}: {
  n: number
  puedeReconocer: boolean
  puedeRegistrar: boolean
}) {
  const clave = puedeReconocer ? 'alertas.porRevisar' : puedeRegistrar ? 'alertas.porAtender' : 'alertas.pendientesConsulta'
  const cifra = n >= TOPE_ALERTAS ? `${TOPE_ALERTAS}+` : String(n)
  return <Trans i18nKey={clave} count={n} components={{ n: <NumeroAnimado valor={cifra} className="nums" /> }} />
}
