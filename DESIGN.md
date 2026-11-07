# ColdCare: sistema visual del panel

## Para quién es

Lo primero, y manda sobre todo lo demás. Quien lo usa es un **químico farmacéutico o técnico de botica**: atiende en el mostrador, tiene poco tiempo, no es informático y muchas veces entra desde el celular. Abre el panel con una duda concreta, y cada pantalla debe resolverla en dos segundos:

| Su pregunta | Dónde | Lo primero que ve |
|---|---|---|
| ¿Están bien mis medicamentos? | Inicio | "Todo en orden" o qué equipo revisar, con la temperatura enorme |
| ¿Pasó algo? ¿Qué hago? | Alertas | Cuántas faltan y, al abrir una, qué hacer paso a paso |
| ¿Qué pasó anoche? | Historial | Una frase con el resumen y la gráfica |
| Me piden una constancia | Reportes | La hoja lista para descargar |

**Reglas de sencillez**

- **Una idea por pantalla.** Arriba, una frase que responde la pregunta, en palabras de botica. Debajo, como mucho una acción principal.
- **Sin jerga en la primera vista.** Fuera de la vista inicial: códigos como `FARM-01-CDL` como dato principal, hash, sello, HMAC, F1, buffer, firmware, telemetría, conjunto de prueba. Primero "Refrigerador principal", no su código. Lo técnico sigue disponible tras "Ver más": no se borra ninguna función.
- **Se conservan los términos de la profesión** que el farmacéutico ya conoce: cadena de frío, excursión, 2–8 °C, rango.
- **Menos es más.** Si un dato no ayuda a decidir ahora, va tras "Ver más". Nada de muros de etiquetas ni de cifras sin explicar.
- **Las advertencias honestas se quedan** en lenguaje simple: datos simulados, modelo sin validar.

## Dirección

El panel es el mismo producto que la landing (`../landing-page`). Quien pasa de una a otro no debe notar un cambio de marca. Hoy se ve como un administrador genérico; la meta es un instrumento propio, premium y claro. No puede parecer plantilla ni generado por IA.

Referencias de código en la landing:

- Cápsulas e isla: `src/componentes/Cabecera.tsx` y `src/lib/isla.ts`.
- Campos de color y cifras: `src/secciones/Noche.tsx` y `src/styles.css`.
- Hoja de cuaderno con letra `--pluma`: `src/componentes/Cuaderno.tsx`.
- Línea del día con anotaciones: `src/componentes/DiaDeLecturas.tsx`.
- Cadena de registros: `src/componentes/Cadena3D.tsx` y `src/secciones/Hoja.tsx`.
- Equipos dibujados: `src/componentes/Equipos.tsx`.

## Lo que el panel hereda de la landing

1. **Cápsulas negras flotantes** (`#05070c`), no un marco oscuro de lado a lado.
2. **Isla dinámica** que trabaja sola: muestra la lectura actual, avisa alertas y cambios sin saltar de posición ni de alto.
3. **Color que significa temperatura**: campos completos de cian, azul, rosado o rojo que se leen desde lejos.
4. **Tipografía grande y apretada**: títulos de 40 a 64 px en escritorio, cifras enormes y tabulares, poco texto.
5. **Materiales propios**: papel de cuaderno para lo humano, sellos encadenados para la integridad, la línea del día para el tiempo.
6. **Vida con Prompt Motion**: cifras que ruedan, cápsulas que se transforman, estados que se funden. Cada movimiento explica algo.

## Marco

- **Sin barra lateral.** Se rechazó: quita espacio y obliga a leer una lista de nombres de sistema.
- **Escritorio:** arriba, como en la landing: marca a la izquierda; al centro, **una sola cápsula negra** con palabras (Inicio, Alertas con su número, Historial, Reportes, Más); a la derecha, la lectura actual y la cuenta. Una píldora blanca se desliza hasta la pantalla activa. Si llega una alerta, la cápsula se transforma un momento para contarla y vuelve, sin cambiar de posición. El contenido usa todo el ancho sobre `#F4F7FB`.
- **Móvil:** cápsula arriba con marca, lectura y cuenta; abajo, la misma navegación al alcance del pulgar.
- **"Más"** abre un panel con el resto (Comprobar registros, Clasificador, Ayuda y, según el rol, Auditoría, Usuarios y Equipos), cada uno con una línea que dice para qué sirve.
- **Nombres:** Monitoreo pasa a "Inicio", Integridad a "Comprobar registros" y Guía de uso a "Ayuda". Las rutas no cambian.
- Toda la navegación se ve sin scroll a cualquier altura (Acta N.° 05).
- `Datos simulados` sigue en todas las pantallas con `role="status"`, pero como pieza discreta, no como franja amarilla de lado a lado.

