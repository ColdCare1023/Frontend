# Executive Summary

Auditoría del frontend `Front` (2026-09-19). Identidad visual marfil, serif y verde pino conservada. Baseline Playwright demo y revisión de código completados; pruebas del backend real y despliegue quedan pendientes. Hallazgo mayor: `vercel.json` compila demo, por lo que un despliegue basado en este archivo no sirve datos reales.

Registro por rol: A arquitectura detectó duplicación SSE/estado de fallo; B diseño confirmó identidad y detalle de alertas; C interacción implementó tour; D QA recorrió rutas y automatizó E2E; E seguridad comprobó JWT, RBAC, audit y Codex Security parcial; F rendimiento midió bundle/SSE; G accesibilidad revisó foco, teclado y movimiento reducido; H MCP inventarió herramientas/configuración. Agentes reales cubrieron A, B/D/G y E; trabajo C/F/H se integró en agente principal.

# Architecture

React 19, Vite 6, TypeScript y React Router. Capas `domain`, `application`, `infrastructure`, `presentation`. Backend FastAPI en directorio hermano, revisado solo para contratos. Rutas lazy; API Axios; SSE para lecturas; Zustand para auth.

# UI/UX

Baseline: papel marfil, tarjetas claras, bordes finos, títulos serif, navegación lateral. Cambios incrementales: detalle de alerta pendiente, estados de carga/error del monitoreo y recorrido contextual. [Detalle](UX_AUDIT.md).

# Security

Codex Security Standard disponible: 0 hallazgos validados con cobertura parcial (11/117 rutas, sin ejecución dinámica). Auditoría manual registra riesgos de despliegue demo y revocación JWT por proceso. No se afirma seguridad integral. [Detalle](SECURITY_AUDIT.md).

# Authentication

Contraseña o Google ID token canjeado por JWT interno. Producción guarda JWT en memoria; demo guarda token falso en `sessionStorage`. `401` borra sesión; logout intenta revocación remota.

# Authorization / RBAC

Guards frontend filtran navegación. Backend consulta usuario y rol por solicitud. Playwright demo comprueba rutas permitidas y denegadas; HTTP de backend real queda pendiente.

# Cookies & Sessions

Código frontend no crea cookies propias; inventario navegador en [reporte Playwright](PLAYWRIGHT_REPORT.md). Consentimiento de privacidad del producto es distinto de consentimiento de tracking.

# API

Proxy Vite envía `/api` a `localhost:8000`; demo sustituye llamadas por adaptador en memoria. Respuestas negativas del backend real no se han probado en este checkout.

# Performance

Build demo pasa. Chunk ECharts: 537.58 kB / 182.27 kB gzip; ruta cargada de forma diferida. LCP, INP, CLS de producción pendientes. [Detalle](PERFORMANCE_AUDIT.md).

# Accessibility

Radix aporta foco modal; recorrido incluye teclado y movimiento reducido. Axe en Monitoreo, Alertas e Historial con movimiento reducido: 0 violaciones WCAG 2 A/AA. Evaluación completa con lector de pantalla pendiente.

# Playwright Results

Baseline demo: 12 rutas protegidas recorridas con farmacéutico; 8 permitidas capturadas tras carga, 4 muestran denegación por rol. Consola sin errores/warnings y red sin HTTP ≥400 en recorrido básico. Capturas y trace en `.playwright-mcp/`. Resultado E2E automatizado y recorrido posterior: [reporte](PLAYWRIGHT_REPORT.md).

# MCP Inventory

`.mcp.json` del directorio padre contiene lista vacía. `~/.codex/config.toml` declara servidores; conectores de app amplían herramientas expuestas. Permisos efectivos externos no fueron leídos ni elevados.

| MCP | Estado / herramientas disponibles | Uso | Permisos / riesgo | Necesario aquí | ¿Funciona? | Acción |
| --- | --- | --- | --- | --- | --- | --- |
| Playwright | Configurado, 25 herramientas browser | UI/QA | Control navegador local; riesgo medio | Sí | Sí, recorridos y capturas | Mantener |
| Codex Security | 20 herramientas | Escaneo estático | Lectura/artefactos de análisis; riesgo medio | Sí | Sí, cobertura parcial | Registrar límites |
| Context7 | Configurado, 2 herramientas de documentación | Docs actuales | Consulta externa; riesgo bajo | Condicional | No probado | Usar ante consulta API |
| GitHub | Configurado, herramientas repo | Código/PR | Lectura y escritura remota; riesgo alto | No | No probado | Least privilege |
| Figma | Configurado, herramientas app | Diseño | Lectura/escritura remota; riesgo medio | No | No probado | No conectar sin necesidad |
| Vercel | Configurado, herramientas app | Despliegue | Lectura/despliegue; riesgo alto | No | No probado | No desplegar durante auditoría |
| Supabase | Configurado, herramientas app | Base de datos | Operaciones sobre datos; riesgo alto | No | No probado | Revisar autorización |
| Postman | Configurado, herramientas API | Colecciones/monitor | Lectura/escritura remota; riesgo medio | No | No probado | No usar credenciales sin necesidad |
| Render | Configurado, herramientas servicio | Hosting | Recursos/deploy; riesgo alto | No | No probado | Mantener sin uso |
| Miro / Cloudflare / Firebase | Configurados, sin herramientas expuestas en sesión | Diagramas/infra | Alcance desconocido | No | No probado | Revisar servidores/configuración |
| node_repl | Configurado, herramientas JS | Automatización local | Ejecución local; riesgo medio | No | No probado | Mantener permisos mínimos |

