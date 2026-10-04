// Borde de confianza: el JSON lo escribe Publicar, pero se valida aquí y el resto
// de la página confía en la forma que sale de esta función.

const CELULAR = /^57\d{10}$/;

export class OrganigramaInvalido extends Error {}

export async function cargarOrganigrama(url) {
  // GitHub Pages cachea 10 minutos; no-cache revalida con ETag para ver la
  // última publicación sin bajar el archivo si no cambió.
  const respuesta = await fetch(url, { cache: "no-cache" });
  if (!respuesta.ok) throw new Error(`No se pudo leer ${url}: HTTP ${respuesta.status}`);
  return validar(await respuesta.json());
}

function validar(d) {
  if (!d || !Array.isArray(d.grupos) || !Array.isArray(d.personas) || !Array.isArray(d.membresias)) {
    throw new OrganigramaInvalido("El archivo del organigrama no tiene grupos, personas y membresías.");
  }
  const grupos = d.grupos.filter((g) => typeof g?.id === "string" && typeof g?.nombre === "string");
  const personas = d.personas
    .filter((p) => Number.isInteger(p?.id) && typeof p?.nombre === "string" && p.nombre.trim())
    .map((p) => ({ id: p.id, nombre: p.nombre.trim(), celular: CELULAR.test(p.celular ?? "") ? p.celular : null }));
  const idsPersona = new Set(personas.map((p) => p.id));
  const idsGrupo = new Set(grupos.map((g) => g.id));
  const membresias = d.membresias
    .filter((m) => idsPersona.has(m?.persona) && idsGrupo.has(m?.grupo))
    .map((m) => ({ persona: m.persona, grupo: m.grupo, cargo: String(m.cargo ?? ""), lidera: m.lidera === true }));
  const conMembresia = new Set(membresias.map((m) => m.persona));
  return {
    publicadoEn: typeof d.publicadoEn === "string" ? d.publicadoEn : null,
    grupos: grupos.filter((g) => membresias.some((m) => m.grupo === g.id)),
    personas: personas.filter((p) => conMembresia.has(p.id)),
    membresias,
  };
}
