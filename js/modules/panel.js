import { escapar, fechaCorta } from "../lib/texto.js";

// El panel bajo la ronda: pista, lista de coincidencias o ficha de una persona.
export function crearPanel(contenedor) {
  const pie = (publicadoEn) => (publicadoEn ? `<p class="pie">Actualizado el ${fechaCorta(publicadoEn)}</p>` : "");

  return {
    mensaje(texto) {
      contenedor.innerHTML = `<p class="donde">${escapar(texto)}</p>`;
    },

    error(texto, alReintentar) {
      contenedor.innerHTML = `<p>${escapar(texto)}</p><button class="accion secundaria" type="button">Volver a intentar</button>`;
      contenedor.querySelector("button").addEventListener("click", alReintentar);
    },

    pista(publicadoEn) {
      contenedor.innerHTML = `<p class="donde">Toca un asiento o busca a alguien para ver su cargo y escribirle.</p>${pie(publicadoEn)}`;
    },

    sinCoincidencias(consulta, publicadoEn) {
      contenedor.innerHTML = `<p>Nadie coincide con «${escapar(consulta)}». Busca por nombre, por cargo, por ejemplo líder o fotógrafo, o por departamento.</p>${pie(publicadoEn)}`;
    },

    lista(asientos, publicadoEn, alElegir) {
      const n = asientos.length;
      contenedor.innerHTML = `<span class="etiqueta">${n} ${n === 1 ? "coincide" : "coinciden"}</span>
        <ul class="lista">${asientos
          .map((a, i) => `<li><button type="button" data-i="${i}"><b>${escapar(a.persona.nombre)}</b><small>${escapar(a.grupo.nombre)}</small></button></li>`)
          .join("")}</ul>${pie(publicadoEn)}`;
      contenedor.querySelectorAll("button[data-i]").forEach((b) => b.addEventListener("click", () => alElegir(asientos[+b.dataset.i])));
    },

    /**
     * Sin celular no hay botón muerto: se ofrece a quien lidera el departamento.
     * El número nunca se muestra, solo el botón (decisión del grupo).
     */
    ficha(asiento, { otros, lideres, publicadoEn, alIrA }) {
      const { persona, grupo, cargo } = asiento;
      let accion;
      if (persona.celular) {
        accion = `<a class="accion" href="https://wa.me/${persona.celular}" target="_blank" rel="noopener">Escribir por WhatsApp</a>`;
      } else if (lideres.length) {
        accion = `<div class="sin-wa"><span class="donde">No tiene WhatsApp publicado. Escríbele a quien lidera ${escapar(grupo.nombre)}:</span>
          ${lideres.map((l, i) => `<button class="accion secundaria" type="button" data-i="${i}">${escapar(l.persona.nombre)}</button>`).join("")}</div>`;
      } else {
        accion = `<span class="donde">No tiene WhatsApp publicado.</span>`;
      }
      contenedor.innerHTML = `<div class="ficha">
          <h2>${escapar(persona.nombre)}</h2>
          <span class="donde">${escapar(grupo.nombre)} · ${escapar(cargo)}</span>
          ${otros.length ? `<span class="donde">También en ${otros.map((o) => `${escapar(o.grupo.nombre)} · ${escapar(o.cargo)}`).join("; ")}</span>` : ""}
          ${accion}
        </div>${pie(publicadoEn)}`;
      contenedor.querySelectorAll(".sin-wa button[data-i]").forEach((b) => b.addEventListener("click", () => alIrA(lideres[+b.dataset.i])));
    },
  };
}
