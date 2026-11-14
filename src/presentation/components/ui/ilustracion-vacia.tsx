import { useId } from 'react'

import { cn } from '@/lib/utils'

export type VarianteIlustracion =
  | 'al-dia'
  | 'sin-resultados'
  | 'sin-reporte'
  | 'sin-equipos'
  | 'sin-datos'
  | 'sin-permiso'
  | 'error'

/**
 * Ilustraciones de estado vacío (DIRECTION §15): diagramas de instrumento
 * hechos con las primitivas del producto, no personajes ni raster. SVG
 * inline 96×64, trazo de 1.5 en `currentColor` (faint) y un solo acento:
 * relleno de la banda teal («al día») o trama de «sin datos». Decorativas.
 */
export function IlustracionVacia({ variante, className }: { variante: VarianteIlustracion; className?: string }) {
  const id = useId().replace(/:/g, '')
  const trama = `trama-${id}`
  return (
    <svg
      aria-hidden
      data-ilustracion={variante}
      viewBox="0 0 96 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-12 w-[72px] shrink-0 text-faint sm:h-16 sm:w-24', className)}
    >
      <defs>
        <pattern id={trama} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--color-nodata-trama)" strokeWidth="1.5" />
        </pattern>
      </defs>
      {variante === 'al-dia' && (
        <>
          {/* Regla con la marca dentro de la franja y un check. */}
          <rect x="8" y="38" width="80" height="6" rx="3" />
          <rect x="24" y="38" width="48" height="6" fill="var(--color-banda-fuerte)" stroke="none" />
          <circle cx="44" cy="41" r="4.5" fill="var(--color-surface)" />
          <path d="M40 18l5 5 10-11" />
        </>
      )}
      {variante === 'sin-resultados' && (
        <>
          <path d="M14 10v42h70" />
          <path d="M14 22h70M14 34h70" strokeDasharray="2 4" />
          <circle cx="58" cy="28" r="9" />
          <path d="M65 35l7 7" />
        </>
      )}
      {variante === 'sin-reporte' && (
        <>
          <path d="M30 6h28l10 10v42H30z" />
          <path d="M58 6v10h10" />
          <rect x="36" y="38" width="26" height="5" rx="2.5" />
          <rect x="41" y="38" width="16" height="5" fill="var(--color-banda-fuerte)" stroke="none" />
          <path d="M36 24h20M36 30h14" />
        </>
      )}
      {variante === 'sin-equipos' && (
        <>
          {/* Contorno de refrigerador con la puerta discontinua. */}
          <rect x="30" y="4" width="36" height="56" rx="4" />
          <path d="M30 24h36" />
          <rect x="34" y="28" width="28" height="28" rx="2" strokeDasharray="3 3" />
          <path d="M36 12v6" />
        </>
      )}
      {variante === 'sin-datos' && (
        <>
          <path d="M10 8v46h78" />
          <rect x="44" y="12" width="24" height="40" fill={`url(#${trama})`} stroke="none" />
          <path d="M14 40c6-2 10-10 16-9s8 6 14 4" />
          <path d="M68 30c6 0 8-6 16-5" strokeDasharray="2 3" />
        </>
      )}
      {variante === 'sin-permiso' && (
        <>
          <rect x="24" y="6" width="34" height="54" rx="2" />
          <path d="M52 34h2" />
          <rect x="60" y="30" width="22" height="18" rx="3" />
          <path d="M65 30v-5a6 6 0 0 1 12 0v5" />
          <path d="M71 37v4" />
        </>
      )}
      {variante === 'error' && (
        <>
          {/* Eslabón partido. */}
          <path d="M40 38l-6 6a8 8 0 0 1-11-11l6-6" />
          <path d="M56 26l6-6a8 8 0 0 1 11 11l-6 6" />
          <path d="M44 22l-2-6M52 42l2 6M38 28l-6-2M58 36l6 2" />
        </>
      )}
    </svg>
  )
}
