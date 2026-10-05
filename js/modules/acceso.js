// Ventana de contraseña. Es un <dialog> modal sin salida: no se cierra con Escape
// ni fuera del cuadro, solo con una contraseña.
export function pedirClave(aviso = "") {
  const dialogo = document.querySelector("#acceso");
  const formulario = dialogo.querySelector("form");
  const campo = dialogo.querySelector("input");
  const mensaje = dialogo.querySelector(".aviso");
  mensaje.textContent = aviso;
  mensaje.hidden = !aviso;
  campo.value = "";
  dialogo.addEventListener("cancel", (e) => e.preventDefault());
  if (!dialogo.open) dialogo.showModal();
  campo.focus();
  return new Promise((resolver) => {
    formulario.addEventListener("submit", (e) => {
      e.preventDefault();
      dialogo.close();
      resolver(campo.value);
    }, { once: true });
  });
}
