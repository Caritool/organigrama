/**
 * Publicar — Office Script del Excel de La Brújula.
 *
 * Lee las hojas del libro, arma el organigrama y lo sube a
 * github.com/Caritool/organigrama como data/organigrama.json. GitHub Pages lo
 * sirve y la página lo dibuja.
 *
 * El repo es público, así que solo salen nombre, cargo, departamento y celular.
 * Cédula, correo, redes y programa nunca salen del Excel; el correo se lee
 * únicamente para saber quién es quién.
 *
 * Reglas (design/constraints.md § Datos):
 * - Es departamento toda hoja cuyo nombre empiece por «Depto de» o
 *   «Departamento de», en el orden de las pestañas; el resto del nombre es el
 *   nombre del departamento. De «Organigrama general» solo sale la Dirección.
 *   Cualquier otra hoja (Integrantes General, Miembros antiguos…) se ignora.
 * - Lidera quien tenga un CARGO que empiece por «Líder».
 * - La consistencia se maneja con avisos: solo bloquea que a una hoja le falte
 *   una columna, porque eso publicaría un departamento entero sin datos.
 *
 * El resultado se escribe en la hoja "Publicar", donde vive el botón.
 */

// Token fine-grained de la cuenta Caritool: solo el repo organigrama, permiso
// Contents de lectura y escritura. Quien tenga edición del Excel puede verlo.
const TOKEN = "PEGAR_AQUI_EL_TOKEN";
const REPO = "Caritool/organigrama";
const RAMA = "main";
const RUTA = "data/organigrama.json";

const HOJA_ESTADO = "Publicar";
const HOJA_DIRECCION = "Organigrama general";
// El prefijo es la declaración explícita: copiar una hoja «Depto de …» crea un
// departamento y quitarle el prefijo lo saca, sin tocar este script.
const PREFIJO_DEPARTAMENTO = /^(depto\.?|departamento)\s+(de(l)?\s+)?/i;

type Celda = string | number | boolean;

interface HojaCruda {
  nombre: string;
  valores: Celda[][];
}

interface Grupo {
  id: string;
  nombre: string;
}

interface Persona {
  id: number;
  nombre: string;
  celular?: string;
}

interface Membresia {
  persona: number;
  grupo: string;
  cargo: string;
  lidera: boolean;
}

interface Organigrama {
  version: number;
  publicadoEn: string | null;
  grupos: Grupo[];
  personas: Persona[];
  membresias: Membresia[];
}

interface Resultado {
  datos: Organigrama;
  avisos: string[];
  errores: string[];
}

interface Fila {
  hoja: string;
  numero: number;
  nombre: string;
  correo: string;
  celular: string;
  cargo: string;
}

interface Columnas {
  encabezado: number;
  nombre: number;
  correo: number;
  celular: number;
  cargo: number;
}

// ---------------------------------------------------------------------------
// Núcleo puro: hojas → organigrama. Sin Excel ni red, para poder probarlo fuera.
// ---------------------------------------------------------------------------

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function aTexto(celda: Celda | undefined): string {
  if (celda === undefined || celda === null) return "";
  return String(celda).trim();
}

