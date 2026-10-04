// Corre el núcleo de excel/publicar.ts sobre un .xlsx local, sin Excel ni GitHub.
//
//   node tools/publicar-local.mjs libro.xlsx [salida.json]
//
// La salida por defecto es data/local.json (ignorado por git), que la página
// carga con ?local. Nunca escribe data/organigrama.json: ese archivo solo lo
// cambia Publicar desde el Excel real.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [libro, salida = join(raiz, "data/local.json")] = process.argv.slice(2);
if (!libro) {
  console.error("Uso: node tools/publicar-local.mjs libro.xlsx [salida.json]");
  process.exit(2);
}

// Un Office Script no puede exportar nada; se copia con un export añadido para
// importarlo con el type stripping de Node.
const temporal = join(mkdtempSync(join(tmpdir(), "publicar-")), "publicar.ts");
writeFileSync(temporal, readFileSync(join(raiz, "excel/publicar.ts"), "utf8") + "\nexport { construirOrganigrama, aBase64, desdeBase64 };\n");
const { construirOrganigrama, aBase64, desdeBase64 } = await import(pathToFileURL(temporal).href);

const hojas = JSON.parse(execFileSync("uv", ["run", "--quiet", "--with", "openpyxl", "python", join(raiz, "tools/hojas-desde-xlsx.py"), libro], { encoding: "utf8" }));
const { datos, avisos, errores } = construirOrganigrama(hojas, null, new Date().toISOString());

const json = JSON.stringify(datos, null, 2) + "\n";
if (desdeBase64(aBase64(json)) !== json) throw new Error("base64 no hace ida y vuelta: no es seguro subir este contenido");

console.log(`Hojas: ${hojas.map(h => h.nombre).join(", ")}`);
console.log(`Grupos: ${datos.grupos.map(g => g.nombre).join(", ")}`);
console.log(`${datos.personas.length} personas, ${datos.membresias.length} membresías`);
for (const e of errores) console.log(`ERROR  ${e}`);
for (const a of avisos) console.log(`aviso  ${a}`);
if (errores.length) process.exit(1);
writeFileSync(salida, json);
console.log(`Escrito ${salida}`);