## Tokens

- Inter Variable en toda la interfaz, con numerales tabulares. Kalam solo para lo escrito a mano.
- Azul `#0B5CFF`: acciones y datos elegidos. Cian `#00D1FF`: dentro del rango. Rosado `#FF7AA2`: marca. Rojo sólido `#D92D20`: crítico, nunca salmón. Miel: preventivo.
- Fondo `#F4F7FB`, superficies blancas, tinta `#0F172A`.
- Radios variados: controles 10, tarjetas 14, cápsulas 999.
- Tema oscuro real en todas las pantallas (`localStorage['coldcare-tema']`), revisado pantalla por pantalla.
- Sombras por capas. Sin vidrio ni blur, sin bordes laterales de color, sin rejillas de tarjetas idénticas.

## Pantallas

Cada una con una idea propia y contenido real desde el primer vistazo. Filtros en una barra compacta tipo cápsula que se abre en panel; en móvil, en una hoja inferior. Nunca un formulario de filtros antes del contenido.

- **Login:** la foto aprobada se queda: ya se reclamó una vez cuando se quitó. Tipografía de la landing y acceso de demostración en cápsulas.
- **Monitoreo:** campos de color enormes por equipo, cifra gigante y vial 3D. Debajo, la línea del día con anotaciones, sin cajitas de sobra. En móvil, cada campo llena casi la pantalla.
- **Alertas:** bandeja de dos paneles. Cada aviso muestra su temperatura grande; el detalle y los pasos van al elegirlo. En móvil, detalle en hoja inferior.
- **Historial:** la gráfica es la protagonista. Lecturas agrupadas por día, con cifras grandes.
- **Integridad:** sellos encadenados como en "Cambia un dato" de la landing, con el veredicto en un campo de color.
- **Reportes:** vista previa como una hoja de papel real.
- **Clasificador:** la cifra grande junto a su advertencia honesta, variables legibles y matriz clara.
- **Auditoría:** línea de tiempo por día, filtrable, con el resultado a la vista.
- **Usuarios:** personas con rol y estado; indicadores en una línea, no en cuatro tarjetas; permisos en su propia vista.
- **Equipos:** cada equipo como pieza con su estado en color y su ficha al abrirlo.
- **Guía:** pasos grandes con animaciones que muestran lo que explican.

Sin huecos raros: una tabla corta se ajusta a su contenido y lo útil llena el resto. Toda pantalla tiene estados de carga, vacío y error cuidados.

## Gráficas

La curva térmica se ve como la línea del día de la landing: una línea limpia sobre un velo de 2–8 °C, filetes verticales apenas visibles y anotaciones solo donde dicen algo.

**Cómo usarla.** Es la misma API de siempre; ninguna pantalla tiene que cambiar:

```tsx
const tema = useTemaResuelto()
const opcion = useMemo(
  () => construirOpcionCurvaTermica(serie, etiquetas, ventana, tema), // `ventana` solo en vivo: { desde, hasta }
  [serie, etiquetas, ventana, tema],
)
<EChartWrapper option={opcion} height="clamp(220px, 32dvh, 320px)" ariaLabel={...} ariaDescribedBy="id-de-la-tabla" />
```

- `serie` en orden cronológico. Con dos o más `device_id`, una línea por equipo con color fijo por nombre.
- `opcion` siempre en `useMemo`: el mismo objeto no repinta nada, y la opción devuelve el mismo objeto mientras la ventana se mueva menos de un píxel.
- `height` admite cualquier longitud CSS. El alto se reserva antes de cargar: no hay salto.
- `ariaLabel` es obligatorio. Las cifras siguen en una tabla cercana (`ariaDescribedBy`).

**Qué dibuja.** Línea de 2 px (1,5 px con más de tres días), azul en claro y cian en oscuro; roja solo donde sale de 2–8 °C. La última lectura lleva su punto y su cifra (con `ventana`). Cada excursión confirmada lleva un punto rojo y una franja; hasta dos rótulos con su hora, si no se pisan. Los huecos se cortan y se sombrean. Tooltip con hora de 24 h, números tabulares y el valor en rojo si está fuera de rango.

**Cómo se carga.** Solo `graficaViva.ts` pide `motorEcharts.ts`, y lo hace cuando el contenedor está por verse. Hay una instancia por componente durante toda su vida; cada lectura la actualiza en un momento libre. Fuera de pantalla o con la pestaña oculta no se repinta. Sin animaciones: aparece con un fundido del contenedor.

