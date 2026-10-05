// Cifra un data/*.json con el mismo formato que Publicar. La contraseña va en la
// variable CLAVE para que no quede en el historial del shell ni en el repo.
//
//   CLAVE='…' node tools/cifrar-datos.mjs entrada.json [salida.json]
import { readFileSync, writeFileSync } from "node:fs";

const [entrada, salida = entrada] = process.argv.slice(2);
const clave = process.env.CLAVE;
if (!entrada || !clave) {
  console.error("Uso: CLAVE='…' node tools/cifrar-datos.mjs entrada.json [salida.json]");
  process.exit(2);
}
const ITERACIONES = 600000;
const datos = JSON.parse(readFileSync(entrada, "utf8"));
if (datos.cifrado) throw new Error("El archivo ya está cifrado.");

const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const sal = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveKey"]);
const llave = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: sal, iterations: ITERACIONES, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, llave, new TextEncoder().encode(JSON.stringify(datos)));
const sobre = {
  version: 2,
  publicadoEn: datos.publicadoEn ?? null,
  cifrado: { algoritmo: "AES-256-GCM", kdf: "PBKDF2-SHA256", iteraciones: ITERACIONES, sal: b64(sal), iv: b64(iv) },
  datos: b64(new Uint8Array(cifrado)),
};
writeFileSync(salida, JSON.stringify(sobre, null, 2) + "\n");
console.log(`Cifrado ${salida} (${datos.personas?.length ?? 0} personas)`);
