import { Trans, useTranslation } from 'react-i18next'

import { NumeroAnimado } from '../../components/ui/numero-animado'
import {
  HUECO_QUE_SE_NOMBRA_MS,
  cuandoFue,
  desdeCuando,
  primeraEnMinuscula,
  type Periodo,
  type ResumenPeriodo,
} from './agrupar'

/**
 * La respuesta a «¿qué pasó?» en una frase, sacada de las lecturas cargadas. Va dentro del título y
 * se anuncia al cambiar. Cuando cambia de forma (dentro, fuera…) se funde; si solo cambia la cuenta,
 * la cifra rueda.
 */
export function FraseHistorial({
  resumen,
  periodo,
  riesgo,
  cantidad,
}: {
  resumen: ResumenPeriodo
  periodo: Periodo
  /** Con un nivel elegido no se afirma nada sobre el rango: solo se cuenta lo filtrado. */
  riesgo?: string
  cantidad: number
}) {
  const { t } = useTranslation()
  // Con un nivel elegido, lo que llega no dice desde cuándo hay datos: solo cuándo hubo ese nivel.
  const etiqueta =
    !riesgo && resumen.tipo !== 'sin_lecturas' && resumen.desdeParcial
      ? desdeCuando(resumen.desdeParcial, t)
      : t(`historial.periodos.${periodo}`)

  let variante: string
  let contenido: React.ReactNode
  if (riesgo) {
    variante = 'filtrado'
    contenido = t('historial.frase.filtrado', { count: cantidad, periodo: etiqueta, nivel: t(`riesgo.${riesgo}`) })
  } else if (resumen.tipo === 'sin_lecturas') {
    variante = 'sin_lecturas'
    contenido = t('historial.frase.sinLecturas', { periodo: etiqueta })
  } else if (resumen.tipo === 'sin_temperatura') {
    variante = 'sin_temperatura'
    contenido = t('historial.frase.sinTemperatura', { periodo: etiqueta })
  } else if (resumen.tipo === 'dentro') {
    variante = resumen.huecoMs >= HUECO_QUE_SE_NOMBRA_MS ? 'dentro_huecos' : 'dentro'
    contenido = t(variante === 'dentro' ? 'historial.frase.dentro' : 'historial.frase.dentroConHuecos', { periodo: etiqueta })
  } else if (resumen.enCurso) {
    variante = 'en_curso'
    contenido = (
      <span className="text-critical">
        {t('historial.frase.enCurso', { desde: primeraEnMinuscula(desdeCuando(resumen.enCurso.inicio, t)) })}
      </span>
    )
  } else {
    variante = 'fuera'
    contenido = (
      <Trans
        i18nKey="historial.frase.fuera"
        count={resumen.salidas.length}
        values={{ cuando: cuandoFue(resumen.salidas[0].inicio, t) }}
        components={{ n: <NumeroAnimado className="text-critical" valor={String(resumen.salidas.length)} /> }}
      />
    )
  }

  return (
    <span role="status" className="frase-historial">
      <span key={variante} className="animate-fade block">
        {contenido}
      </span>
    </span>
  )
}