**Reglas.**
- Nadie más importa `echarts/*`, salvo `import type`. Un tipo de gráfica nuevo se registra en `motorEcharts.ts`; si falta, ECharts no dibuja y no avisa.
- Sin `lineStyle.color` en la serie de temperatura: anularía el rojo de `visualMap`. El color va en `itemStyle.color`.
- Sin `replaceMerge` si la opción lleva `media`: ECharts borra las series.
- Lo que va sobre otra superficie (`pages/reportes/curvaSobrePapel.ts`) cambia los colores de la opción; el fondo de la gráfica es transparente.
- Para sumar notas sin tocar la curva (`pages/monitoreo/anotaciones.ts`), una serie vacía más cuyo nombre empiece por `__`: el tooltip las ignora.
- Nada de `backdrop-filter`, sombras de canvas ni `filter` sobre la gráfica.

**Niveles.** `@/lib/rendimiento` da `rendimiento.nivel` (`alto`, `medio`, `bajo`), `segunNivel(alto, medio, bajo)`, `rendimiento.sinAceleracion` y `ritmoQuieto()`. Es la escala de la landing. La detección corre la primera vez que alguien pregunta y baja sola si los cuadros no alcanzan. En `bajo`, la gráfica pinta a 1,25× y el vial pierde antialias y vaivén: se dibuja solo cuando cambia la lectura. Sin WebGL o dibujando por CPU, three ni se descarga.

## Movimiento

Referencia, Prompt Motion (Product UI, `prompt-motion.com/?tag=product-ui`): una cápsula negra que se transforma, sobre un lienzo tranquilo, con una cosa a la vez. Inspiración, nunca copia.

- **La pieza se transforma, no se reemplaza:** la píldora se desliza, una fila de alerta crece hasta ser su detalle, un botón pasa a mostrar su resultado (`layoutId`, resortes sin rebote exagerado).
- Cifras que ruedan al cambiar. Respuesta al tocar: escala 0.98 al presionar.
- Sin animación de entrada de la aplicación. Transiciones de pantalla cortas, de 200 ms o menos.
- Solo `transform` y `opacity`. Sin `filter: blur`. Con CSS siempre que se pueda, sin trabajo por cuadro.
- Respeta `prefers-reduced-motion`.

## Rendimiento

Fluido en iPhone, Android, Mac y PC modesta. El vial 3D se dibuja solo cuando hace falta y se pausa fuera de pantalla. Las gráficas se cargan al necesitarlas. Nada se redibuja sin motivo. La pantalla funciona igual si el 3D nunca carga.

## Responsive

Revisar a 320, 390, 402, 768, 844 en horizontal, 1024, 1366 y 1920. Sin desborde horizontal, botones de al menos 40 px en táctil y sin texto cortado.

## Límites

- No cambia ninguna función, permiso ni regla: es diseño.
- Roles y rutas salen de `layouts/navegacion.ts`. Se conservan `nav` con nombre "Navegación principal", el salto al contenido y los nombres accesibles.
- Todo texto va en `es.json` y `en.json`: una prueba exige ambas claves.
- Nunca presentar datos simulados, el modelo en sombra ni pruebas sin ejecutar como resultados medidos. Las advertencias se quedan.
- Sin logos de marca ni texto de relleno.

## Componentes

Todo sale de `src/presentation/components/`. Cada archivo se importa directo, sin barril, para que una pantalla no arrastre lo que no usa. Una pantalla nueva no define botones, tablas ni filtros propios: usa estos.

### Marco y navegación

Viven en `src/presentation/layouts/` y en `AppLayout`: ninguna pantalla los monta.

| Pieza | Archivo | Ejemplo |
| --- | --- | --- |
| `navegacionDe(rol)`: lo que un rol ve en la cápsula (`principales`) y en «Más» (`mas`), leído de `SECCIONES`. Una pantalla nueva se añade ahí con `roles`, `claveI18n`, `claveDetalle` (su línea en «Más») y `enCapsula` si va directa | `layouts/navegacion` | `const { principales, mas } = navegacionDe('tecnico')` |
| `NavPrincipal`: palabras, número de Alertas y píldora blanca con `layoutId`. `posicion="arriba"` desde 768 px, dentro de la cápsula central, con «Más» en panel; `"abajo"` en el teléfono, con «Más» en `HojaInferior` | `layouts/NavegacionCapsula` | `<NavPrincipal posicion="abajo" alertas={resumen.alertas} masAbierto={a} alCambiarMas={setA} />` |
| `IslaDinamica`: la cápsula central. En calma muestra a su hijo; con un aviso se abre y vuelve. `retenida` la hace esperar | `notificaciones/IslaDinamica` | `<IslaDinamica resumen={r} verAlertas retenida={masAbierto}>{nav}</IslaDinamica>` |
| `LecturaActual`: punto de color, cifra y nombre del equipo; abre el estado de todos | `notificaciones/IslaDinamica` | `<LecturaActual resumen={r} verAlertas align="end" />` |

