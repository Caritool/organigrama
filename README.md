# Organigrama de La Brújula

Una ronda, no un árbol. Cada persona es un asiento; quien representa tiene un
asiento más grande en el centro de su departamento, y nadie queda arriba: arriba
es solo la posición de quien estás buscando. Tocar a alguien abre su ficha con un
botón para escribirle por WhatsApp.

- Sitio: <https://caritool.github.io/organigrama/>
- Edición: <https://caritool.github.io/organigrama/admin/> redirige al Excel (solo en computador)
- Contrato de diseño y de datos: [`design/constraints.md`](design/constraints.md)

## Cómo funciona

```
Excel de La Brújula (SharePoint)
  └─ botón Publicar (Office Script excel/publicar.ts)
       ├─ lee las hojas, valida y filtra
       └─ sube data/organigrama.json a este repo
            └─ GitHub Pages lo sirve → la página lo dibuja
```

El Excel es la única fuente de verdad. Nadie edita `data/organigrama.json` a mano:
lo escribe Publicar.

**El repo es público.** Publicar solo sube nombre, cargo, departamento y celular.
La cédula, el correo, las redes y el programa nunca salen del Excel.

## Reglas del Excel

- **Departamento = hoja cuyo nombre empieza por «Depto de»** (o «Departamento de»),
  en el orden de las pestañas. El resto del nombre es el nombre del departamento:
  «Depto de mesa de redacción» se publica como «Mesa de redacción». Para crear un
  departamento, copia una hoja «Depto de …»; para quitarlo, bórrala o quítale el prefijo.
- **`Organigrama general`**: de aquí solo sale la Dirección, es decir, las filas cuyo cargo dice
  directora o codirectora.
- **Cualquier otra hoja se ignora**: `Integrantes General`, `Miembros antiguos`, `Publicar`
  (donde vive el botón y aparece el resultado).
- Columnas que lee: `NOMBRE COMPLETO` (o `NOMBRE`), `CORREO`, `No. CELULAR` y `CARGO`. El resto
  (`CÉDULA`, `USUARIO DE REDES`, `PROGRAMA`) nunca se lee para publicar.
- **Lidera** quien tenga un CARGO que empiece por «Líder».
- A cada persona la identifica su **correo**: si alguien aparece en dos hojas con el
  mismo correo, es una sola persona en dos departamentos.
- Publicar **avisa, no bloquea**: un departamento sin líder o con dos, alguien sin
  celular, un departamento nuevo. Solo se niega a publicar si a una hoja «Depto de …» o a
  `Organigrama general` le falta una columna; en ese caso el organigrama sigue con la última
  versión buena.

## Puesta en marcha (una sola vez)

1. **Token de GitHub** (desde la cuenta Caritool): *Settings → Developer settings →
   Fine-grained tokens → Generate new token*.
   - Repository access: *Only select repositories* → `organigrama`.
   - Permissions → Repository → *Contents: Read and write*. Nada más.
   - Expiration: un año. Cuando venza, Publicar dirá «el token no es válido o ya venció».
2. **Script en el Excel** (Excel para la web): *Automatizar → Nuevo script*, pega el
   contenido de [`excel/publicar.ts`](excel/publicar.ts), reemplaza `PEGAR_AQUI_EL_TOKEN`
   por el token y guárdalo como **Publicar**.
3. **Botón**: ejecuta el script una vez; crea la hoja `Publicar` y escribe el resultado desde
   la celda A3. Ve a esa hoja y, en el panel del script, *… → Agregar en el libro*: aparece el
   botón y el script queda compartido con quien edite el Excel.
4. **GitHub Pages**: *Settings → Pages → Deploy from a branch → `main` / root*.

El token queda escrito dentro del script: cualquiera con permiso de edición del Excel
puede verlo. Esas mismas personas ya controlan los datos, y el token solo puede tocar
este repo.

## Desarrollo local

Sitio estático, sin build. Sírvelo desde la raíz del repo:

```bash
npx --yes serve .
```

Para verlo con datos reales sin publicarlos, corre el núcleo de Publicar sobre una
copia local del Excel. Escribe `data/local.json`, que git ignora, y la página lo
carga con `?local`:

```bash
node tools/publicar-local.mjs "ruta/al/libro.xlsx"
# luego abre http://localhost:3000/?local
```

Necesita Node 22.6+ (importa el `.ts` con type stripping) y `uv` para leer el `.xlsx`.
Nunca subas un `.xlsx` al repo: `.gitignore` los bloquea porque tienen cédulas.
