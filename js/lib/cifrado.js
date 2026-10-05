// Formato del archivo cifrado que sube Publicar (excel/publicar.ts, `cifrar`):
// AES-256-GCM con clave derivada de la contraseña por PBKDF2-SHA256. Si cambia
// uno, cambia el otro.

export class ClaveIncorrecta extends Error {}

const aBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function derivar(clave, sal, iteraciones) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sal, iterations: iteraciones, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

export async function descifrar(sobre, clave) {
  const { sal, iv, iteraciones } = sobre.cifrado;
  const llave = await derivar(clave, aBytes(sal), iteraciones);
  try {
    const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: aBytes(iv) }, llave, aBytes(sobre.datos));
    return JSON.parse(new TextDecoder().decode(plano));
  } catch {
    // GCM autentica: una clave equivocada falla aquí, nunca devuelve basura.
    throw new ClaveIncorrecta("La contraseña no abre el organigrama.");
  }
}
