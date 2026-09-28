# Security Audit

Fecha: 2026-09-19. Alcance: frontend `Front`; backend hermano consultado solo para comprobar contratos de autenticación. Auditoría estática y `npm audit`; pruebas de navegador y despliegue efectivo se registran por separado.

## Autenticación y sesión

- Login con contraseña: `POST /api/auth/login`; Google opcional: `POST /api/auth/google` ([authService.ts](src/infrastructure/auth/authService.ts), líneas 23-43). Google entrega identidad; backend emite JWT interno.
- JWT productivo guardado solo en variable de módulo y enviado como `Authorization: Bearer` ([apiClient.ts](src/infrastructure/api/apiClient.ts), líneas 13-35). Recarga elimina sesión. En demo, token simulado persiste en `sessionStorage` ([authStore.ts](src/application/stores/authStore.ts), líneas 30-61). No se detectó JWT productivo en `localStorage` ni `sessionStorage` por inspección de código.
- `401` borra token local; logout intenta `POST /api/auth/logout` sin esperar respuesta ([apiClient.ts](src/infrastructure/api/apiClient.ts), líneas 43-52; [authStore.ts](src/application/stores/authStore.ts), líneas 86-111). **P2:** si red falla, sesión local cierra, pero token copiado conserva validez hasta expiración. Requiere prueba de fallo de red y decisión sobre UX/garantía de revocación.
- Backend comprueba firma/expiración JWT, revocación JTI, usuario activo, consentimiento y rol desde base de datos por solicitud (`../backend/src/interface/api/deps.py`, líneas 37-73, 114-122). Guardas frontend protegen navegación, pero autoridad real está en backend ([RouteGuards.tsx](src/presentation/components/RouteGuards.tsx), líneas 8-33). Pruebas HTTP de acceso horizontal y vertical pendientes.
- **P1 condicionado a despliegue multiinstancia:** revocación JTI y tickets SSE usan memoria local al proceso (`../backend/src/infrastructure/security/revocation_store.py`, líneas 6-16). Logout en una instancia no revoca token en otra; reinicio también pierde revocaciones. Confirmar topología real antes de corregir.

## Cookies y consentimiento

Inspección de `src` no encontró `document.cookie` ni cookies propias. Axios envía Bearer, sin `withCredentials` configurado ([apiClient.ts](src/infrastructure/api/apiClient.ts), líneas 23-35). Playwright en demo obtuvo `context.cookies() = []` tras login y recorrido de ocho rutas. Google GIS y despliegue real **no probados**. No se justifica banner de cookies para demo con esta evidencia. `PrivacyConsentModal` aborda consentimiento de privacidad, no consentimiento de tracking.

## Headers y configuración

- [vercel.json](vercel.json), líneas 10-37, declara CSP, `nosniff`, protección de frames, política de referrer, Permissions-Policy y HSTS. No se verificaron headers HTTP de despliegue real.
- **P1 funcional de despliegue:** `buildCommand` actual ejecuta `npm run build:demo` ([vercel.json](vercel.json), línea 3). `VITE_MODO_DEMO=true` sustituye red por adaptador simulado ([modoDemo.ts](src/infrastructure/demo/modoDemo.ts), líneas 1-6; [apiClient.ts](src/infrastructure/api/apiClient.ts), líneas 23-28). Si destino esperado es producción conectada, configuración actual impide datos reales.
- CSP actual `connect-src` permite solo origen propio y Google ([vercel.json](vercel.json), línea 16). API/SSE en Railway quedarían bloqueados hasta generar configuración con origen HTTPS mediante [generar-vercel-json.mjs](scripts/generar-vercel-json.mjs), líneas 33-66. Verificar URL de backend y CSP efectiva antes del despliegue; evitar ampliación indiscriminada.
- Backend en `environment=production` rechaza clave JWT por defecto/corta, CORS `*`, hosts sin allowlist y CORS sin HTTPS (`../backend/src/infrastructure/config.py`, líneas 136-158). No se comprobó configuración Railway efectiva.

## Entradas, API, secretos y logs

- No se encontraron `dangerouslySetInnerHTML` ni asignaciones de `innerHTML` en producto `src`; `innerHTML` aparece solo en test. Revisión exhaustiva XSS/API pendiente.
- `.env.demo` y `.env.example` están versionados; contienen opciones y URLs locales, sin secreto observado. No se revisó historia Git ni variables reales Railway/Vercel/EMQX.
- `ErrorBoundary` registra error y stack en consola ([ErrorBoundary.tsx](src/presentation/components/ErrorBoundary.tsx), línea 32); revisar posibles datos sensibles en excepciones reales.
- Ticket SSE efímero se solicita con Bearer y se envía por query param a `EventSource` ([sseClient.ts](src/infrastructure/sse/sseClient.ts), líneas 23-55). Revisar redacción de logs de URL en proxy/hosting y uso único/expiración del ticket en pruebas integradas.

## Dependencias

Auditoría inicial: 0 alertas productivas y 8 del tooling de desarrollo (4 high, 4 moderate). Tras actualizar transitorios y Vitest a 5.0.1, `npm audit` y `npm audit --omit=dev` reportan **0 vulnerabilidades**. Esto cubre avisos conocidos del lockfile actual; no demuestra ausencia de fallas en código o infraestructura.

## Codex Security

Herramienta real disponible. Escaneo Standard `d20e9260-6f67-4e0d-be85-16b537f81e1e` finalizado con **0 hallazgos validados, cobertura parcial**: revisión directa de 11/117 rutas; sin navegador ni backend dentro del escaneo. Reporte temporal de la herramienta no persistió en el workspace; esta sección conserva resultado observado, no el artefacto original. Daybreak `not_granted`; uso de tokens no disponible. Resultado no demuestra ausencia de vulnerabilidades.

## Riesgos pendientes

1. Probar 401/403, roles, cambio de rol, token expirado, logout con fallo de red, sesión simultánea y acceso directo a API real.
2. Inventariar cookies y headers de despliegue productivo; comprobar CSP con Google GIS y Railway.
3. Revisar historia Git, configuración de secretos y logs de hosting con acceso autorizado.
4. Corregir configuración de producción solo tras confirmar backend y destino reales. Mantener demo claramente separada.
