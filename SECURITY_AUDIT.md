# Security Audit

Actualizado: 2026-10-21. Sustituye a la versión del 2026-09-19, cuyas
afirmaciones (acceso con Google y modal de privacidad) dejaron de ser ciertas
tras el rediseño del login y volvieron a serlo con la remediación FE-001/FE-005.

La auditoría completa de esta fecha está en `AUDITORIA_SEGURIDAD_FRONTEND.md`
(raíz del proyecto, hallazgos FE-001 a FE-011). Este archivo resume el estado
del código tras su remediación; cada punto remite al commit `fix(security):
FE-0XX` correspondiente.

## Autenticación y sesión

- Contraseña: `POST /api/auth/login`. Google (opcional, solo con
  `VITE_GOOGLE_CLIENT_ID`): Google Identity Services entrega un ID token que se
  canjea en `POST /api/auth/google`; el backend verifica firma, `aud`, `iss`,
  `exp` y `email_verified` (FE-001). No existe acceso con Facebook ni ningún
  token fabricado en el cliente; el store no acepta tokens arbitrarios.
- El JWT vive solo en memoria; recargar cierra la sesión. El logout revoca el
  `jti` en el servidor (persistente, BE-009).
- Contraseña temporal (alta, restablecimiento o reactivación por un
  administrador): todas las rutas llevan al cambio obligatorio (FE-004).
- Recuperación: enlace de un solo uso enviado por el backend; el token viaja
  en el fragmento de la URL, se borra al leerlo y no existe valor por defecto
  (FE-004).
- Consentimiento de privacidad (Ley N.° 29733): modal bloqueante cuando el
  backend lo exige, también ante un 403 a mitad de sesión (FE-005).

## Modo demo

- Solo con `VITE_MODO_DEMO=true` (fallo cerrado); un build sin modo explícito
  falla (FE-002). Aviso persistente de datos simulados en todas las pantallas.
- El build contra el backend no contiene el adaptador demo, las cuentas, la
  contraseña demo ni el generador de JWT sin firma; CI lo verifica con
  `npm run verificar:bundle` (FE-009).

## Cabeceras y CSP

- `vercel.json` se genera con `scripts/generar-vercel-json.mjs` desde
  `scripts/csp.mjs`: sin orígenes de terceros salvo GIS cuando se usa Google
  (`--google`). `style-src 'unsafe-inline'` se mantiene por Radix; la retirada
  y Trusted Types se miden con `Content-Security-Policy-Report-Only` (FE-007).

## Entradas, API y registros

- Rutas de API con identificadores construidas con `rutaApi` (codifica cada
  segmento y rechaza `.`/`..`); una regla de ESLint lo exige (FE-006).
- Exportación CSV: neutralización de fórmulas en campos de texto, números sin
  alterar (FE-010).
- Eventos SSE alineados con el backend, incluidos LWT, alertas y
  `sesion_expirada` (FE-008). Credenciales IoT rotadas/revocadas con el
  contrato real; el token rotado se muestra una sola vez (FE-003).
- Errores de interfaz: detalle solo en desarrollo; en producción, el tipo de
  error (FE-011).

## Pendiente fuera del código

- Verificar en Vercel las cabeceras efectivas y la variable `VITE_MODO_DEMO`
  del proyecto de producción (la demo pública debería vivir en un proyecto o
  dominio separado).
- Revisar las violaciones de la política Report-Only antes de aplicarla.
