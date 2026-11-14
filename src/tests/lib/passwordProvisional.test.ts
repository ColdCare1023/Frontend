import { describe, expect, it } from 'vitest'

import { problemaPassword } from '@/domain/value-objects/politicaPassword'
import { generarPasswordProvisional } from '@/lib/passwordProvisional'

describe('generarPasswordProvisional', () => {
  it('1000 generaciones cumplen la política y no tienen caracteres ambiguos', () => {
    for (let i = 0; i < 1000; i++) {
      const password = generarPasswordProvisional()
      expect(password).toHaveLength(16)
      expect(problemaPassword(password)).toBeNull()
      expect(password).not.toMatch(/[0O1lI]/)
    }
  })
})
