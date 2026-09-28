# Mejoras de accesibilidad, UX y rendimiento del frontend

Revisión del dashboard de monitoreo de cadena de frío contra **WCAG 2.2 nivel AA**
y contra los requisitos RF-11, RF-18 y RNF-10 de la tesis.

El sistema de diseño existente («Botica Editorial»: crema, tinta cálida,
Fraunces/Instrument Sans/IBM Plex Mono, radios variados, sombras cálidas) se
mantiene sin cambios de lenguaje visual. Las correcciones se hicieron **dentro**
de ese sistema: un token de color oscurecido, uno nuevo para bordes de campo, y
el resto en estructura y semántica del marcado.

## Alcance de lo verificado

Se auditaron las 12 páginas, el layout, los primitivos de UI (`button`, `badge`,
`card`, `dialog`, `input`, `table`), el semáforo de riesgo, la paginación, el
envoltorio de ECharts y la capa i18n.

**Lo que no se pudo medir de verdad y por tanto no se afirma aquí:**

- **Tiempos reales de carga (RNF-10 ≤ 3 s).** No se ejecutó Lighthouse ni se
  midió en red real ni en dispositivo. Lo único medido es el **peso de los
  paquetes** que produce `npm run build`, que se reporta abajo con cifras
  exactas. El peso es una causa del tiempo de carga, no el tiempo de carga.
- **Prueba con lector de pantalla real** (NVDA/VoiceOver). Lo verificado es la
  estructura del árbol de accesibilidad en jsdom: roles, nombres accesibles,
  regiones vivas y foco. Es una condición necesaria, no suficiente.
- **Puntuación SUS ≥ 70.** Requiere pasar el cuestionario a usuarios reales.
  Aquí solo se corrigieron obstáculos que la penalizarían.
- **Contraste de texto sobre imagen o gradientes.** Se midieron los tokens
  planos; el velo radial del `body` altera el fondo unos pocos puntos, no
  contemplados en el cálculo.

## Hallazgos y correcciones

### A1 — Una excursión térmica no se anunciaba a un lector de pantalla · Crítico

**Criterio:** WCAG 4.1.3 Mensajes de estado (AA). También RF-11.

La lectura que llega por SSE repinta la píldora del semáforo y las cifras de las
tarjetas sin mover el foco ni alterar la estructura del documento. Un lector de
pantalla no tiene motivo para releer nada, así que el evento que justifica todo
el sistema —el medicamento fuera del rango 2–8 °C— pasaba completamente
inadvertido para quien no ve la pantalla.

**Cambio:** nuevo componente `AnuncioRiesgo`
(`src/presentation/components/AnuncioRiesgo.tsx`), montado en `DashboardPage`.
Dos regiones vivas permanentes y vacías: `role="alert"` /
`aria-live="assertive"` para la excursión crítica (interrumpe la lectura en
curso, que es lo que corresponde) y `role="status"` / `aria-live="polite"` para
los demás niveles. Solo se anuncia el **cambio** de nivel, nunca cada lectura, y
el mensaje incluye la temperatura, porque «excursión crítica» a secas no
distingue 9 °C de 22 °C.

**Pruebas:** `accesibilidad.test.tsx` → «AnuncioRiesgo — mensajes de estado del
flujo SSE», 5 casos: silencio en el primer render, anuncio asertivo con la
cifra, presencia en el árbol de accesibilidad pese a `sr-only`, no repetición
ante lecturas del mismo nivel, y uso de la región cortés para el riesgo
preventivo.

### A2 — Texto `faint` por debajo del contraste mínimo · Alto

**Criterio:** WCAG 1.4.3 Contraste (mínimo), AA, 4.5:1 para texto normal.

