import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * twMerge con la escala tipográfica de ColdCare (`--text-*` en index.css).
 * Sin esto, `text-page`, `text-meta`… se tomaban por colores y `cn('text-page',
 * 'text-success-700')` borraba el tamaño.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'meta', 'body', 'title', 'page', 'metric', 'display', 'hero'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