- Arriba, desde 768 px: marca, cápsula central y, a la derecha, lectura y cuenta (tema e idioma van en la cuenta). En el teléfono: marca, lectura al centro y cuenta; la navegación, abajo.
- La píldora sale al tocar, sin esperar a que cargue la pantalla; `aria-current` dice dónde se está de verdad.
- La palabra activa cambia a tinta con dos capas que se cruzan en opacidad (`cinta__palabra`): nunca se anima `color`.
- `Datos simulados` (`aviso-simulado`, `role="status"`) va junto a la marca desde 1180 px; por debajo, abajo a la izquierda, sobre la navegación, con su hueco reservado al final de la página.

### Controles

| Pieza | Archivo | Ejemplo |
| --- | --- | --- |
| `Button`: `variant` primary, secondary, ghost, danger; `size` sm, md, lg, icono; `cargando` | `ui/button` | `<Button variant="secondary" cargando={guardando}>Guardar</Button>` |
| `Input`, `Textarea`, `NativeSelect`, `Label`: controles sueltos | `ui/input` | `<Input id="correo" aria-invalid={conError} />` |
| `Campo`: etiqueta, control y ayuda o error | `ui/input` | `<Campo etiqueta="Correo" htmlFor="correo" error={error}><Input id="correo" /></Campo>` |
| `Segmentado`: una opción entre pocas | `ui/segmentado` | `<Segmentado etiqueta="Rango" valor={r} onCambiar={setR} opciones={[{ valor: 1, etiqueta: '1 h' }]} />` |
| `SelectorFecha`: fecha, y hora con `conHora`. El campo lee y escribe sin librerías; el calendario (`ui/calendario-fecha`, ~23 KB gzip) se descarga al acercar el puntero o el foco a su botón | `ui/selector-fecha` | `<SelectorFecha id="desde" valor={desde} onCambiar={setDesde} conHora />` |
| `Menu`, `MenuTrigger`, `MenuContent`, `MenuItem`: `tono="noche"` para lo negro | `ui/menu` | `<Menu><MenuTrigger asChild><Button>Más</Button></MenuTrigger><MenuContent><MenuItem onSelect={f}>Editar</MenuItem></MenuContent></Menu>` |
| `ActionMenu`: opciones de una fila de tabla | `ActionMenu` | `<ActionMenu label={nombre}><Button onClick={f}>Editar</Button></ActionMenu>` |
| `Tooltip`: nombre al señalar; no sustituye al nombre accesible | `ui/tooltip` | `<Tooltip contenido="Reportes"><a href="/reportes"><Icono /></a></Tooltip>` |

### Filtros, diálogos y hojas

| Pieza | Archivo | Ejemplo |
| --- | --- | --- |
| `BarraFiltros`: cápsula con chips que se abre en panel; en móvil, en hoja inferior | `ui/barra-filtros` | `<BarraFiltros activos={[{ id: 'e', etiqueta: 'FARM-01', onQuitar: f }]} onLimpiar={g}><Campo …/></BarraFiltros>` |
| `HojaInferior`: diálogo que sube desde abajo y se cierra arrastrando; `pie` fijo, `tono="noche"` | `ui/hoja-inferior` | `<HojaInferior abierta={a} onCambiar={setA} titulo="Detalle" pie={<Button>Listo</Button>}>…</HojaInferior>` |
| `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription`: modal, abajo en móvil; `destructivo` para confirmar | `ui/dialog` | `<Dialog open={a} onOpenChange={setA}><DialogContent destructivo><DialogTitle>Dar de baja</DialogTitle></DialogContent></Dialog>` |

### Pantalla y datos

