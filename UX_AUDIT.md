# UX/UI Audit

Fecha: 2026-09-19. Baseline y comparación Playwright en modo demo.

## Identidad conservada

Fondo marfil, verde pino, serif editorial, sidebar lateral, tarjetas claras, bordes finos y sombra suave. [Antes](.playwright-mcp/baseline-ready-dashboard.png) / [después](.playwright-mcp/after-final-dashboard.png). Sin rediseño visual global.

## Cambios

- Recorrido inicial de seis pasos sobre navegación real; pasos filtrados por rol, `Atrás`/`Siguiente`/`Omitir`/`Finalizar`, Escape, preferencia local por usuario y «Volver a ver recorrido» desde Guía. Consentimiento obligatorio tiene prioridad. Preferencia bloqueada no tumba aplicación.
- Alertas pendientes ahora ofrecen detalle contextual; muestra dispositivo, riesgo, cronología y enlace a Historial. Fallo de carga de cronología se anuncia como error. Temperatura/duración no se muestran porque entidad de alerta actual no contiene esos datos; ampliación exige contrato API.
- Monitoreo diferencia historial cargando, vacío y fallido. SSE descarta lecturas con ID ya presente. Estado de conexión y última lectura siguen visibles.
- Trazabilidad explica vínculo entre registros en una franja breve. Tabla básica oculta hashes; «Mostrar detalles técnicos» revela sellos anterior/actual bajo demanda. [Antes](.playwright-mcp/baseline-ready-trazabilidad.png) / [después](.playwright-mcp/after-final-trazabilidad.png).

## Interacción y accesibilidad

Radix gestiona foco de diálogo; recorrido admite Escape, teclado y `prefers-reduced-motion`. En navegador se observó duración computada casi nula con movimiento reducido. Axe sobre Monitoreo, Alertas e Historial en ese modo: 0 violaciones WCAG 2 A/AA. Contraste durante entrada animada puede ser menor transitoriamente; lector de pantalla no probado.

## Responsive

Baseline inspeccionado a 1920×1080, 1440×900, 1366×768, 1280×720, 900 px y 390 px. Dashboard, Alertas e Historial sin overflow horizontal detectado en muestras. En móvil, spotlight señala botón de menú; texto indica usarlo tras cerrar recorrido porque diálogo bloquea interacción exterior.

## Pendientes

Detalle contextual de mediciones relacionadas requiere filtros de Historial por alerta/lectura; visualización de duración y temperatura exige ampliar respuesta API. Revisar contraste y lector de pantalla con usuario real.