No se imprimieron secretos de configuración. Configuración contiene headers/tokens de conectores: revisar permisos fuera de este diff.

# Dependency Audit

Auditoría inicial: 8 alertas de desarrollo (4 altas, 4 moderadas). Tras actualizar transitorios y Vitest 5, `npm audit` y `npm audit --omit=dev`: 0 alertas. Vercel CLI local: 54.0.0.

# Responsive

Baseline revisado a 1920, 1440, 1366, 1280, 900 y 390 px. No se observó overflow horizontal en dashboard, alertas e historial medidos; capturas posteriores en [reporte Playwright](PLAYWRIGHT_REPORT.md).

# Realtime

SSE usa ticket efímero y reconexión. Lecturas repetidas por ID ahora se descartan; hook distingue error de historial y ausencia de datos. Prueba con broker MQTT y servidor real pendiente.

# Traceability

Vista muestra vínculo Registro N → sello digital → sello anterior → Registro N+1; sellos concretos quedan bajo «Detalles técnicos». Verificación global y por segmento ya existía; E2E demo ejercita verificación y expansión. Cadena/hash se verifican en backend; pruebas contra PostgreSQL real y manipulación controlada pendientes. No se afirma blockchain.

# Findings

| ID | Severidad | Archivo | Problema y evidencia | Impacto | Solución | Riesgo de regresión |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | P1 condicionado | `vercel.json` | `buildCommand: npm run build:demo` | Despliegue sin datos reales si se esperaba producción | Configurar build/API/CSP con destino confirmado | Alto: entorno |
| F-02 | P1 condicionado | `../backend/src/infrastructure/security/revocation_store.py` | JTI revocados solo en memoria | Logout inconsistente con múltiples procesos | Almacén compartido si topología lo exige | Alto: auth |
| F-03 | P2 resuelto en código | `useMonitoreoTermico.ts` | SSE agregaba ID duplicado | Serie/gráfico duplicados | Dedupe y prueba | Bajo |
| F-04 | P2 resuelto en código | `useMonitoreoTermico.ts`, `DashboardPage.tsx` | GET fallido parecía historial vacío | Estado operativo ambiguo | Estados carga/error/vacío | Bajo |
| F-05 | P2 resuelto en código | `AlertasPage.tsx` | Pendiente sin detalle; GET cronología fallido podía dejar datos previos | Contexto incompleto | Detalle para pendientes y error explícito | Medio |
| F-06 | P2 resuelto en lockfile | `package-lock.json` | 8 alertas de tooling en auditoría inicial | Riesgo en cadena de desarrollo | Transitorios y Vitest 5 actualizados; audit final 0 | Medio |
| F-07 | P2 resuelto en UI | `TrazabilidadPage.tsx` | Hashes visibles en tabla básica | Ruido y detalle técnico innecesario | Explicación visual + expansión opcional; E2E demo | Bajo |

# Changes Implemented

Deduplicación SSE, estados de historial, detalle contextual de alerta pendiente, explicación/expansión de trazabilidad, recorrido inicial por rol, reapertura desde Guía, actualización de dependencias y pruebas asociadas. Gates finales: TypeScript, ESLint, builds demo y producción local, Vitest 217/217, E2E Chromium 8/8 (incluye axe), npm audit 0. Evidencia en [Playwright](PLAYWRIGHT_REPORT.md).

# Remaining Risks

Faltan pruebas integradas con FastAPI/Railway/PostgreSQL/EMQX, cookies y headers de despliegue, casos 401/403/422/500 reales, carga Web Vitals real y revisión completa de secretos/historia Git. Configuración Vercel demo requiere decisión de destino antes de cambiar.

# Evidence

Capturas/trace baseline: `.playwright-mcp/baseline-ready-*.png`, `.playwright-mcp/baseline-trace.zip`. Archivos de pruebas: `src/tests/application/hooks/useMonitoreoTermico.test.ts`, `src/tests/presentation/pages/AlertasPage.test.tsx`, `e2e/core-flows.spec.ts`.
