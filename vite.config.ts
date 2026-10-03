import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const modoDemoEnv = process.env.VITE_MODO_DEMO
  const esBackend = mode === 'backend' || modoDemoEnv === 'false'
  const esDemo = mode === 'demo' || modoDemoEnv === 'true'

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
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
