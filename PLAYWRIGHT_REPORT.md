# Playwright Report

Fecha: 2026-09-19. URL local: `http://127.0.0.1:5173`, Vite `--mode demo`. Backend FastAPI real no disponible en `127.0.0.1:8000`; pruebas verifican adaptador demo y guards cliente.

## Baseline y comparación

Playwright MCP recorrió login y rutas. Capturas iniciales `.playwright-mcp/baseline-ready-*.png`; trace `.playwright-mcp/baseline-trace.zip`. Capturas posteriores `.playwright-mcp/after-final-*.png`; trace adicional `.playwright-mcp/after-trace.zip`. Captura final del dashboard esperó gráfico y conexión SSE demo y desactivó animaciones para evitar fotograma parcial. Abrir trace: `npx playwright show-trace .playwright-mcp/baseline-trace.zip`.

| Ruta | Función | Baseline farmacéutico | Después | Consola/red | UX/responsive | Accesibilidad/seguridad |
| --- | --- | --- | --- | --- | --- | --- |
| `/login` | Acceso | Carga | E2E pasa | Sin error en recorrido | Captura baseline | Token demo, no producción |
| `/guia` | Ayuda | Carga | Carga, reabre tour | 0 error | Contenido largo, sin overflow observado | Botón teclado |
| `/dashboard` | Monitoreo | Carga | Carga, gráfico visible | 0 error | 1920/1440/1366/1280/900/390 revisados | Estado SSE/última lectura |
| `/historial` | Mediciones | Carga | Carga | 0 error | Tabla/gráfico responsive revisados | Tabla navegable |
| `/alertas` | Alertas | Carga | Carga, detalle pendiente | 0 error | Tabla responsive revisada | Diálogo Radix |
| `/trazabilidad` | Cadena/hash | Carga | Carga | 0 error | Captura | Integridad backend no verificada |
| `/checklist-bpa` | Checklist | Carga | Carga | 0 error | Captura | Guard rol |
| `/reportes` | Reportes | Carga | Carga | 0 error | Captura | API PDF real no verificada |
| `/metricas-ia` | IA | Carga | Carga | 0 error | Captura | Métricas demo |
| `/auditoria` | Bitácora | Denegada por rol | E2E auditor entra | 0 error demo | Captura | Guard rol |
| `/usuarios` | Usuarios | Denegada por rol | E2E auditor denegado | 0 error demo | Captura | Guard rol |
| `/dispositivos` | Dispositivos | Denegada por rol | Denegada por rol | 0 error demo | Captura | Guard rol |
| `/firmware` | Firmware | Denegada por rol | Denegada por rol | 0 error demo | Captura | Guard rol |

## Automatización

`npm run test:e2e`: 8/8 en Chromium tras lockfile final. Escenarios: login/tour/reapertura, auth/RBAC, alerta contextual, prioridad del consentimiento, logout con ruta protegida, navegación móvil, trazabilidad y axe en tres rutas. Especificaciones [core-flows.spec.ts](e2e/core-flows.spec.ts) y [accessibility.spec.ts](e2e/accessibility.spec.ts). Axe con `prefers-reduced-motion: reduce`: 0 violaciones WCAG 2 A/AA en Monitoreo, Alertas e Historial. Sin movimiento reducido, escaneo inicial captó opacidad parcial durante animación y reportó contraste transitorio bajo; resultado no equivale a evaluación completa con lector de pantalla. Trace Viewer disponible mediante Playwright.

## Red, consola y cookies

Recorrido inicial y posterior de rutas permitidas: 0 errores/warnings consola, 0 respuestas HTTP ≥400 observadas. Log posterior: `.playwright-mcp/after-final-events.json`. Cookies de contexto demo: `[]`. No se probó sesión con Google ni cookies de despliegue real.

## Negativos pendientes

401/403/404/422/500 de FastAPI, token expirado real, API caída, timeout, SSE/MQTT desconectado y recuperación, acceso horizontal, informes reales, trazabilidad PostgreSQL: pendientes por backend no levantado. E2E de demo no sustituye pruebas integradas.
