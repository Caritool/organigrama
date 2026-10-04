import { normalizar } from "./lib/texto.js";
import { cargarOrganigrama, OrganigramaInvalido } from "./modules/datos.js";
import { crearRonda } from "./modules/ronda.js";
import { crearPanel } from "./modules/panel.js";

// ?local carga data/local.json, que genera tools/publicar-local.mjs y git ignora.
const FUENTE = new URLSearchParams(location.search).has("local") ? "data/local.json" : "data/organigrama.json";
const PALABRAS_LIDER = new Set(["lider", "lidera", "lideres"]);

const input = document.querySelector("#buscar");
const panel = crearPanel(document.querySelector(".panel"));
const ronda = crearRonda(document.querySelector(".rueda"), {
  alElegir: (asiento) => enfocar(asiento),
  movimientoReducido: matchMedia("(prefers-reduced-motion: reduce)").matches,
});

let datos = null;
let consulta = "";

const coincide = (asiento, q) =>
  normalizar(asiento.persona.nombre).includes(q) ||
  normalizar(asiento.cargo).includes(q) ||
  normalizar(asiento.grupo.nombre).includes(q) ||
  (PALABRAS_LIDER.has(q) && asiento.lidera);

function coincidencias(q) {
  const porPersona = new Map();
  for (const a of ronda.asientos) if (coincide(a, q) && !porPersona.has(a.persona.id)) porPersona.set(a.persona.id, a);
  return [...porPersona.values()];
}

function enfocar(asiento) {
  ronda.enfocar(asiento);
  pintar();
}

function pintar() {
  const q = normalizar(consulta.trim());
  const encontrados = q ? coincidencias(q) : [];
  ronda.resaltar(q ? new Set(encontrados.map((a) => a.persona.id)) : null);
  const foco = ronda.foco;

  if (foco && (!q || encontrados.some((a) => a.persona.id === foco.persona.id))) {
    ronda.mostrarCentro(foco.persona.nombre, foco.grupo.nombre);
    panel.ficha(foco, {
      otros: ronda.asientos.filter((a) => a.persona.id === foco.persona.id && a !== foco),
      lideres: ronda.asientos.filter((a) => a.grupo.id === foco.grupo.id && a.lidera && a.persona.id !== foco.persona.id && a.persona.celular),
      publicadoEn: datos.publicadoEn,
      alIrA: (lider) => enfocar(lider),
    });
    return;
  }
  const departamentos = datos.grupos.filter((g) => g.id !== "direccion").length;
  ronda.mostrarCentro("La Brújula", `${datos.personas.length} personas · ${departamentos} departamentos y Dirección`);
  if (!q) panel.pista(datos.publicadoEn);
  else if (!encontrados.length) panel.sinCoincidencias(consulta.trim(), datos.publicadoEn);
  else panel.lista(encontrados, datos.publicadoEn, (a) => enfocar(ronda.asientoDe(a.persona.id)));
}

input.addEventListener("input", () => {
  consulta = input.value;
  ronda.enfocar(null);
  const q = normalizar(consulta.trim());
  const encontrados = q ? coincidencias(q) : [];
  // Una sola coincidencia abre la ficha sin pedir otro toque.
  if (encontrados.length === 1) enfocar(ronda.asientoDe(encontrados[0].persona.id));
  else pintar();
});

input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const [primero] = coincidencias(normalizar(consulta.trim()));
  if (primero) enfocar(ronda.asientoDe(primero.persona.id));
});

async function iniciar() {
  input.disabled = true;
  ronda.mostrarCentro("Cargando…", "Trayendo el organigrama");
  panel.mensaje("Cargando el organigrama…");
  try {
    datos = await cargarOrganigrama(FUENTE);
  } catch (error) {
    console.error("organigrama: no se pudo cargar", FUENTE, error);
    const invalido = error instanceof OrganigramaInvalido;
    ronda.mostrarCentro(invalido ? "Archivo dañado" : "Sin conexión", "No se pudo cargar");
    panel.error(
      invalido
        ? "El archivo del organigrama está dañado. Quien administra el Excel debe volver a usar Publicar."
        : "No se pudo cargar el organigrama. Revisa tu conexión y vuelve a intentarlo.",
      iniciar,
    );
    return;
  }
  if (!datos.personas.length) {
    ronda.mostrarCentro("La Brújula", "Todavía no hay nadie publicado");
    panel.mensaje("Todavía no hay nadie en el organigrama. Quien administra el Excel de La Brújula debe usar Publicar.");
    return;
  }
  ronda.cargar(datos);
  input.disabled = false;
  pintar();
}

iniciar();
