/**
 * B-19: ninguna clave de traducción puede faltar. Falla si un locale tiene
 * claves que el otro no, o si el código llama a `t('…')` con una clave literal
 * que no existe (antes una pantalla mostraba el identificador en crudo).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'

import es from '@/infrastructure/i18n/locales/es.json'
import en from '@/infrastructure/i18n/locales/en.json'

type Arbol = { [clave: string]: string | Arbol }

function claves(arbol: Arbol, prefijo = ''): string[] {
  return Object.entries(arbol).flatMap(([k, v]) => (typeof v === 'string' ? [prefijo + k] : claves(v, `${prefijo}${k}.`)))
}

function archivosFuente(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return nombre === 'tests' ? [] : archivosFuente(ruta)
    return /\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

const clavesEs = new Set(claves(es as Arbol))
const clavesEn = new Set(claves(en as Arbol))
const existe = (clave: string) => [clave, `${clave}_one`, `${clave}_other`].some((c) => clavesEs.has(c))

describe('traducciones completas', () => {
  it('es y en tienen las mismas claves', () => {
    expect([...clavesEs].filter((c) => !clavesEn.has(c))).toEqual([])
    expect([...clavesEn].filter((c) => !clavesEs.has(c))).toEqual([])
  })

  it('toda clave literal usada en el código existe', () => {
    const usadas = new Set<string>()
    for (const archivo of archivosFuente(join(__dirname, '../..'))) {
      for (const m of readFileSync(archivo, 'utf8').matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) usadas.add(m[1])
    }
    expect([...usadas].filter((c) => !existe(c))).toEqual([])
  })

  it('el rol de consulta se rotula Auditor (RF-17)', () => {
    expect((es as { roles: Record<string, string> }).roles.auditor).toBe('Auditor')
  })
})
