// Geometría de la ronda en un viewBox de 360. 0° es arriba y el sentido es horario.
// Las etiquetas van por dentro del anillo para que los asientos usen todo el borde.

export const C = 180;
export const R = 160;
const HUECO = 0.6;      // espacio entre departamentos, en asientos
const PESO_REP = 1.35;  // un paso de escala: el asiento de quien representa
const R_MAX = 15;

export const mod360 = (g) => ((g % 360) + 360) % 360;

export function punto(grados, radio) {
  const a = (grados * Math.PI) / 180;
  return [C + radio * Math.sin(a), C - radio * Math.cos(a)];
}

const alfabetico = (a, b) => a.persona.nombre.localeCompare(b.persona.nombre, "es");

/**
 * Reparte las membresías en arcos, uno por grupo y en el orden de `grupos`.
 *
 * Dentro de cada arco, quien lidera va al centro y el resto en orden alfabético
 * a sus lados: el peso nunca se expresa como altura (design/constraints.md).
 * Devuelve ángulos sin rotar. `bordes` son los ángulos de los huecos entre arcos,
 * donde apunta la aguja al llegar.
 */
export function disponer(datos) {
  const personas = new Map(datos.personas.map((p) => [p.id, p]));
  const asientos = [];
  const arcos = [];
  const bordes = [];
  let s = 0;
  for (const grupo of datos.grupos) {
    const suyas = datos.membresias
      .filter((m) => m.grupo === grupo.id)
      .map((m) => ({ ...m, persona: personas.get(m.persona), grupo }));
    if (!suyas.length) continue;
    const lideres = suyas.filter((m) => m.lidera).sort(alfabetico);
    const resto = suyas.filter((m) => !m.lidera).sort(alfabetico);
    const mitad = Math.floor(resto.length / 2);
    const inicio = s;
    s += HUECO / 2;
    for (const m of [...resto.slice(0, mitad), ...lideres, ...resto.slice(mitad)]) {
      const peso = m.lidera ? PESO_REP : 1;
      asientos.push({ ...m, slot: s + peso / 2 });
      s += peso;
    }
    s += HUECO / 2;
    arcos.push({ grupo, desde: inicio, hasta: s });
    bordes.push(s);
  }
  const total = s || 1;
  const grados = (slot) => (slot / total) * 360;
  for (const a of asientos) a.angulo = grados(a.slot);
  for (const a of arcos) { a.a1 = grados(a.desde); a.a2 = grados(a.hasta); }
  const rBase = Math.min(R_MAX, ((2 * Math.PI * R) / total) * 0.42);
  return {
    asientos,
    arcos,
    bordes: bordes.map(grados),
    rBase,
    rRep: rBase * PESO_REP,
    // Por debajo de 13 las iniciales a 13px ya no caben en el asiento.
    densa: rBase < 13,
  };
}