function limpiarNombre(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

// "Correctora de estilo\nEscritora" → "Correctora de estilo. Escritora"
function limpiarCargo(texto: string): string {
  const lineas = texto.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(l => l.length > 0);
  return lineas.map((l, i) => (i < lineas.length - 1 && !/[.,;:!?]$/.test(l) ? l + "." : l)).join(" ");
}

// Celular colombiano → "57XXXXXXXXXX", o "" si no hay uno válido.
function limpiarCelular(texto: string): string {
  const digitos = texto.replace(/\D/g, "");
  if (digitos.length === 10 && digitos.startsWith("3")) return "57" + digitos;
  if (digitos.length === 12 && digitos.startsWith("573")) return digitos;
  return "";
}

function slug(texto: string): string {
  return normalizar(texto).replace(/ /g, "-");
}

const ALIAS: { [campo: string]: string[] } = {
  nombre: ["nombre completo", "nombre", "nombres"],
  correo: ["correo", "correo institucional", "email"],
  celular: ["no celular", "celular", "numero de celular", "no de celular", "telefono"],
  cargo: ["cargo"],
};

function ubicarColumnas(valores: Celda[][]): Columnas | null {
  // El encabezado es la primera fila (entre las cinco primeras) que tiene NOMBRE.
  for (let f = 0; f < Math.min(5, valores.length); f++) {
    const encabezados = valores[f].map(c => normalizar(aTexto(c)));
    const buscar = (campo: string) => encabezados.findIndex(e => ALIAS[campo].indexOf(e) >= 0);
    const nombre = buscar("nombre");
    if (nombre >= 0) {
      return { encabezado: f, nombre, correo: buscar("correo"), celular: buscar("celular"), cargo: buscar("cargo") };
    }
  }
  return null;
}

function leerFilas(hoja: HojaCruda, columnas: Columnas, avisos: string[]): Fila[] {
  const filas: Fila[] = [];
  for (let f = columnas.encabezado + 1; f < hoja.valores.length; f++) {
    const fila = hoja.valores[f];
    const nombre = limpiarNombre(aTexto(fila[columnas.nombre]));
    const correo = aTexto(fila[columnas.correo]).toLowerCase();
    if (!nombre && !correo) continue;
    const numero = f + 1;
    if (!nombre) {
      avisos.push(`La fila ${numero} de «${hoja.nombre}» no tiene nombre; no se publicó.`);
      continue;
    }
    filas.push({
      hoja: hoja.nombre,
      numero,
      nombre,
      correo,
      celular: aTexto(fila[columnas.celular]),
      cargo: limpiarCargo(aTexto(fila[columnas.cargo])),
    });
  }
  return filas;
}

// "Depto de mesa de redacción" → "Mesa de redacción"; null si no es departamento.
function nombreDepartamento(nombreHoja: string): string | null {
  const resto = nombreHoja.replace(PREFIJO_DEPARTAMENTO, "").trim();
  if (resto === nombreHoja || !resto) return null;
  return resto[0].toLocaleUpperCase("es") + resto.slice(1);
}

const esLider = (cargo: string) => normalizar(cargo).startsWith("lider");
const esDireccion = (cargo: string) => /\b(co)?direct(ora|or)\b/.test(normalizar(cargo));

function listarNombres(nombres: string[]): string {
  return nombres.length <= 1 ? nombres.join("") : nombres.slice(0, -1).join(", ") + " y " + nombres[nombres.length - 1];
}

function construirOrganigrama(hojas: HojaCruda[], anterior: Organigrama | null, ahora: string): Resultado {
  const avisos: string[] = [];
  const errores: string[] = [];
  // 1. Qué hojas cuentan y con qué filas.
  const secciones: { grupo: Grupo; filas: Fila[] }[] = [];
  let direccion: Fila[] = [];
  let hayHojaDireccion = false;
  for (const hoja of hojas) {
    const nombreHoja = hoja.nombre.trim();
    const esHojaDireccion = normalizar(nombreHoja) === normalizar(HOJA_DIRECCION);
    const departamento = nombreDepartamento(nombreHoja);
    if (!esHojaDireccion && !departamento) continue;
    const columnas = ubicarColumnas(hoja.valores);
    if (!columnas) {
      errores.push(`La hoja «${nombreHoja}» no tiene la columna «NOMBRE COMPLETO». Revisa el encabezado y vuelve a publicar.`);
      continue;
    }
    const faltan = (["correo", "celular", "cargo"] as const)
      .filter(c => columnas[c] < 0)
      .map(c => ({ correo: "CORREO", celular: "No. CELULAR", cargo: "CARGO" })[c]);
    if (faltan.length) {
      errores.push(`La hoja «${nombreHoja}» no tiene ${faltan.length === 1 ? "la columna" : "las columnas"} ${listarNombres(faltan.map(f => `«${f}»`))}. Revisa el encabezado y vuelve a publicar.`);
      continue;
    }
    const filas = leerFilas(hoja, columnas, avisos);
    if (esHojaDireccion) {
      hayHojaDireccion = true;
      direccion = filas.filter(f => esDireccion(f.cargo));
      continue;
    }
    if (!filas.length) {
      avisos.push(`La hoja «${nombreHoja}» no tiene integrantes; no se publicó.`);
      continue;
    }
    const nombre = departamento as string;
    secciones.push({ grupo: { id: slug(nombre), nombre }, filas });
  }
  if (!hayHojaDireccion) avisos.push(`No hay hoja «${HOJA_DIRECCION}»: la Dirección queda vacía.`);
  else if (!direccion.length) avisos.push(`En «${HOJA_DIRECCION}» ningún cargo dice directora o codirectora: la Dirección queda vacía.`);
  if (direccion.length) secciones.unshift({ grupo: { id: "direccion", nombre: "Dirección" }, filas: direccion });

  // 2. Personas (por correo) y membresías.
  const personas: Persona[] = [];
  const porClave: { [clave: string]: Persona } = {};
  const membresias: Membresia[] = [];
  for (const { grupo, filas } of secciones) {
    const vistas: { [id: number]: boolean } = {};
    for (const fila of filas) {
      if (!fila.correo) avisos.push(`${fila.nombre} («${fila.hoja}», fila ${fila.numero}) no tiene correo; se identifica por el nombre.`);
      const clave = fila.correo || "nombre:" + normalizar(fila.nombre);
      let persona = porClave[clave];
      if (!persona) {
        persona = { id: personas.length + 1, nombre: fila.nombre };
        porClave[clave] = persona;
        personas.push(persona);
      } else if (normalizar(persona.nombre) !== normalizar(fila.nombre)) {
        avisos.push(`El mismo correo aparece como «${persona.nombre}» y como «${fila.nombre}» (en «${fila.hoja}»); se publica «${persona.nombre}».`);
      }
      if (!persona.celular) {
        const celular = limpiarCelular(fila.celular);
        if (celular) persona.celular = celular;
      }
      if (vistas[persona.id]) {
        avisos.push(`${persona.nombre} aparece dos veces en «${fila.hoja}»; se publica una.`);
        continue;
      }
      vistas[persona.id] = true;
      membresias.push({ persona: persona.id, grupo: grupo.id, cargo: fila.cargo, lidera: grupo.id === "direccion" || esLider(fila.cargo) });
    }
  }

  // 3. Avisos sobre el resultado.
  for (const p of personas) {
    if (!p.celular) avisos.push(`${p.nombre} no tiene un celular válido: queda sin botón de WhatsApp.`);
  }
  for (const { grupo } of secciones) {
    if (grupo.id === "direccion") continue;
    const lideres = membresias.filter(m => m.grupo === grupo.id && m.lidera).map(m => personas[m.persona - 1].nombre);
    if (lideres.length === 0) avisos.push(`${grupo.nombre} no tiene líder: ningún cargo empieza por «Líder».`);
    if (lideres.length > 1) avisos.push(`${grupo.nombre} tiene ${lideres.length} líderes: ${listarNombres(lideres)}.`);
  }
  if (anterior && anterior.grupos.length) {
    const antes = anterior.grupos.map(g => g.id);
    const ahoraIds = secciones.map(s => s.grupo.id);
    for (const { grupo } of secciones) if (antes.indexOf(grupo.id) < 0) avisos.push(`Departamento nuevo: ${grupo.nombre}.`);
    for (const g of anterior.grupos) if (ahoraIds.indexOf(g.id) < 0) avisos.push(`Ya no está el departamento ${g.nombre}.`);
  }

  return {
    datos: { version: 1, publicadoEn: ahora, grupos: secciones.map(s => s.grupo), personas, membresias },
    avisos,
    errores,
  };
}

function mismoContenido(a: Organigrama, b: Organigrama): boolean {
  const sinFecha = (o: Organigrama) => JSON.stringify({ g: o.grupos, p: o.personas, m: o.membresias });
  return sinFecha(a) === sinFecha(b);
}

// ---------------------------------------------------------------------------
// Base64 sobre UTF-8, a mano: el entorno de Office Scripts no garantiza
// btoa/atob ni TextEncoder, y los nombres llevan tildes.
// ---------------------------------------------------------------------------

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function aUtf8(texto: string): number[] {
  const bytes: number[] = [];
  for (const caracter of texto) {
    const c = caracter.codePointAt(0) as number;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return bytes;
}

function desdeUtf8(bytes: number[]): string {
  let texto = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let c: number;
    if (b < 0x80) { c = b; i += 1; }
    else if (b < 0xe0) { c = ((b & 31) << 6) | (bytes[i + 1] & 63); i += 2; }
    else if (b < 0xf0) { c = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63); i += 3; }
    else { c = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63); i += 4; }
    texto += String.fromCodePoint(c);
  }
  return texto;
}

