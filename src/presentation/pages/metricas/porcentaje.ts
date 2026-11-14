import { ESPACIO_FINO } from '../../components/ui/formato-cifra'

export function numeroPct(valor: number, idioma: string | undefined, decimales = 2): string {
  return new Intl.NumberFormat(idioma?.startsWith('en') ? 'en-US' : 'es-PE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor * 100)
}

/** «96,71 %» con espacio fino antes del signo. */
export function porcentaje(valor: number, idioma: string | undefined, decimales = 2): string {
  return `${numeroPct(valor, idioma, decimales)}${ESPACIO_FINO}%`
}
