export const normalizar = (texto) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Nombre y primer apellido con cuatro palabras. Con tres es ambiguo: no se sabe
// si la segunda es nombre o apellido, y se toma como apellido.
export function iniciales(nombre) {
  const p = nombre.split(/\s+/).filter(Boolean);
  const segunda = p.length >= 3 ? p[p.length - 2] : p[1] || "";
  return (p[0][0] + (segunda[0] || "")).toUpperCase();
}

export const escapar = (texto) =>
  texto.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const fechaCorta = (iso) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
