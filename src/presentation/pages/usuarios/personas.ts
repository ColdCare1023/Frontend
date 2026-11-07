/** Dos iniciales como máximo: de «Técnico Demo 2», «TD». */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter((palabra) => /\p{L}/u.test(palabra))
  return palabras
    .slice(0, 2)
    .map((palabra) => Array.from(palabra)[0])
    .join('')
    .toLocaleUpperCase()
}

/*
 * La misma fila en dos anchos, sin duplicar nodos:
 * - móvil: el avatar a la izquierda, tres líneas de texto y las opciones arriba a la derecha;
 * - desde `md`: rejilla, con el correo siempre en segundo plano, debajo del nombre.
 */
export const REJILLA_FILA =
  'md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_64px] md:gap-x-6'
export const CELDA = {
  nombre: 'md:col-start-1 md:row-start-1',
  email: 'md:col-start-1 md:row-start-2',
  rol: 'md:col-start-2 md:row-span-2 md:row-start-1',
  estado: 'md:col-start-3 md:row-span-2 md:row-start-1',
  opciones: 'md:col-start-4 md:row-span-2 md:row-start-1',
}
