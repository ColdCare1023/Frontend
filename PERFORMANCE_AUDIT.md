# Performance Audit

Fecha: 2026-09-19. Alcance: frontend local, build demo. No se midió tráfico ni carga del backend real.

## Bundle y carga inicial

`npm run build:demo` y `npm run build` pasaron. Salida demo final: `index` 78.81 kB (26.99 gzip), `react` 233.83 kB (73.89 gzip), `echarts` 537.58 kB (182.27 gzip), CSS 55.07 kB (10.12 gzip). ECharts dispara advertencia de chunk >500 kB; ruta dashboard y páginas usan `React.lazy`, así que tamaño del chunk no equivale a coste del login. No cambiar partición sin medición de red/caché.

## Runtime

- `EChartWrapper` crea y destruye instancia ECharts y `ResizeObserver` al desmontar. Dashboard limpia intervalo de reloj.
- SSE libera `EventSource`/timer al desmontar; reconexión fija cada 5 s. Antes agregaba IDs repetidos tras reconexión. Lote actual deduplica por ID; test del hook cubre duplicado.
- Serie térmica tiene límite de 5000 puntos. Cada lectura nueva copia ventana; medir coste con frecuencia real antes de optimizar.
- GET histórico fallaba silenciosamente; dashboard ahora diferencia carga, vacío y fallo.

## Métricas de usuario

LCP, INP y CLS de producción: **no medidos**. Capturas Playwright locales y build no sustituyen medición Web Vitals con tráfico real. Objetivos orientativos del proyecto: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1.

## Pendientes

Medir Web Vitals en despliegue real; perfilar gráfico con 5000 lecturas y SSE a frecuencia real; revisar requests duplicados bajo React Strict Mode y reconexión de red.
