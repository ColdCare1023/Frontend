import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
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
  build: {
    rollupOptions: {
      output: {
        /**
         * El reparto por objeto (`{ react: ['react', 'react-dom', …] }`) casa
         * por identificador de módulo exacto. `main.tsx` importa
         * `react-dom/client`, que es otro identificador, así que react-dom
         * —el paquete más pesado después de ECharts— nunca entró en el trozo
         * `react` y se quedaba en el de entrada: el navegador volvía a
         * descargarlo íntegro con cada despliegue, aunque React no cambiara.
         *
         * Con una función se reparte por ruta real del módulo. Cada grupo se
         * elige por su ritmo de cambio, no por tamaño: las dependencias se
         * tocan en cada `npm update` y el código propio, a diario.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/echarts/') || id.includes('/zrender/')) return 'echarts'
          if (/\/(react|react-dom|scheduler|react-router)\//.test(id)) return 'react'
          if (id.includes('/i18next') || id.includes('/react-i18next/')) return 'i18n'
          if (id.includes('/@radix-ui/') || id.includes('/react-remove-scroll')) return 'radix'
          return 'vendor'
        },
      },
    },
  },
})
