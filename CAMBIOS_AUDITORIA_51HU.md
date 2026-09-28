# Cambios de la auditoría del backlog de 51 HU finales (2026-08-30) — frontend

Este documento registra lo implementado en `frontend/frontend` para cerrar
las brechas encontradas en la auditoría del backlog final de 51 historias de
usuario frente al estado real del código. Complementa
`backend/CAMBIOS_AUDITORIA_51HU.md` e `iot-firmware/CAMBIOS_AUDITORIA_51HU.md`
— varias de estas historias son contratos de punta a punta; cuando lo son,
se indica qué campo/endpoint del backend las alimenta.

**Verificación real, no solo revisión manual:**

```
npm run typecheck   # tsc -b --noEmit — limpio
npm run lint         # eslint src/ — limpio
npm run test:run     # vitest run — 208/208 en verde (más de una decena de pruebas nuevas o reescritas para el comportamiento descrito abajo)
npm run build        # tsc -b && vite build — build de producción exitoso
```

No se pudo completar la verificación visual en navegador que exige la guía
de este repo para cambios de UI ("start the dev server and use the feature
in a browser") — este entorno de desarrollo no tiene un navegador disponible
para interactuar. Se compensó con pruebas de comportamiento contra el DOM
renderizado (Testing Library + jsdom) que verifican texto, roles ARIA y
atributos reales, no solo que el componente "no truene" — pero es una
verificación automatizada, no una inspección visual humana. Recomendado:
`npm run dev` (o `dev:demo` con `VITE_MODO_DEMO=true`) y revisar
`/dashboard`, `/historial`, `/alertas`, `/usuarios` antes de dar por cerrado
el trabajo de UI de esta pasada.

---

## HU-41 — Gestión de usuarios y autorización RBAC (rol AUDITOR)

- `domain/value-objects/Rol.ts`: nuevo rol `'auditor'` (de solo lectura — nunca debe aparecer en la lista de `permitidos` de una acción que escribe).
- `App.tsx`: reestructuradas las rutas protegidas por rol para reflejar la matriz real del backend en vez de un bloque monolítico `roles={[]}` (solo admin): `/reportes` y `/metricas-ia` ahora aceptan `['farmaceutico', 'auditor']` (`reportes_router.py`/`ia_router.py` ya daban acceso a AUDITOR); `/auditoria` pasa a `['auditor']` (antes admin-only; `auditoria_router.py` ya lo permitía); `/checklist-bpa` se separó a su propio grupo `['farmaceutico']` porque el backend NO le da acceso a AUDITOR (`checklist_router.py`); `/usuarios`, `/dispositivos`, `/firmware` siguen admin-only (el backend no le da a AUDITOR acceso de escritura ni de lectura completa a esas pantallas).
- `AppLayout.tsx`: los ítems de navegación de `/guia`, `/dashboard`, `/historial`, `/alertas`, `/trazabilidad`, `/reportes`, `/metricas-ia`, `/auditoria` ganan `'auditor'` en su lista de `roles` (antes esas páginas eran accesibles por URL directa para AUDITOR pero invisibles en el menú).
- **Cambio de rol de un usuario existente** (criterio 1 de HU-41: "crea un usuario **o** asigna/modifica un rol" — antes solo existía lo primero): `useUsuarios.ts` gana `cambiarRol(usuarioId, rol)` (`PATCH /api/usuarios/{id}/rol`, ya existía en el backend sin consumidor en el frontend); `UsuariosPage.tsx` gana un diálogo "Cambiar rol" por fila, con confirmación y mensaje de éxito/error, análogo al de desactivación.
- Modo demo: nuevo usuario `auditor@demo.pe` en `USUARIOS_DEMO`, y entrada correspondiente en `CUENTAS_DEMO` (accesos rápidos de `LoginPage`).
- i18n: `roles.auditor` (es/en); `usuarios.cambiarRol`, `cambiarRolA`, `confirmarCambiarRol`, `rolActualizadoOk`, `nuevoRol`, `cambiando`.

## HU-23 — Máquina de estados de alertas (PENDIENTE → RECONOCIDA → ATENDIDA)

Antes: el frontend solo conocía el booleano `revisada`/`revisada_por` — el backend ya expone `estado`/`reconocida_en`/`atendida_en` (ver `backend/CAMBIOS_AUDITORIA_51HU.md`, HU-23) sin que ningún consumidor los usara.

- `domain/value-objects/EstadoAlerta.ts` (nuevo): espejo TypeScript de `EstadoAlerta` (backend).
- `domain/entities/AlertaTermica.ts`: gana `estado`, `reconocida_en`, `atendida_en`. `revisada`/`revisada_por` se conservan (el backend los sigue enviando en sincronía) pero dejan de ser la fuente de verdad de la UI.
- `useAlertas.ts`: `FiltroRevision` (`'pendientes'|'revisadas'|'todas'`) → `FiltroEstado` (`'pendiente'|'reconocida'|'atendida'|'todas'`), filtrando por el query param `estado` del backend en vez de `revisada` (boolean). `marcarRevisada` renombrado a `reconocerAlerta` (mismo endpoint `/revisar`, semántica alineada con HU-23).
- `AlertasPage.tsx`: los 3 tabs de filtro pasan a 4 (pendiente/reconocida/atendida/todas); la columna "Estado" muestra el badge de la máquina de estados completa, no solo revisada/pendiente; el botón "Reconocer" solo aparece con `estado === 'pendiente'` (antes: `!revisada`); el botón "Acción correctiva" solo aparece con `estado !== 'atendida'` (antes: siempre visible, incluso sobre alertas ya resueltas) — y ahora está gateado por rol (ver HU-41 más abajo, antes no tenía ningún control de permiso).
- i18n: `alertas.filtro.*` (pendiente/reconocida/atendida/todas), `alertas.estadoAlerta.*` (etiquetas de badge), `alertas.reconocer` — reemplazan las claves antiguas `pendientes`/`revisadas`/`revisar`/`revisada`.
- Modo demo (`datosDemo.ts`/`demoAdapter.ts`): el simulador y el adaptador ahora implementan la máquina de estados real (incluido el 409 al reconocer/atender dos veces), no solo el booleano.
- Pruebas nuevas/actualizadas: `AlertasPage.test.tsx` (filtros, RBAC por rol incluyendo AUDITOR, sin acciones sobre alerta atendida), `PantallasClave.test.tsx` (reconocer, conflicto).

**Control de acceso por rol que antes no existía:** el botón "Acción correctiva" no tenía ningún gate — cualquier rol autenticado (incluido, ahora, AUDITOR) podía abrir el diálogo y disparar un `POST` que el backend rechazaría con 403. Ahora `puedeRegistrarAccion = tienePermiso(rol, ['farmaceutico', 'tecnico'])` oculta el botón para quien no puede usarlo, igual que ya se hacía con "Reconocer".

## HU-27 — Persistencia de acción correctiva (Escenario 2: conflicto de concurrencia)

**Hallazgo:** el backend ya rechaza con 409 tanto `/revisar` como `/acciones-correctivas` cuando otro usuario adelantó la operación (`AlertaTermica.reconocer()`/`marcar_atendida()`), pero el frontend no capturaba el error — un `catch` ausente dejaba la promesa rechazada sin manejar, sin ningún mensaje visible. El criterio 2 de HU-27 exige explícitamente "informa visualmente que la alerta ya no está vigente".

- `useAlertas.ts`: `reconocerAlerta`/`registrarAccionCorrectiva` devuelven ahora `'ok' | 'conflicto' | 'error'` (mismo patrón que `useUsuarios.crear/desactivar`), y refrescan la lista tanto en éxito como en conflicto — para que la fila muestre el estado real en vez de quedar desactualizada.
- `AlertasPage.tsx`: nuevo mensaje `role="alert"` junto al botón "Reconocer" y dentro del diálogo de acción correctiva cuando el backend responde 409.
- i18n: `alertas.conflictoEstado` (es/en).
- Pruebas nuevas: `AlertasPage.test.tsx::avisa cuando otro usuario ya reconoció la alerta`, `PantallasClave.test.tsx::avisa cuando otro usuario ya atendió la alerta primero`.

## HU-34 — Visualización del riesgo efectivo

**Hallazgo:** el backend ya separa `nivel_riesgo` (model_class cruda de la IA/salvaguarda) de `riesgo_efectivo`/`excursion_confirmada` (política determinista — ver `backend/CAMBIOS_AUDITORIA_51HU.md`, HU-18/21/34), pero el dashboard, el historial y los reportes BPA seguían leyendo `nivel_riesgo` directamente para el semáforo principal — exactamente lo que el backlog pide evitar ("el frontend no debe inferir una excursión confirmada a partir de nivel_riesgo=excursion_critica por sí solo").

- `domain/entities/LecturaTermica.ts`: gana `excursion_confirmada`, `riesgo_efectivo`, `reading_id`, `schema_version`.
- `DashboardPage.tsx`: el semáforo principal, el anuncio SSE (`AnuncioRiesgo`) y el contador "fuera de rango" del resumen de ventana pasan de `nivel_riesgo` a `riesgo_efectivo`/`excursion_confirmada`. Nuevo texto "Excursión confirmada por temperatura" cuando `excursion_confirmada === true` (criterios 1-3). Nuevo aviso diferenciado (criterio 4) cuando la IA clasificó `excursion_critica` pero la regla directa NO la confirmó — nunca se afirma una excursión sin que la temperatura la respalde.
- `HistorialPage.tsx`: la columna de riesgo usa `riesgo_efectivo`.
- `useReportesBPA.ts`: el CSV de reportes BPA usa `riesgo_efectivo` (antes exportaba la clase cruda de la IA en un documento de cumplimiento — la exportación JSON ya incluía el objeto completo, así que ya traía el dato correcto, pero el CSV lo formateaba con el campo equivocado).
- i18n: `dashboard.excursionConfirmada`, `dashboard.clasificacionIaDivergente`.
- Pruebas nuevas: `DashboardPage.test.tsx` (3), `HistorialPage.test.tsx` (1).

## HU-35 — Notificación UI de puerta abierta (MC-38 opcional)

**Hallazgo de contrato faltante:** el firmware ya reporta `duracion_apertura_segundos` (HU-04) y el backend ya lo guardaba en el JSONB `payload`, pero `LecturaResponse` nunca lo exponía — se corrigió en el backend esta misma pasada (ver `backend/CAMBIOS_AUDITORIA_51HU.md`, HU-35) antes de poder implementar esto.

- `domain/entities/LecturaTermica.ts`: `apertura_refrigerador` pasa a `boolean | null` (HU-04: `null` = sin MC-38 instalado); nuevo `duracion_apertura_segundos: number | null`.
- `lib/formato.ts`: nuevo `duracionBreve(segundos)` → formato reloj "M:SS".
- `DashboardPage.tsx`: tarjeta de puerta con tres estados en vez de dos — abierta/cerrada/sin sensor MC-38 (antes `null` se trataba como `false`, mostrando "Cerrada" para un sensor que no existe). Con la puerta abierta, muestra el tiempo transcurrido y resalta con `role="alert"` cuando supera `UMBRAL_PUERTA_ABIERTA_SEGUNDOS` (120 s — umbral de UI, no una regla de alertas del backend).
- `HistorialPage.tsx`: la celda de puerta distingue el ícono de "sin MC-38" del de "cerrada".
- `useReportesBPA.ts`: el CSV distingue "sin sensor" de "cerrada" en la columna de puerta.
- i18n: `dashboard.puertaSinSensor`, `dashboard.puertaProlongada`.
- Pruebas nuevas: `DashboardPage.test.tsx` (4), `HistorialPage.test.tsx` (1).

## HU-33 — Tarjetas de KPI (criterio 3: falla de sensor)

**Hallazgo:** `LecturaResponse.estado_sensores` (`{temperatura_interna, temperatura_ambiental, humedad_ambiental} → "valido"|"ausente"|"invalido"|"fisicamente_imposible"`) ya llegaba en cada lectura, pero ninguna tarjeta KPI lo leía — un sensor caído se mostraba igual que "todavía no llegó el dato" (un guion `—`), justo la confusión que el criterio 3 pide evitar.

- `DashboardPage.tsx`: `TarjetaMetrica` gana `fallaSensor`/`textoFallaSensor` — cuando `estado_sensores[campo] !== 'valido'`, la tarjeta reemplaza el valor por "Falla de sensor — sin lectura disponible" con `role="alert"`, ícono de advertencia y borde distintivo, en vez de un guion mudo.
- i18n: `dashboard.fallaSensor`.
- Pruebas nuevas: `DashboardPage.test.tsx` (2).

## HU-50 — Supervisión de eventos de seguridad (criterio 1: filtros)

**Hallazgo:** el backend ya expone `desde`/`hasta`/`usuario_id`/`accion` en `GET /api/auditoria` (ver `backend/CAMBIOS_AUDITORIA_51HU.md`, HU-50), pero `useAuditoria.ts` hacía una única consulta fija (`limite: 200`, sin ningún filtro) y `AuditoriaPage.tsx` no tenía ningún formulario — era una lista plana, sin forma de acotar por periodo, actor o tipo de evento. Esto contradice directamente el criterio 1 ("cuando filtra por periodo, usuario o tipo, entonces puede consultar…"); mi primer borrador de este changelog daba esto por ya resuelto sin haber leído el componente — al verificarlo se encontró que no era cierto, así que se implementó de verdad.

- `useAuditoria.ts`: gana `consultar(filtros)` con el mismo patrón que `useHistorial.ts` (`FiltrosAuditoria { desde, hasta, usuario_id, accion }`).
- `AuditoriaPage.tsx`: nuevo formulario de filtros (acción, usuario por UUID, rango de fechas), calcado del de `HistorialPage.tsx` para mantener el mismo lenguaje de interacción en toda la app.
- i18n: `auditoria.filtros`; reutiliza `historial.desde/hasta/aplicar/limpiar`.
- Prueba nueva: `AuditoriaPage.test.tsx::HU-50 criterio 1: permite filtrar por acción, usuario y periodo`.
- Los eventos `BUFFER_SATURADO`/`WIFI_RECONEXION_PROLONGADA` (HU-06/HU-08, ver changelog del backend) y `UMBRAL_INTENTOS_FALLIDOS_EXCEDIDO` ya aparecen en esta lista sin cambios adicionales — la tabla renderiza cualquier `accion` de forma genérica.

## No implementado en esta pasada (con justificación)

- **HU-31 (tendencia térmica) — ya satisfecho, verificado, sin cambios:** el `markArea`/`markLine` de 2–8 °C en `construirOpcionCurva()` ya existe (Escenario 1); el estado vacío del dashboard (`ultima === null`) ya cubre el Escenario 2 a nivel de vista en vivo; el volumen de puntos ya está acotado por el `limite` de la consulta al backend, sin necesidad de downsampling adicional en ECharts para los volúmenes que maneja este prototipo.
- **HU-32 (SSE autenticado) — ya satisfecho, verificado, sin cambios:** el reintento con ticket fresco y el indicador visual conectado/desconectado ya existen en `sseClient.ts`/`DashboardPage.tsx`; múltiples pestañas ya funcionan de forma independiente por construcción (una conexión `EventSource` por pestaña). El reintento es a intervalo fijo (5 s), no con backoff exponencial — se consideró suficiente para el criterio ("intenta restablecer... automáticamente"), no se tocó para no arriesgar regresiones en un mecanismo que ya funciona.
- **HU-36 (filtros de historial) — ya satisfecho, verificado, sin cambios:** filtro server-side por dispositivo/riesgo/fechas ya implementado (`useHistorial.ts`); validación de rango invertido ya existe en frontend Y backend (`_validar_rango` en `lecturas_router.py`, HU-36 backend).
- **HU-48 (sincronización y brechas temporales) — fuera de alcance real, no simulado:** requiere que el ESP32 reporte al backend cuántas lecturas tiene pendientes en LittleFS *en vivo* (no solo al momento de una saturación) — esa telemetría no existe en el contrato actual (`LecturaPayload` no declara un conteo de pendientes) y añadirla es un cambio de protocolo firmware↔backend, no solo de UI. Lo que SÍ quedó resuelto esta pasada — el evento `buffer_saturado` (HU-06, con periodo afectado) — ya llega a `AuditoriaPage.tsx` sin cambios adicionales (ver HU-50 arriba), pero no hay una superposición gráfica de la brecha sobre la curva térmica (Escenario 2 completo), que sí queda pendiente.
