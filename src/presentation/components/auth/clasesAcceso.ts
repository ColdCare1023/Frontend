/**
 * Clases compartidas por las cuatro pantallas de acceso. Son utilidades de Tailwind,
 * no reglas de `acceso.css`, porque se combinan con las primitivas (`Input`) mediante `cn`.
 */

/**
 * Campo alto y con 16 px de letra en todos los anchos: iOS no hace zoom al enfocarlo. Si es
 * inválido lo dice el borde; el texto sigue en tinta, y el ejemplo no parece un valor erróneo.
 */
export const CAMPO_ACCESO =
  'h-13 px-4 sm:h-13 sm:px-4 sm:text-base sm:pointer-coarse:h-13 aria-[invalid=true]:text-foreground aria-[invalid=true]:placeholder:text-faint'

export const CTA_ACCESO =
  'coldcare-primary-action group flex h-13 w-full cursor-pointer items-center justify-center gap-2.5 px-5 text-[15px] font-semibold'

export const ENLACE_ACCESO =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline'
