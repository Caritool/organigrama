# Hoja de constraints — Organigrama de La Brújula

> Estado: **aprobado** (3 oct 2026). Es el contrato: toda pantalla hereda de aquí y nada se re-decide por pantalla.
> Pendiente, a cargo del equipo de diseño de La Brújula: la fuente de la marca (token `--f-marca`, hoy Figtree). Probador en `/fuente`.

## Programa

- **Pantalla:** organigrama público de una sola vista, más `/admin`, que redirige al Excel.
- **Usuarios:** integrantes de La Brújula (17 hoy, ~30 a corto plazo) que lo abren desde un link en WhatsApp, en el celular. Quien administra edita en el Excel desde un computador.
- **Trabajo:** responder «¿quién lleva qué y con quién hablo?» y llevar a la persona a WhatsApp.

## Parti

> El grupo es una ronda; buscar a alguien es girar la ronda hasta que quede bajo la aguja.

- Arriba (bajo la aguja) es la posición de **foco**, no de rango: la ocupa quien estás mirando.
- Al llegar, la aguja apunta a un **hueco entre equipos** elegido al azar. Nadie está arriba por defecto.
- La búsqueda es una lente sobre la ronda: ilumina a quien coincide y atenúa a los demás, y elegir a alguien gira la ronda.

## La restricción deliberada

**Sin árbol: nadie queda por encima.** Ajustada en la v2: quien representa **pesa más, pero nunca está más arriba**.

- Hay dos tamaños de asiento: integrante y representante. El de representante es un paso más grande (×1.35) y lo tienen la Dirección y quienes lideran por igual. Un tercer tamaño empezaría a dibujar un árbol.
- Quien representa va **en el centro de su arco**, en medio de su equipo. El resto va en orden alfabético a sus lados.
- El peso es **por asiento**, no por persona: alguien que lidera un departamento y participa en otro es grande en el primero y normal en el segundo.
- Nunca se usa posición vertical, color ni peso tipográfico para marcar responsabilidad. Arriba es solo la posición de foco.
- Dirección es un arco más. Los arcos se distinguen por el espacio entre ellos y su etiqueta, no por color.

## Módulo

- Base de **8px**, con medio paso de 4px. Tokens: `--s-1` 4 · `--s-2` 8 · `--s-3` 16 · `--s-4` 24 · `--s-5` 32 · `--s-6` 48 · `--s-7` 64.
- Área táctil mínima de 48px en controles. En la ronda densa (30 personas) los asientos bajan a ~22px y cumplen por espaciado (WCAG 2.2, 2.5.8).

## Tipo

- **Figtree** para todo el texto, con dos pesos: **400 / 700**.
- **Marca:** la palabra «La Brújula» usa `--f-marca`, la fuente más parecida a la del logo. Está pendiente y hoy cae en Figtree. No se recorta el logo, porque no hay versión en HD ni vectorial.
- Escala 1.25 redondeada al módulo, seis tamaños: `13 · 16 · 20 · 24 · 32 · 40`.
- Etiquetas en mayúsculas a 13px con +0.06em de tracking. El texto corrido no lleva tracking.
- Interlineado: 1.5 para cuerpo, 1.2 para títulos.

## Color

**Un solo tema: bosque (oscuro).** El modo claro del mockup no convenció al grupo y el oscuro sí. `color-scheme: dark`. Los componentes usan solo tokens semánticos, así que un tema claro rediseñado sería un bloque más en `css/styles.css`, sin tocar componentes.

Una sola familia, la verde de la marca. Neutros teñidos hacia H 175.

| Rol | Valor | Referencia de marca |
|---|---|---|
| Fondo | `oklch(0.32 0.04 172)` | bosque ≈ `#17382F` |
| Texto | `oklch(0.985 0.005 175)` | |
| Texto secundario | `oklch(0.82 0.016 175)` | |
| Asiento | `oklch(0.42 0.045 172)` | |
| Acento | `oklch(0.72 0.12 180)` | turquesa ≈ `#22B5A5` |

- **El acento significa una sola cosa: coincide o puedes actuar.** Se usa en los asientos que coinciden, en la aguja con foco, en el borde del buscador con foco y en el botón de WhatsApp.
- La salvia (`#5BA67A`) queda fuera: es un segundo tono.
- Las referencias en hex son solo para cotejar con la marca. El código usa únicamente tokens `oklch`. La única excepción es `theme-color` en el `<head>`, que no admite `oklch` en todos los navegadores.

## Radio y borde

- **Solo la ronda es redonda.** Todo lo demás (buscador, botón, ficha) lleva esquinas rectas (`border-radius: 0`).
- Se agrupa por proximidad. El único borde permitido es el límite de un control (el buscador), por contraste 3:1.

## Movimiento

- Escala: `120 · 200 · 320ms`, `ease-out` al entrar.
- Única excepción: **el giro de la ronda, 480ms**. Media vuelta en 320ms se siente como un salto.
- Con `prefers-reduced-motion: reduce` la ronda no gira, salta.

## Datos (contrato con el Excel)

- Fuente de verdad: el Excel de La Brújula en SharePoint. Columnas por hoja: `NOMBRE COMPLETO · CORREO · CÉDULA · No. CELULAR · USUARIO DE REDES · PROGRAMA · CARGO`.
- Un Office Script **Publicar**, lanzado desde un botón en el Excel, valida las hojas y sube `data/organigrama.json` al repo, que es **público**.
- **Acceso:** la página pide una contraseña (ventana modal) y `data/organigrama.json` se publica **cifrado** (AES-256-GCM, clave PBKDF2). Es lo único que protege los celulares, porque el repo es público. La contraseña vive en la hoja `Configuración`, celda B3, junto al token. Publicar nunca sube datos sin cifrar.
- **Lista blanca de salida:** nombre, cargo, departamento y celular. La cédula, el correo, las redes y el programa nunca salen del Excel.
- Identidad de una persona = **correo UTadeo normalizado**, porque un celular puede faltar o cambiar. Se lee y no se publica. El id público es un número de orden.
- Si el mismo correo aparece en dos hojas, es una persona con dos membresías. Esto ya pasa hoy.
- **Los departamentos son las hojas «Depto de …».** Toda hoja cuyo nombre empieza por «Depto de» o «Departamento de» es un departamento, en el orden de las pestañas, y el resto del nombre es su nombre («Depto de mesa de redacción» → «Mesa de redacción»). De `Organigrama general` solo sale la Dirección: las filas cuyo cargo dice directora o codirectora. Cualquier otra hoja se ignora (`Integrantes General`, `Miembros antiguos`, `Publicar`). Copiar una hoja «Depto de …» crea un departamento y borrarla lo quita, sin tocar el script. Hoy son 4. La ronda reparte los arcos entre los que haya. Las copias (`Integrantes General`) se quedan en el Excel por decisión del grupo: pueden desincronizarse, pero eso no llega a la página.
- Quién lidera sale del cargo: empieza por «Líder».
- Solo hay integrantes mayores de edad (regla del grupo). Un documento TI no cambia nada en la publicación.
- **La consistencia se maneja con avisos, no con bloqueos** (decisión del grupo). Avisan y publican igual: un departamento con cero o dos líderes, una persona sin celular válido, un departamento nuevo. Riesgo aceptado: un error de liderazgo llega a la página. La ronda lo resiste mostrando los dos asientos grandes.
- Único bloqueo: que falte una columna esperada en una hoja «Depto de …» o en `Organigrama general`, porque eso publicaría a todo el departamento sin nombre o sin WhatsApp.
