import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Configuración propia en vez de reutilizar `vite.config.ts`: las pruebas no
 * necesitan Tailwind ni el troceado de bundle, y arrancar esos plugins en cada
 * corrida solo añade segundos sin cambiar un resultado.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.{ts,tsx}'],
    // Cada archivo en su propio entorno: el store de auth y el token del
    // apiClient son singletons de módulo, y compartirlos entre archivos haría
    // que una prueba de sesión cerrada dependiera del orden de ejecución.
    isolate: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Solo el código propio: los tipos no ejecutan nada, `main.tsx` es el
      // arranque de Vite y la capa demo son datos simulados para la
      // presentación, no lógica que una prueba deba cubrir.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/tests/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/infrastructure/demo/**',
        'src/**/*.d.ts',
      ],
    },
  },
})
