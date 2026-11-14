import type { TFunction } from 'i18next'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { formatearTemperatura } from '../../components/ui/formato-cifra'

/**
 * Título visible de una alerta. El backend redacta `mensaje` en español: en
 * ese idioma se muestra tal cual (lleva el detalle «fuera del rango de
 * conservación…»). En otro idioma se arma en el cliente como en el Dashboard
 * («Critical excursion · 9.6 °C»), para no mezclar un título en español en
 * una pantalla en inglés.
 */
export function tituloAlerta(alerta: AlertaTermica, t: TFunction, idioma: string | undefined): string {
  if ((idioma ?? 'es').startsWith('es') && alerta.mensaje) return sinCortes(alerta.mensaje)
  if (!alerta.nivel_riesgo) return alerta.mensaje
  const nivel = t(`riesgo.${alerta.nivel_riesgo}`)
  return alerta.temperatura_pico != null ? `${nivel} · ${formatearTemperatura(alerta.temperatura_pico)}` : nivel
}

/**
 * «2–8 °C» y «8.5 °C» no se parten entre líneas: el mensaje del backend llega
 * con espacios normales y, en celdas estrechas, el rango quedaba «2–» / «8 °C».
 */
function sinCortes(texto: string): string {
  return texto.replace(/(\d)\s?–\s?(\d)/g, '$1\u2060–\u2060$2').replace(/(\d) °C/g, '$1\u00a0°C')
}