function aBase64(texto: string): string {
  const bytes = aUtf8(texto);
  let salida = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    salida += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    salida += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
    salida += i + 2 < bytes.length ? B64[n & 63] : "=";
  }
  return salida;
}

function desdeBase64(base64: string): string {
  const limpio = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < limpio.length; i += 4) {
    const n = (B64.indexOf(limpio[i]) << 18) | (B64.indexOf(limpio[i + 1]) << 12)
      | ((B64.indexOf(limpio[i + 2] ?? "A") & 63) << 6) | (B64.indexOf(limpio[i + 3] ?? "A") & 63);
    bytes.push((n >> 16) & 255);
    if (i + 2 < limpio.length) bytes.push((n >> 8) & 255);
    if (i + 3 < limpio.length) bytes.push(n & 255);
  }
  return desdeUtf8(bytes);
}

// ---------------------------------------------------------------------------
// Borde: Excel y GitHub.
// ---------------------------------------------------------------------------

interface ContenidoGitHub {
  sha: string;
  content: string;
}

interface Publicado {
  sha: string;
  datos: Organigrama;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Colombia no tiene horario de verano: UTC−5 todo el año.
function ahoraBogota(): { iso: string; legible: string } {
  const d = new Date(Date.now() - 5 * 3600 * 1000);
  const dos = (n: number) => String(n).padStart(2, "0");
  return {
    iso: d.toISOString().replace(/\.\d{3}Z$/, "-05:00"),
    legible: `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`,
  };
}

function cabeceras(): { [nombre: string]: string } {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function explicarHttp(estado: number): string {
  if (estado === 401) return "el token no es válido o ya venció. Hay que generar uno nuevo (ver README del repo).";
  if (estado === 403) return "el token no tiene permiso de escritura sobre el repo organigrama.";
  if (estado === 404) return "no se encontró el repo. Revisa que el token tenga acceso a Caritool/organigrama.";
  if (estado === 409 || estado === 422) return "alguien publicó al mismo tiempo. Vuelve a intentar.";
  return `GitHub respondió con el código ${estado}.`;
}

async function leerPublicado(): Promise<Publicado | null> {
  const respuesta = await fetch(`https://api.github.com/repos/${REPO}/contents/${RUTA}?ref=${RAMA}`, { headers: cabeceras() });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(explicarHttp(respuesta.status));
  const cuerpo = (await respuesta.json()) as ContenidoGitHub;
  return { sha: cuerpo.sha, datos: JSON.parse(desdeBase64(cuerpo.content)) as Organigrama };
}

async function subir(datos: Organigrama, sha: string | null): Promise<void> {
  const cuerpo: { [campo: string]: string } = {
    message: `datos(organigrama): publicación desde el Excel, ${datos.personas.length} personas`,
    content: aBase64(JSON.stringify(datos, null, 2) + "\n"),
    branch: RAMA,
  };
  if (sha) cuerpo.sha = sha;
  const respuesta = await fetch(`https://api.github.com/repos/${REPO}/contents/${RUTA}`, {
    method: "PUT",
    headers: cabeceras(),
    body: JSON.stringify(cuerpo),
  });
  if (!respuesta.ok) throw new Error(explicarHttp(respuesta.status));
}

function escribirEstado(libro: ExcelScript.Workbook, lineas: string[]): void {
  const hoja = libro.getWorksheet(HOJA_ESTADO) ?? libro.addWorksheet(HOJA_ESTADO);
  hoja.getRange("A3:A200").clear(ExcelScript.ClearApplyTo.contents);
  hoja.getRange(`A3:A${2 + lineas.length}`).setValues(lineas.map(l => [l]));
}

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function main(workbook: ExcelScript.Workbook): Promise<void> {
  escribirEstado(workbook, ["Publicando…"]);
  const hojas: HojaCruda[] = workbook.getWorksheets().map(ws => {
    const usado = ws.getUsedRange(true);
    return { nombre: ws.getName(), valores: usado ? (usado.getValues() as Celda[][]) : [] };
  });

  let publicado: Publicado | null;
  try {
    publicado = await leerPublicado();
  } catch (e) {
    escribirEstado(workbook, [`No se publicó: ${mensajeDe(e)}`]);
    return;
  }

  const ahora = ahoraBogota();
  const { datos, avisos, errores } = construirOrganigrama(hojas, publicado ? publicado.datos : null, ahora.iso);
  const conAvisos = (lineas: string[]) => lineas.concat(avisos.map(a => "· " + a));

  if (errores.length) {
    escribirEstado(workbook, conAvisos(["No se publicó. El organigrama sigue con la última versión publicada.", ...errores]));
    return;
  }
  if (publicado && mismoContenido(publicado.datos, datos)) {
    escribirEstado(workbook, conAvisos([`Sin cambios desde la última publicación. Revisado el ${ahora.legible}.`]));
    return;
  }
  try {
    await subir(datos, publicado ? publicado.sha : null);
  } catch (e) {
    escribirEstado(workbook, [`No se publicó: ${mensajeDe(e)}`]);
    return;
  }
  const departamentos = datos.grupos.filter(g => g.id !== "direccion").length;
  escribirEstado(workbook, conAvisos([
    `Publicado el ${ahora.legible}. ${datos.personas.length} personas en ${departamentos} departamentos y Dirección.`,
    "Se verá en el organigrama en uno o dos minutos.",
  ]));
}