`--color-faint: #9c8d81` daba **3.13:1** sobre `surface` (#fdfcf8) y **2.92:1**
sobre `background` (#f7f4ea) y sobre la cabecera de tabla (cream-100). No es un
color decorativo: viste la clase `.eyebrow` (11 px), las cabeceras de todas las
tablas, los textos de apoyo y las etiquetas de los ejes de las gráficas.

**Cambio:** `--color-faint: #7d6d5f` en `src/index.css`. Medido: **4.84:1**
sobre `surface` y **4.52:1** sobre `background` y sobre la cabecera de tabla.
Mismo neutral cálido, un paso más oscuro. Los literales `#9c8d81` incrustados en
las opciones de ECharts de `DashboardPage` (etiquetas de eje y serie ambiental)
se actualizaron al mismo valor.

Resto de pares medidos, todos conformes y sin tocar: `muted`/`surface` 5.48:1 ·
`foreground`/`surface` 12.83:1 · `pine-600`/`surface` 7.43:1 · badge `ok`
9.13:1 · badge `warn` 5.04:1 · badge `critical` 6.33:1 · chip SSE 6.16:1 ·
botón primario 7.43:1 · botón peligro 5.82:1.

### A3 — El borde de los campos de formulario no era percibible · Alto

**Criterio:** WCAG 1.4.11 Contraste no textual (AA, 3:1 para componentes de UI).

`--color-border-strong` (#cbbd9a) contra el fondo del propio campo daba
**1.81:1**. El contorno es el único indicio de dónde empieza un `input`, así que
el campo era prácticamente invisible.

**Cambio:** token nuevo `--color-border-field: #948468` (**3.55:1**), aplicado a
`Input`, `Textarea` y `NativeSelect`. Los bordes de tarjeta y de las píldoras
`outline` se dejaron como estaban: son separadores decorativos, no componentes
que haya que identificar, y endurecerlos habría cambiado el carácter del diseño.

### A4 — El semáforo de riesgo dependía solo del color · Alto

**Criterio:** WCAG 1.4.1 Uso del color (A).

Los tres niveles se distinguían por el tinte de la píldora y un punto del mismo
color. La etiqueta textual existía, pero el detalle explicativo («Fuera del
rango 2–8 °C: revisar el refrigerador ahora») vivía solo en el atributo `title`,
que ni el teclado alcanza ni la mayoría de lectores de pantalla expone.

**Cambio:** en `RiskBadge`, cada nivel lleva una forma propia —círculo,
triángulo, octágono— además de su etiqueta, de modo que la píldora sigue siendo
legible impresa en blanco y negro o con una deficiencia protán/deután. El
detalle pasa de `title` a texto `sr-only`. Mismo tratamiento en los estados
inactivos de `UsuariosPage` y `DispositivosPage`, que escondían el motivo de la
baja en un `title`.

**Pruebas:** «RiskBadge — el nivel no depende solo del color», 3 casos, incluido
que los tres iconos sean efectivamente distintos y que no quede ningún `title`.

### A5 — La gráfica térmica era inaccesible por construcción · Alto

**Criterio:** WCAG 1.1.1 Contenido no textual (A).

ECharts dibuja sobre `<canvas>`: un mapa de píxeles sin nodos que recorrer. El
contenedor no tenía rol ni nombre, así que la gráfica sencillamente no existía
en el árbol de accesibilidad.

**Cambio, en dos capas:**

1. `EChartWrapper` exige ahora `ariaLabel` (prop obligatoria, no opcional: es la
   única forma de que no se olvide) y expone `role="img"` más
   `aria-describedby`.
2. Nombrar la gráfica da un nombre, no los datos. Nuevo componente
   `TablaAlternativa`: las mismas series en una tabla HTML real, navegable celda
   a celda, dentro de un `<details>` nativo —operable por teclado y anunciado
   como contraído/expandido sin ARIA añadido—. Se mantiene plegada por decisión
   de UX, no de accesibilidad: sesenta filas fijas bajo la gráfica arruinarían
   la lectura de un vistazo del dashboard.

**Pruebas:** «TablaAlternativa», 4 casos: equivalencia de datos, uso de la
divulgación nativa, montaje diferido y ausencia de render con serie vacía.

### A6 — No había forma de saltar la navegación · Medio

**Criterio:** WCAG 2.4.1 Evitar bloques (A).

Doce enlaces de navegación se repiten en cada página. Llegar al contenido con el
teclado exigía atravesarlos uno a uno en todas las rutas.

**Cambio:** enlace de salto como primer elemento enfocable del documento, oculto
hasta recibir el foco, apuntando a `#contenido-principal`. El `<main>` recibe
ese `id`, `tabIndex={-1}` para poder ser destino del salto, y un nombre
accesible.

**Pruebas:** «Enlace de salto al contenido», 3 casos: destino correcto, primer
elemento del orden de tabulación y nombres de navegación.

### A7 — Regiones sin nombre y duplicadas · Medio

**Criterio:** WCAG 1.3.1 Información y relaciones (A).

El `<nav>` no tenía nombre y el mismo componente se renderiza dos veces —barra
lateral de escritorio y cajón móvil—, de modo que con el cajón abierto la lista
de regiones mostraba dos entradas idénticas y los `id` usados por
`aria-labelledby` quedaban duplicados.

**Cambio:** `ContenidoSidebar` recibe `etiquetaNav` y `sufijoId`; cada instancia
tiene nombre propio y los encabezados de sección etiquetan su `<ul>` mediante
`aria-labelledby` con identificadores únicos. `<main>` recibe nombre accesible.

### A8 — Las tablas no tenían nombre ni estado · Medio

**Criterio:** WCAG 1.3.1, 2.1.1 Teclado (A), 4.1.3.

Tres problemas en el primitivo `Table`: sin `<caption>`, varias tablas por
página se anuncian todas como «tabla, 7 columnas» sin distinguirlas; el
contenedor con desplazamiento horizontal (`overflow-x-auto`, presente en móvil
por el `min-width` de 560 px) no era alcanzable por teclado, así que se
desplazaba con el dedo pero no con el tabulador; y no había señal de consulta en
curso.

**Cambio:** props `titulo` y `cargando` en `Table` → `<caption>` oculto,
`role="region"` con nombre, `tabIndex={0}` en el contenedor desplazable y
`aria-busy`. `TableHead` emite `scope="col"` por defecto. Aplicado en Historial,
Alertas, Usuarios y Dispositivos.

**Pruebas:** «Tabla de datos», 4 casos.

### A9 — Las confirmaciones destructivas se comportaban como diálogos normales · Medio

**Criterio:** WCAG 3.3.4 Prevención de errores (AA) — dar de baja un dispositivo
y desactivar un usuario son acciones que la interfaz no deshace.

Ambos diálogos usaban `role="dialog"`, que solo hace anunciar el título, y el
foco inicial caía sobre el primer campo del formulario: un Enter reflejo enviaba
la baja sin haber leído a quién o a qué afectaba.

**Cambio:** prop `destructivo` en `DialogContent` → `role="alertdialog"` (el
lector anuncia el cuerpo entero, no solo el título) y el foco inicial se posa en
el contenedor en vez de en el formulario. Aplicado a la desactivación de usuario
y a la baja de dispositivo. Los botones de fila de ambas tablas reciben además
un nombre accesible que incluye el sujeto («Desactivar a Ana Torres», «Dar de
baja el dispositivo FARM-01-CDL»): fuera del contexto visual de la fila, doce
botones llamados «Desactivar» son indistinguibles.

**Pruebas:** «Diálogo de acción destructiva», 5 casos, incluido que un diálogo
normal conserve su rol y que se cierre con Escape.

### A10 — El idioma del documento no seguía al conmutador · Medio

**Criterio:** WCAG 3.1.1 Idioma de la página (A) y 3.1.2 Idioma de las partes (AA).

`index.html` declara `lang="es"` de forma estática. Al cambiar a inglés, el
lector de pantalla seguía leyendo la interfaz entera con las reglas de
pronunciación del español.

**Cambio:** `sincronizarIdiomaDocumento` en la capa i18n, suscrita a
`languageChanged`.

**Pruebas:** «Idioma del documento», 2 casos.

### A11 — Campos y controles sin etiqueta asociada · Medio

**Criterio:** WCAG 3.3.2 Etiquetas o instrucciones (A), 1.1.1, 4.1.2.

- El `<textarea>` de acción correctiva en Alertas solo tenía `placeholder`, que
  no es una etiqueta: desaparece al escribir. Ahora tiene `<Label htmlFor>`,
  texto de ayuda asociado por `aria-describedby` y el placeholder pasa a ser un
  ejemplo real.
- El grupo de filtros de Alertas eran tres botones sueltos sin nombre colectivo;
  ahora `role="group"` con `aria-label`, como ya hacía `LanguageSwitcher`.
- El formulario de filtros de Historial se asocia a su encabezado por
  `aria-labelledby`.
- Los iconos de puerta abierta/cerrada en Historial llevaban `aria-label` sobre
  un `<svg>` sin rol, combinación que buena parte de los lectores ignora; ahora
  con `role="img"`.
- El botón de cierre de todos los diálogos tenía `aria-label="Cerrar"` escrito a
  mano en español: se quedaba sin traducir con la interfaz en inglés.
- El respaldo de `Suspense` era un «…» suelto, sin texto ni rol: el lector solo
  percibía que la página se había vaciado. Ahora `role="status"` con texto
  traducido.
- La confirmación de acción correctiva registrada aparecía sin `role="status"`.

### A12 — Cadenas y fechas fuera de i18n · Bajo

En Dispositivos, el estado de conectividad se pintaba con el literal del backend
(`online` / `offline`), las dos únicas cadenas que no pasaban por i18n. Y las
tablas formateaban fechas con `toLocaleString('es-PE')` escrito a mano: con la
interfaz en inglés producía documentos mixtos y, peor para una auditoría, fechas
en formato día/mes que un lector angloparlante interpreta al revés.

**Cambio:** nuevo `src/lib/formato.ts` (`fechaHora`, `hora`, `localeActual`)
ligado al idioma resuelto, aplicado en Dashboard, Historial y Alertas. Estado de
conectividad traducido.

### Verificado y correcto — no se tocó

- `prefers-reduced-motion`: ya neutralizaba animaciones y transiciones de forma
  global en `index.css`.
- `:focus-visible` global con contorno de 2 px y desplazamiento de 2 px, medido
  a 6.93:1 contra el fondo.
- Paridad de claves ES/EN: era exacta antes (325/325) y lo sigue siendo
  (338/338 tras añadir 13 claves nuevas en ambos idiomas).
- Tamaño de fuente de 16 px en campos móviles para evitar el zoom de iOS.
- `NavLink` de React Router ya emitía `aria-current="page"`.
- Los mensajes de error de formulario ya usaban `role="alert"`.
- `Paginacion` ya tenía `<nav>` con nombre y `aria-current`.

## Rendimiento (RNF-10)

Medido con `npm run build`. **Son pesos de paquete, no tiempos.**

### Antes

| Recurso | Bruto | Gzip |
|---|---|---|
| `index` (entrada) | 418.53 kB | 135.90 kB |
| `react` | 51.41 kB | 17.22 kB |
| `echarts` (diferido) | 606.33 kB | 205.23 kB |
| **Ruta crítica de `/login`** | **469.94 kB** | **153.12 kB** |

### Después

| Recurso | Bruto | Gzip |
|---|---|---|
| `index` (entrada) | 58.10 kB | 20.50 kB |
| `react` | 233.83 kB | 73.89 kB |
| `vendor` | 102.82 kB | 34.10 kB |
| `i18n` | 49.39 kB | 15.35 kB |
| `radix` (diferido) | 29.41 kB | 10.01 kB |
| `AppLayout` (diferido) | 8.66 kB | 3.10 kB |
| `echarts` (diferido) | 606.33 kB | 205.23 kB |
| **Ruta crítica de `/login`** | **444.14 kB** | **143.84 kB** |

Reducción de la ruta crítica: **−25.8 kB brutos, −9.3 kB gzip (−6 %)**.
Confirmado en `dist/index.html`: los trozos `radix` y `AppLayout` ya no
aparecen entre los `modulepreload` iniciales.

**Causas y cambios:**

1. **`react-dom` estaba en el paquete de entrada, no en el de vendor.** El
   reparto por objeto (`{ react: ['react', 'react-dom', …] }`) casa por
   identificador de módulo exacto, y `main.tsx` importa `react-dom/client`, que
   es otro identificador. React-DOM —lo más pesado después de ECharts— nunca
   entró en su trozo. Sustituido por una función que reparte por ruta real. El
   efecto principal no es el peso total sino el **almacenamiento en caché**:
   antes, cada despliegue del código propio obligaba a redescargar React entero.
2. **El layout y el modal de privacidad se importaban de forma directa**, así
   que la pantalla de login arrastraba Radix Dialog, el bloqueo de scroll y los
   doce iconos de navegación antes de poder pintar el formulario. Ahora ambos
   son diferidos.
3. **La tabla alternativa de la gráfica monta sus filas solo al desplegarse.**
   Con una lectura SSE cada pocos segundos y una serie de 60 puntos, mantenerlas
   montadas habría significado reconstruirlas en cada evento para algo que nadie
   está mirando. Es una regresión que la corrección A5 habría introducido y que
   se evitó, no una mejora sobre el estado anterior.

**Lo que se dejó estar, y por qué:**

- `tailwind-merge` pesa 102 kB brutos para resolver conflictos de clases en
  `cn()`. Se podría prescindir de él, pero varios componentes dependen de que
  una clase pasada por `className` gane a la de base; quitarlo arriesga
  regresiones visuales silenciosas por un beneficio modesto.
- ECharts (606 kB) ya está diferido y solo entra al abrir el dashboard.
  *(Revisado en la segunda ronda: ver B-12; se recortó un 11 %.)*
- No se tocó el flujo de re-render del SSE más allá del punto 3. `serie` es un
  array nuevo en cada evento y la opción de la gráfica se reconstruye con él;
  eso es inherente a una gráfica en vivo. No se perfiló, así que no se afirma
  nada sobre su coste real.


---

# Segunda ronda

Cubre lo que la primera dejó declarado como pendiente —revisión página a página
de las ocho pantallas no auditadas—, la alineación con los cambios que el
backend introdujo en la misma sesión, y la puerta de despliegue de la CSP.

## Contrato con el backend

Se leyó `backend/MEJORAS_BACKEND.md` y se contrastaron los hooks y los tipos del
frontend con los esquemas reales de `reportes_router.py` y
`trazabilidad_router.py`.

El hallazgo S-03 del backend —el reporte BPA adjuntaba alertas y trazabilidad de
todo el histórico, ignorando el periodo— **no tenía contraparte en el
frontend**: `useReportesBPA` ya enviaba `fecha_desde` y `fecha_hasta` en ambos
endpoints. El defecto era íntegramente del servidor. Pero el hecho de que el
backend ahora sí respete esas fechas destapó tres problemas del lado del
cliente que hasta ahora eran invisibles.

### B-01 — Los dos extremos del periodo se interpretaban en husos distintos · Alto

**Archivo:** `src/application/hooks/useReportesBPA.ts`

```ts
fecha_desde: new Date(desde).toISOString(),                 // medianoche UTC
fecha_hasta: new Date(`${hasta}T23:59:59`).toISOString(),   // hora local
```

`new Date('2026-01-15')` se interpreta como medianoche **UTC**;
`new Date('2026-01-15T23:59:59')`, como hora **local**. En Lima (UTC−5) el
inicio del periodo caía a las 19:00 del día anterior mientras el fin era
correcto, de modo que un reporte «del 15 de enero» arrastraba cinco horas del
día 14 y se las atribuía al periodo declarado.

Mientras el backend ignoraba las fechas el desfase no producía ningún síntoma.
Con S-03 corregido, pasa a contaminar el documento que se presenta en una
inspección: exactamente el problema que S-03 pretendía resolver, reintroducido
desde el cliente.

**Cambio:** `inicioDelDiaLocal()` y `finDelDiaLocal()` construyen ambos
extremos a partir de los componentes de la fecha en calendario local.

**Pruebas:** `ReportesBPA.contrato.test.ts` — «envía el inicio y el fin del día
en hora local, no medianoche UTC» comprueba que ambos extremos caen en el mismo
día local, a las 00:00 y a las 23:59.

### B-02 — Los rechazos nuevos del backend se mostraban como «error» a secas · Medio

El backend añadió en S-05 dos validaciones (rango invertido y periodos de más de
`MAX_DIAS_RANGO_REPORTE = 366` días, ambas 400) y una cuota propia de 10
peticiones por minuto y usuario (429). El hook colapsaba todo en un booleano y
la página mostraba siempre «no se pudo generar el reporte». Con un periodo por
defecto de 30 días, un usuario que pidiera un rango de tres años recibía un
error sin ninguna pista de qué corregir.

**Cambio:** `ErrorReporte` como unión de `'rango_invertido' |
'periodo_excesivo' | 'cuota' | 'generico'`. Los dos casos de 400 se validan
**antes** de salir a la red con `validarRango()`, que replica `_validar_rango()`
del backend —el endpoint tiene cuota propia, así que gastar un intento en algo
que se sabe que será rechazado penaliza al usuario dos veces—. El 429 se
clasifica por código de estado, no analizando el texto castellano del `detail`.
La página muestra el motivo concreto, deshabilita el botón mientras el rango es
inválido y anuncia el número de días seleccionados en una región `status`.

**Pruebas:** `ReportesBPA.contrato.test.ts` (9 casos) — límite exacto de 366
días, rango invertido, cuenta de días a través de un cambio de horario de
verano, ausencia de petición cuando el rango es inválido, y distinción entre 429
y el resto. Más 4 casos en `PantallasClave.test.tsx` sobre los mensajes.

### B-03 — Una lectura SSE anterior a la respuesta del historial se perdía · Alto

**Archivo:** `src/application/hooks/useMonitoreoTermico.ts`

El efecto lanza a la vez el `GET /api/lecturas` del historial y la suscripción
SSE, y la respuesta del GET hacía `setSerie([...data].reverse())`, un
sobreescritura incondicional. Si una lectura en vivo llegaba mientras el GET
seguía en vuelo, quedaba borrada. La ventana es corta pero real —el backend
arregló en esta misma sesión la reconexión del stream (S-02), que es cuando más
probable es recibir un evento inmediato—, y la lectura que se pierde es
precisamente la que motivó abrir el dashboard.

Se descubrió escribiendo la prueba de flujo sostenido: dos casos fallaban
porque la respuesta del historial vaciaba lo ya recibido.

**Cambio:** el historial se antepone a lo ya presente en vez de sustituirlo, y
se descarta por `id` lo que venga repetido.

**Pruebas:** `useMonitoreoTermico.test.ts` — «no descarta una lectura en vivo
que se adelante al historial» y «no duplica una lectura que llegue por SSE y
también en el historial».

### Verificado y alineado — sin cambio

- `VerificacionIntegridad`, `DetalleInconsistencia` y `EstadoCadena` del
  frontend coinciden campo a campo con `VerificacionIntegridadResponse` y
  `EstadoCadenaResponse`.
- `ReporteBPA` coincide con la respuesta de `/api/reportes/bpa`.
- El manejo del 503 de `/api/ia/modelo` («modelo no entrenado») ya era correcto
  y se distinguía de un error genérico.
- Los arreglos de SSE del backend (S-01, S-02: reconexión con espera
  exponencial) son internos al servidor. `sseClient.ts` ya reintentaba con
  ticket nuevo ante `onerror`, que es la contraparte correcta desde el cliente.
  No hizo falta ningún cambio.

## Puerta de despliegue: `connect-src` de la CSP

**Archivos:** `scripts/generar-vercel-json.mjs` (nuevo), `vercel.json`,
`package.json`

`vercel.json` declaraba `connect-src 'self' https://accounts.google.com`. Basta
para la demo, que resuelve todo en memoria con `MODO_DEMO` y no toca la red,
pero **bloquea en el navegador toda llamada a la API y la conexión `EventSource`
del SSE** en cuanto el frontend apunte al backend de Railway, que vive en otro
origen. El síntoma sería un dashboard permanentemente vacío con errores de CSP
en consola: no se parece a un fallo de red, y es el tipo de cosa que se
descubre el día del despliegue.

`vercel.json` es un fichero estático y no admite variables de entorno, así que
la directiva no puede hacerse configurable en el propio fichero. Se resuelve
generándolo:

```
npm run csp:prod -- https://mi-backend.up.railway.app   # producción
npm run csp:demo                                        # vuelve a modo demo
```

El script valida que la URL sea HTTPS (RNF-05 y `Strict-Transport-Security`),
añade el origen en las formas `https://` y `wss://` —`EventSource` usa HTTP,
pero si algún día se pasa a WebSocket la directiva ya lo contempla—, y cambia
`buildCommand` a `npm run build` cuando hay backend real. Ejecutado sin
argumento imprime un aviso explícito de que la API quedará bloqueada.

El repositorio queda en modo demo, que es su estado actual de despliegue; la
CSP generada es idéntica byte a byte a la anterior.

## Revisión página a página

### B-04 — Trazabilidad no decía *cuál* registro se alteró · Alto (RF-15)

La tarjeta de verificación mostraba «Alteración detectada» y la **posición**
del primer registro inconsistente. El backend devolvía además
`detalle_inconsistencia` con el identificador, el tipo de evento, el instante y
los dos sellos, y `registros_posteriores_afectados`; la pantalla descartaba todo
eso y solo usaba el `id` internamente para el botón de aislar.

Detectar la alteración sin poder nombrar el registro no convierte la cadena en
evidencia utilizable: es lo que RF-15 pide.

**Cambio:** bloque de detalle con identificador, evento, instante, **sello
recalculado frente a sello almacenado** —el contraste es la prueba material de
la alteración— y número de registros posteriores invalidados, que en una cadena
de hashes es lo que dimensiona el daño real. Además, la fila correspondiente
queda marcada dentro de la tabla, con un indicador que no es solo color.

**Pruebas:** 5 casos en `PantallasClave.test.tsx`, incluido que no se invente un
detalle cuando la cadena está íntegra.

### B-05 — El aviso de cadena comprometida no se anunciaba · Alto

**Criterio:** WCAG 4.1.3.

El banner de HU-47 se pintaba en rojo y nada más. Una cadena de custodia
comprometida es el equivalente documental de una excursión térmica: quien no ve
la pantalla no se enteraba de que la evidencia dejó de ser fiable.

**Cambio:** `role="alert"` en el banner y `role="status"` en el resultado de la
verificación. **Pruebas:** 2 casos.

### B-06 — Aislar un registro se ejecutaba con un solo clic · Alto

**Criterio:** WCAG 3.3.4.

Era la única acción destructiva del sistema sin confirmación: un clic excluía el
registro de la cadena verificable, de forma irreversible y auditada. Usuarios y
Dispositivos sí confirmaban.

**Cambio:** diálogo `alertdialog` (prop `destructivo` de la primera ronda) que
muestra el identificador afectado, con manejo de error propio.

**Pruebas:** 3 casos, incluido que no se llame al backend antes de confirmar y
que no se ofrezca a quien no es administrador.

### B-07 — El veredicto del modelo dependía del color · Medio

**Criterio:** WCAG 1.4.1 y 4.1.3. **Pantalla:** MetricasIA.

La lógica del umbral RNF-04 ya era correcta —la página sabía decir que el modelo
*no* cumple—, pero cumplir e incumplir usaban **el mismo icono** con distinto
tinte, y el veredicto no se anunciaba.

**Cambio:** iconos distintos (`BrainCircuit` / `ShieldAlert`), borde y fondo de
la tarjeta acordes, `role="status"`, y una frase nueva que explica la
consecuencia del incumplimiento en vez de limitarse a constatarlo: por debajo
del umbral la clasificación automática no respalda decisiones de cumplimiento y
las excursiones deben confirmarse a mano.

**Pruebas:** 6 casos, incluidos los dos límites exactos (0.85 cumple, 0.8499 no)
y que los iconos sean efectivamente distintos.

### B-08 — El campo de acción correctiva no tenía etiqueta · Medio

**Criterio:** WCAG 3.3.2. **Pantalla:** Alertas.

Corregido en la primera ronda a medias: se le puso `<Label>`, pero reutilizando
la clave `alertas.descripcionAccion`, cuyo texto era el marcador de posición
(«Describe la acción tomada…»). Ahora la etiqueta tiene clave propia
(`alertas.etiquetaAccion`) y el marcador es un ejemplo real.

**Pruebas:** 7 casos sobre el ciclo completo en `PantallasClave.test.tsx`:
registro de la acción sobre la alerta correcta, rechazo de descripción vacía y
de solo espacios, confirmación anunciada, y el permiso por rol en el botón de
marcar revisada.

### B-09 — Estados de carga, vacío y error inconsistentes · Medio

Cada pantalla los resolvía a su manera: unas con `TableEmpty`, otras con un
`<p>` suelto sin rol, Reportes sin estado vacío real. La misma situación se veía
distinta según la sección y en varios casos no se anunciaba.

**Cambio:** componente `EstadoPagina` con `EstadoCarga`, `EstadoVacio` y
`EstadoError`, todos con su rol declarado (`status` para carga y vacío, `alert`
para error) y la misma caja, para que el salto entre estados no desplace el
contenido. Aplicado en Reportes y MetricasIA; Firmware y Trazabilidad reciben
icono en su estado vacío.

### B-10 — Tablas sin nombre y fechas con locale fijo · Bajo

Quedaban sin `titulo` las tablas de Trazabilidad, Auditoría, MetricasIA y
Firmware, y con `toLocaleString('es-PE')` escrito a mano las fechas de
Trazabilidad, Auditoría, Firmware, Reportes, MetricasIA y el CSV exportado.
Corregido con los mismos mecanismos de la primera ronda (`Table titulo=`,
`lib/formato`), más `fechaCorta()` para los encabezados de periodo.

### B-11 — El hash de firmware solo estaba en `title` · Bajo

**Pantalla:** Firmware. La celda mostraba 12 caracteres y los 64 completos
vivían en un atributo `title`, que el teclado no alcanza. Cotejar un binario
—que es el control anti-manipulación de HU-46— exige el hash entero. Ahora está
como texto para lector de pantalla.

### Revisadas sin hallazgo

- **Login** y **ChecklistBPA**: ya declaraban `role="alert"` / `role="status"`
  en todos sus mensajes, tenían etiquetas asociadas y distinguían los motivos de
  error (credenciales, demasiados intentos, servidor). El `progressbar` del
  checklist era correcto. Sin cambios.
- **Guía**: contenido estático, sin estados ni formularios.
- **Auditoría**: solo necesitaba nombre de tabla y fecha localizada (B-10).

## Rendimiento

### B-12 — ECharts empaquetaba tres módulos que nadie usa

`EChartWrapper` registraba `BarChart`, `GaugeChart` y `DataZoomComponent`.
ECharts solo empaqueta lo que se declara en `echarts.use()`, así que
declararlos desactivaba su sacudida de árbol y viajaban íntegros en el trozo
`echarts` — el que se descarga justo después de iniciar sesión. La única gráfica
del sistema es la curva térmica del dashboard, de tipo `line`; las barras de
importancias de MetricasIA son `div` con CSS.

| Trozo `echarts` | Bruto | Gzip |
|---|---|---|
| Antes | 606.33 kB | 205.23 kB |
| Después | 537.58 kB | 182.27 kB |
| Diferencia | **−68.75 kB (−11.3 %)** | **−22.96 kB (−11.2 %)** |

### Rutas críticas, medidas con `npm run build`

**Siguen siendo pesos de paquete, no tiempos.**

| Ruta | Base (antes de todo) | Tras la 2.ª ronda | Diferencia |
|---|---|---|---|
| `/login` bruto | 469.94 kB | 448.03 kB | −21.91 kB |
| `/login` gzip | 153.12 kB | **144.94 kB** | **−8.18 kB (−5.3 %)** |
| `/dashboard` bruto | 1088.37 kB | 1036.55 kB | −51.82 kB |
| `/dashboard` gzip | 362.82 kB | **344.91 kB** | **−17.91 kB (−4.9 %)** |

La ruta de `/login` sube 3.89 kB brutos respecto al cierre de la primera ronda
(444.14 kB): es el coste de lo añadido en esta —`EstadoPagina`, `lib/formato`,
la clasificación de errores del reporte y las claves i18n nuevas—. Se declara
en vez de compararlo solo contra la base.

### Flujo SSE con datos sostenidos

Se ejercitó el hook con 500 lecturas consecutivas
(`useMonitoreoTermico.test.ts`, 9 casos). Queda fijado por prueba que la serie
se acota en 60 puntos, que el descarte cae por el extremo antiguo, que el orden
cronológico se mantiene, que la suscripción se abre una sola vez —no una por
repintado, que sería el efecto bola de nieve clásico del SSE— y que se cierra al
desmontar. El defecto B-03 salió de aquí.

**Lo que no se hizo, y por qué:**

- **No se perfiló el coste real de los repintados.** No se usó el Profiler de
  React ni se midió en navegador; lo que hay son garantías de comportamiento,
  no números de tiempo de render.
- **No se separó `en.json` del paquete inicial.** El inglés son 16.3 kB de los
  60.06 kB del trozo de entrada (≈27 %) y el idioma por defecto es el español,
  así que cargarlo bajo demanda es tentador. Se descartó: el ahorro real ronda
  los 4 kB gzip (≈3 % de la ruta crítica) y la carga asíncrona introduce una
  ventana en la que `changeLanguage('en')` devuelve claves sin traducir, lo que
  choca con el requisito de paridad ES/EN del proyecto. No compensa.
- **`tailwind-merge` (102 kB brutos) sigue dentro**, por el mismo motivo que en
  la primera ronda.
- **`axios` (142 kB brutos)** podría sustituirse por `fetch`, pero arrastra los
  interceptores, el adaptador del modo demo y el arnés de pruebas. Es un
  refactor de infraestructura, no una optimización.

## Verificación

Las 142 pruebas de la primera ronda siguen pasando. Se añaden 49 casos nuevos en
3 ficheros, hasta **191 en 24 ficheros**.

Tres pruebas existentes se actualizaron porque afirmaban lo que se corrigió a
propósito: `FirmwarePage` (el hash completo ahora está presente, así que el
prefijo aparece dos veces), `TrazabilidadPage` (el identificador `r-17` aparece
además de la posición) y `ReportesPage` (el módulo del hook ya no puede
simularse entero: `diasDeRango` y `validarRango` son funciones puras que
replican la validación del backend y simularlas ocultaría justo lo que se quiere
comprobar; se pasa a `importOriginal`).

También se amplió el arnés compartido `src/tests/ayudas.ts` para capturar los
parámetros de consulta de cada petición: sin ellos no se puede afirmar sobre los
filtros que el frontend envía de verdad, que es donde vive el contrato con el
backend.

```
$ npx tsc -b --noEmit
(sin salida)

$ npm run lint
(sin salida)

$ npm run test:run
 Test Files  24 passed (24)
      Tests  191 passed (191)

$ npm run build
✓ built in 1.78s

$ npm run build:demo
✓ built in 1.79s
```

Paridad de claves i18n: **350 / 350**, sin claves huérfanas en ninguno de los
dos idiomas.

## Archivos de la segunda ronda

**Nuevos:** `scripts/generar-vercel-json.mjs` ·
`src/presentation/components/EstadoPagina.tsx` ·
`src/tests/presentation/pages/PantallasClave.test.tsx` ·
`src/tests/presentation/pages/ReportesBPA.contrato.test.ts` ·
`src/tests/application/hooks/useMonitoreoTermico.test.ts`

**Modificados:** `vercel.json` · `package.json` ·
`src/application/hooks/useReportesBPA.ts` ·
`src/application/hooks/useMonitoreoTermico.ts` ·
`src/infrastructure/charts/EChartWrapper.tsx` · `src/lib/formato.ts` ·
`src/infrastructure/i18n/locales/{es,en}.json` ·
`src/presentation/pages/{Reportes,Trazabilidad,MetricasIA,Auditoria,Firmware,Alertas}Page.tsx` ·
`src/tests/ayudas.ts` ·
`src/tests/presentation/pages/{Firmware,Trazabilidad,Reportes}Page.test.tsx`

## Lo que sigue sin poder afirmarse

Igual que en la primera ronda, y sin cambios:

- **Tiempos reales de carga (RNF-10 ≤ 3 s).** No se ejecutó Lighthouse ni se
  midió en red o dispositivo reales. Todas las cifras de este documento son
  pesos de paquete.
- **Validación con lector de pantalla real** (NVDA, VoiceOver). Lo verificado es
  la estructura del árbol de accesibilidad en jsdom.
- **Puntuación SUS ≥ 70.** Requiere pasar el cuestionario a usuarios reales.
- **Integración de extremo a extremo contra el backend en ejecución.** El
  contrato se verificó leyendo los esquemas y los routers, y fijando por prueba
  lo que el cliente envía; no se levantaron ambos servicios a la vez.
- **La CSP de producción no se ha probado desplegada**, porque no se conoce el
  hostname definitivo. El script la genera y valida la URL, pero la
  comprobación de que Railway y Vercel se hablan queda pendiente del despliegue.
