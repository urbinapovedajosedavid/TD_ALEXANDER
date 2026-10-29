/* Pantalla de inicio de sesión - Tienda Alexander.
 *
 * Autenticación segura mediante el backend Flask y persistencia en SQLite.
 * Cuenta regresiva automática para bloqueos temporales por intentos fallidos.
 */

(function () {
    const $ = (id) => document.getElementById(id);

    document.addEventListener("DOMContentLoaded", () => {
        const form = $("formLogin");
        const mensaje = $("mensajeLogin");
        const btnSubmit = form.querySelector('button[type="submit"]');
        const textoOriginalBtn = btnSubmit ? btnSubmit.textContent : "Iniciar sesión";

        let temporizadorBloqueo = null;

        // Si ya hay una sesión activa en el servidor, ir directamente al inicio
        if (App.auth.actual()) {
            window.location.replace("inicio.html");
            return;
        }

        const btnIrRegistro = $("btnIrRegistro");
        if (btnIrRegistro) {
            btnIrRegistro.addEventListener("click", () => {
                window.location.href = "agregar_usuario.html";
            });
        }

        function detenerCuentaRegresiva() {
            if (temporizadorBloqueo) {
                clearInterval(temporizadorBloqueo);
                temporizadorBloqueo = null;
            }
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = textoOriginalBtn;
            }
        }

        function formatearTiempo(segs) {
            if (segs >= 60) {
                const mins = Math.floor(segs / 60);
                const resto = segs % 60;
                return `${segs} segundos (${mins} min${resto > 0 ? " " + resto + " s" : ""})`;
            }
            return `${segs} segundo${segs === 1 ? "" : "s"}`;
        }

        function iniciarCuentaRegresiva(segundosTotales) {
            detenerCuentaRegresiva();

            const momentoFin = Date.now() + segundosTotales * 1000;

            function actualizarSegundo() {
                const ahora = Date.now();
                const segundosRestantes = Math.max(0, Math.ceil((momentoFin - ahora) / 1000));

                if (segundosRestantes > 0) {
                    App.ui.mensaje(
                        mensaje,
                        `Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en ${formatearTiempo(segundosRestantes)}.`,
                        "error"
                    );

                    if (btnSubmit) {
                        btnSubmit.disabled = true;
                        btnSubmit.textContent = `Bloqueado (${segundosRestantes}s)`;
                    }
                } else {
                    detenerCuentaRegresiva();
                    App.ui.mensaje(
                        mensaje,
                        "El tiempo de bloqueo ha terminado. Ya puedes intentar iniciar sesión nuevamente.",
                        "info"
                    );
                }
            }

            // Primer disparo instantáneo
            actualizarSegundo();

            // Actualización continua segundo a segundo en tiempo real
            temporizadorBloqueo = setInterval(actualizarSegundo, 1000);
        }

        form.addEventListener("submit", async (evento) => {
            evento.preventDefault();

            const usuario = $("usuarioLogin").value.trim();
            const clave = $("claveLogin").value;

            if (!usuario || !clave) {
                App.ui.mensaje(mensaje, "Completa ambos campos.", "error");
                return;
            }

            App.ui.mensaje(mensaje, "Verificando credenciales...", "info");

            try {
                const respuesta = await App.api.login(usuario, clave);
                detenerCuentaRegresiva();
                App.auth.guardar(null, respuesta.usuario);
                window.location.href = "inicio.html";
            } catch (err) {
                const datos = err.datos || {};
                let segundos = null;

                if (typeof datos.segundos_restantes === "number" && datos.segundos_restantes > 0) {
                    segundos = datos.segundos_restantes;
                } else {
                    // Si el backend envió segundos en el texto del mensaje
                    const match = String(err.message || "").match(/(\d+)\s*segundos/i);
                    if (match) {
                        segundos = parseInt(match[1], 10);
                    }
                }

                if (segundos && segundos > 0) {
                    // Reproducir los segundos automáticamente hacia atrás
                    iniciarCuentaRegresiva(segundos);
                } else {
                    detenerCuentaRegresiva();
                    App.ui.mensaje(mensaje, err.message, "error");
                }
            }
        });
    });
})();
