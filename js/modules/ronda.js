import { C, R, disponer, mod360, punto } from "../lib/geometria.js";
import { escapar, iniciales } from "../lib/texto.js";

const SVG = "http://www.w3.org/2000/svg";
const DUR_GIRO = 480; // única excepción a la escala de movimiento: media vuelta en 320 ms se siente como un salto

function nodo(tag, atributos = {}) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, v);
  return e;
}

/**
 * La ronda: asientos en un anillo que gira bajo una aguja fija.
 *
 * Arriba no es rango sino foco: `enfocar` gira la ronda hasta dejar el asiento
 * bajo la aguja. Al cargar, la aguja apunta a un hueco entre departamentos
 * elegido al azar, así que nadie queda arriba por defecto.
 */
export function crearRonda(svg, { alElegir, movimientoReducido }) {
  const defs = nodo("defs");
  const capaArcos = nodo("g");
  const capaAsientos = nodo("g");
  svg.append(defs, nodo("circle", { cx: C, cy: C, r: R, class: "anillo" }), capaArcos, capaAsientos);

  const aguja = nodo("g", { class: "aguja" });
  svg.append(aguja);
  const centro = document.createElement("div");
  centro.className = "centro";
  const fo = nodo("foreignObject", { x: C - 88, y: C - 12, width: 176, height: 100 });
  fo.append(centro);
  svg.append(fo);

  let disposicion = null;
  let nodos = [];
  let etiquetas = [];
  let rotacion = 0;
  let animacion = 0;
  let foco = null;
  let radioArriba = 0;
  let radioAbajo = 0;

  function dibujarAguja(rRep) {
    const punta = C - (R - rRep - 28);
    aguja.replaceChildren(
      nodo("line", { x1: C, y1: C - 26, x2: C, y2: punta + 10 }),
      nodo("polygon", { points: `${C},${punta} ${C - 6},${punta + 14} ${C + 6},${punta + 14}` }),
      nodo("circle", { cx: C, cy: C - 26, r: 3 }),
    );
  }
  dibujarAguja(20);

  function dibujar() {
    for (const { asiento, g } of nodos) {
      const [x, y] = punto(asiento.angulo + rotacion, R);
      g.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    }
    // El trazo de la etiqueta mide al menos 140°, centrado en su arco: un departamento
    // de dos personas tiene un arco más corto que su nombre y textPath lo recortaría.
    // En la mitad de abajo se recorre al revés para que el texto no quede de cabeza.
    for (const { arco, camino } of etiquetas) {
      const centroArco = (arco.a1 + arco.a2) / 2 + rotacion;
      const mitad = Math.min(89, Math.max((arco.a2 - arco.a1) / 2, 70));
      if (mod360(centroArco) > 90 && mod360(centroArco) < 270) {
        const [x1, y1] = punto(centroArco + mitad, radioAbajo);
        const [x2, y2] = punto(centroArco - mitad, radioAbajo);
        camino.setAttribute("d", `M${x1} ${y1} A${radioAbajo} ${radioAbajo} 0 0 0 ${x2} ${y2}`);
      } else {
        const [x1, y1] = punto(centroArco - mitad, radioArriba);
        const [x2, y2] = punto(centroArco + mitad, radioArriba);
        camino.setAttribute("d", `M${x1} ${y1} A${radioArriba} ${radioArriba} 0 0 1 ${x2} ${y2}`);
      }
    }
  }

  function girarA(objetivo, animar) {
    const delta = mod360(objetivo - rotacion + 180) - 180;
    cancelAnimationFrame(animacion);
    if (!animar || movimientoReducido) {
      rotacion += delta;
      dibujar();
      return;
    }
    const desde = rotacion;
    const t0 = performance.now();
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / DUR_GIRO);
      rotacion = desde + delta * (1 - Math.pow(1 - k, 3));
      dibujar();
      if (k < 1) animacion = requestAnimationFrame(paso);
    };
    animacion = requestAnimationFrame(paso);
  }

  function cargar(datos) {
    disposicion = disponer(datos);
    const { rBase, rRep } = disposicion;
    radioArriba = R - rRep - 16;
    radioAbajo = R - rRep - 6;
    dibujarAguja(rRep);
    svg.classList.toggle("densa", disposicion.densa);

    etiquetas = disposicion.arcos.map((arco, i) => {
      const camino = nodo("path", { id: `arco-${i}`, fill: "none" });
      const texto = nodo("text", { class: "arco" });
      const tp = nodo("textPath", { href: `#arco-${i}`, startOffset: "50%", "text-anchor": "middle" });
      tp.textContent = arco.grupo.nombre;
      texto.append(tp);
      return { arco, camino, texto };
    });
    defs.replaceChildren(...etiquetas.map((e) => e.camino));
    capaArcos.replaceChildren(...etiquetas.map((e) => e.texto));

    nodos = disposicion.asientos.map((asiento) => {
      const r = asiento.lidera ? rRep : rBase;
      const g = nodo("g", {
        class: "asiento" + (asiento.lidera ? " rep" : ""),
        tabindex: "0",
        role: "button",
        "aria-label": `${asiento.persona.nombre}, ${asiento.grupo.nombre}, ${asiento.cargo}`,
      });
      const etiqueta = nodo("text");
      etiqueta.textContent = iniciales(asiento.persona.nombre);
      g.append(nodo("circle", { r, class: "disco" }), nodo("circle", { r: r + 4, class: "halo" }), etiqueta);
      g.addEventListener("click", () => alElegir(asiento));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          alElegir(asiento);
        }
      });
      return { asiento, g };
    });
    capaAsientos.replaceChildren(...nodos.map((n) => n.g));

    const { bordes } = disposicion;
    rotacion = bordes.length ? -bordes[Math.floor(Math.random() * bordes.length)] : 0;
    foco = null;
    dibujar();
  }

  return {
    cargar,
    get asientos() {
      return disposicion ? disposicion.asientos : [];
    },
    mostrarCentro(titulo, detalle) {
      centro.innerHTML = `<b>${escapar(titulo)}</b><span>${escapar(detalle)}</span>`;
    },
    resaltar(personas) {
      svg.classList.toggle("hay-busqueda", personas !== null);
      for (const { asiento, g } of nodos) g.classList.toggle("coincide", !!personas && personas.has(asiento.persona.id));
    },
    enfocar(asiento, animar = true) {
      foco = asiento;
      svg.classList.toggle("con-foco", !!asiento);
      for (const n of nodos) n.g.classList.toggle("foco", n.asiento === asiento);
      if (asiento) girarA(-asiento.angulo, animar);
    },
    // Si la persona está en varios departamentos, el asiento más cercano a la aguja.
    asientoDe(personaId, grupoId) {
      const distancia = (a) => Math.abs(mod360(a.angulo + rotacion + 180) - 180);
      return this.asientos
        .filter((a) => a.persona.id === personaId && (!grupoId || a.grupo.id === grupoId))
        .sort((a, b) => distancia(a) - distancia(b))[0];
    },
    get foco() {
      return foco;
    },
  };
}