| Pieza | Archivo | Ejemplo |
| --- | --- | --- |
| `TituloPagina` (o `PageHeader`, su nombre heredado): título de 36 a 64 px con acciones al lado | `ui/titulo-pagina` | `<TituloPagina titulo="Historial"><Button>Exportar</Button></TituloPagina>` |
| `Indicadores`, `Indicador`: cifras en línea, sin tarjetas; `tono`, `unidad`, `detalle`, `grande` | `ui/indicadores` | `<Indicadores><Indicador etiqueta="Fuera de rango" valor={2} tono="critico" /></Indicadores>` |
| `Table` y sus partes: `titulo` obligatorio en la práctica, `mobileLayout="stack"`, `llenar`, `numero` en cabecera y celda | `ui/table` | `<Table titulo="Lecturas" mobileLayout="stack"><TableBody><TableRow><TableCell numero data-label="Temp.">4.7 °C</TableCell></TableRow></TableBody></Table>` |
| `Badge`: `variant` neutral, ok, warn, critical, info, outline; `dot` | `ui/badge` | `<Badge variant="warn" dot>Riesgo preventivo</Badge>` |
| `RiskBadge`, `BadgeConectividad`: insignias de dominio ya resueltas | `RiskBadge`, `BadgeConectividad` | `<RiskBadge nivel={lectura.riesgo_efectivo} />` |
| `Panel`, `Card`: sección con título, y superficie suelta; úsalas poco | `ui/panel`, `ui/card` | `<Panel titulo="Incidentes" acciones={<Button />}>…</Panel>` |
| `Detalles`: información secundaria plegada | `ui/detalles` | `<Detalles titulo="Ver más">…</Detalles>` |
| `NumeroAnimado`: cifra que rueda dígito a dígito | `ui/numero-animado` | `<NumeroAnimado valor={t.toFixed(1)} />` |
| `Paginacion`: páginas de una lista larga | `Paginacion` | `<Paginacion total={n} pagina={p} onCambiar={setP} />` |

### Estados

| Pieza | Archivo | Ejemplo |
| --- | --- | --- |
| `EstadoCarga`: línea, o esqueleto con `variant` tabla o dashboard | `EstadoPagina` | `<EstadoCarga variant="tabla" />` |
| `EstadoVacio`: qué falta y qué hacer; `llenar` ocupa el alto libre | `EstadoPagina` | `<EstadoVacio icono={Inbox} titulo="Sin lecturas" detalle="Prueba otras fechas" />` |
| `EstadoError`: el mensaje y `onReintentar` | `EstadoPagina` | `<EstadoError mensaje={texto} onReintentar={reintentar} />` |

### Isla dinámica

La cápsula central trabaja sola con las lecturas y las alertas (`useResumenIsla`, una vez, en la cabecera). Cuando llega un aviso se abre unos segundos para contarlo, con el nombre del equipo y no su código, y vuelve a las palabras sin cambiar de sitio ni de alto. Lo crítico se adelanta. No se recoge mientras alguien lo lee (puntero que se mueve o foco); espera si el foco de teclado está en la navegación o «Más» está abierto, y el tabulador la recoge al instante, así el foco nunca queda tapado. Arriba lleva una × para volver ya; en el teléfono no tapa la navegación y el detalle usa dos líneas. Todo queda en su panel.

Para contar algo más desde cualquier sitio, se publica un aviso:

```ts
notificarNotch('aviso', { id: 'x', titulo: 'Aviso', detalle: 'FARM-01 cambió de red.', duracion: 15_000 }) // notificaciones/notificarNotch
```

### Clases y tokens

- `tema-capsula`: redefine los tokens para lo negro; todo control compartido se adapta dentro.
- `capsula`: forma y negro de la cápsula. `capsula-clara`: cápsula sobre superficie, como los chips de filtros.
- `realce`: hover y pulsación con una capa de opacidad. Un `hover` de color se aplica sin transición.
- `FormaCapsula` (`ui/forma-capsula`): fondo negro que cambia de ancho animando solo `transform`.
- `cinta`, `cinta__enlace` con `data-activo`, `cinta__pildora`, `cinta__numero`: la navegación. `panel-mas` y `mas-fila`: «Más».
- Campos de temperatura: `bg-campo-rango`, `bg-campo-frio`, `bg-campo-cerca`, `bg-campo-preventivo`, `bg-campo-critico`, `bg-campo-sin-datos`, cada uno con su `text-campo-…-tinta`.
- Materiales: `bg-papel`, `border-renglon`, `text-pluma` y `font-pluma`. Kalam no está instalada en el panel: quien la necesite debe añadir `@fontsource/kalam`, como la landing; hasta entonces cae en `Bradley Hand` o la cursiva del sistema.
- Radios: `rounded-(--radius-field)` 10, `rounded-(--radius-card)` 14, `rounded-(--radius-capsula)` 999. Sombras: `shadow-(--shadow-card)`, `--shadow-raised`, `--shadow-lift`, `--shadow-capsula`.
