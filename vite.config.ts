import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ command, mode }) => {
  const modoDemoEnv = process.env.VITE_MODO_DEMO
  const esBackend = mode === 'backend' || modoDemoEnv === 'false'
  const esDemo = mode === 'demo' || modoDemoEnv === 'true'

  // FE-002: un build debe declarar de dónde salen los datos. Sin esto, un
  // `vite build` "de producción" sin variables quedaba en modo demo y
  // presentaba temperaturas simuladas como reales.
  if (command === 'build' && esBackend === esDemo) {
    throw new Error(
      'Build sin modo de datos explícito: use `npm run build` (backend real) o ' +
        '`npm run build:demo` (datos simulados), o defina VITE_MODO_DEMO=true|false.',
    )
  }

  // HU-55 / A-1: en Vercel (VERCEL=1) el build contra el backend exige la URL
  // HTTPS del backend; sin ella el dashboard quedaría vacío y nadie lo notaría.
  if (command === 'build' && esBackend && process.env.VERCEL === '1') {
    const api = process.env.VITE_API_BASE_URL ?? ''
    if (!api.startsWith('https://')) {
      throw new Error('Build de producción en Vercel sin VITE_API_BASE_URL https:// (URL del backend en Railway).')
    }
  }

  // Local contra el backend real: el navegador habla solo con Vite y Vite
  // reenvía /api —incluido el flujo SSE de los sensores— al backend, sin CORS
  // que configurar. COLDCARE_BACKEND_URL (en `.env.local`) apunta a otro
  // backend, p. ej. el de Railway; sin prefijo VITE_, no llega al navegador.
  const backend = loadEnv(mode, __dirname, '').COLDCARE_BACKEND_URL || 'http://localhost:8000'

  return {
    // La SPA se publica junto a la landing bajo /app/ en Vercel.
    base: process.env.VITE_APP_BASE ?? '/',
    // Los builds y las pruebas demo deben incluir roles de acceso rápido aunque
    // el archivo local `.env.demo` esté ignorado o no exista.
    define: esBackend
      ? { 'import.meta.env.VITE_MODO_DEMO': JSON.stringify('false') }
      : esDemo
        ? { 'import.meta.env.VITE_MODO_DEMO': JSON.stringify('true') }
        : undefined,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      // Perf A1: manifest para medir el presupuesto por ruta y vendors con
      // hash estable. Radix y motion NO se agrupan: arrastrarían diálogos y
      // selects al login.
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return 'vendor-react'
            if (/[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/.test(id)) return 'vendor-i18n'
            if (/[\\/]node_modules[\\/](echarts|zrender)[\\/]/.test(id)) return 'vendor-echarts'
            return undefined
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
        },
      },
    },
  }
})
