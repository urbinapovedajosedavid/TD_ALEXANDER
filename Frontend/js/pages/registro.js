/* Pantalla de alta de usuarios - Tienda Alexander.
 *
 * Crea cuentas directamente en la base de datos SQLite del servidor
 * validando nombre, apellido, teléfono, usuario y contraseña.
 */

(function () {
    const $ = (id) => document.getElementById(id);

    document.addEventListener("DOMContentLoaded", () => {
        const form = $("formUsuarioModal");
        const mensaje = $("mensajeModal");
        const btnEntrarNuevo = $("btnEntrarNuevo");
        const btnVolverLogin = $("btnVolverLogin");

        const sesionActiva = App.auth.actual();
        if (sesionActiva && btnVolverLogin) {
            btnVolverLogin.textContent = "Volver al panel principal";
        }

        form.addEventListener("submit", async (evento) => {
            evento.preventDefault();

            const nombre = ($("nombreModal") ? $("nombreModal").value : "").trim();
            const apellido = ($("apellidoModal") ? $("apellidoModal").value : "").trim();
            const telefono = ($("telefonoModal") ? $("telefonoModal").value : "").trim();
            const usuario = ($("usuarioModal") ? $("usuarioModal").value : "").trim();
            const clave = $("claveModal") ? $("claveModal").value : "";

            if (!nombre || !apellido || !telefono || !usuario || !clave) {
                App.ui.mensaje(mensaje, "Completa todos los campos obligatorios.", "error");
                return;
            }

            const digitosTelefono = telefono.replace(/\D/g, "");
            if (digitosTelefono.length < 7) {
                App.ui.mensaje(mensaje, "El teléfono debe tener al menos 7 dígitos.", "error");
                return;
            }

            if (usuario.length < 3) {
                App.ui.mensaje(mensaje, "El nombre de usuario debe tener al menos 3 caracteres.", "error");
                return;
            }

            if (clave.length < 4) {
                App.ui.mensaje(mensaje, "La contraseña debe tener al menos 4 caracteres.", "error");
                return;
            }

            App.ui.mensaje(mensaje, "Creando usuario en la base de datos...", "info");

            try {
                const esAdmin = App.auth.esAdmin();
                const peticion = esAdmin ? App.api.registro : App.api.registroPublico;

                const res = await peticion({
                    nombre,
                    apellido,
                    telefono,
                    usuario,
                    clave,
                });

                form.reset();
                App.ui.mensaje(
                    mensaje,
                    res.mensaje || `Usuario "${usuario}" creado con éxito.`,
                    "exito"
                );
                if (btnEntrarNuevo && !sesionActiva) {
                    btnEntrarNuevo.hidden = false;
                }
            } catch (err) {
                App.ui.mensaje(mensaje, err.message, "error");
            }
        });

        if (btnEntrarNuevo) {
            btnEntrarNuevo.addEventListener("click", () => {
                window.location.href = "Login.html";
            });
        }

        if (btnVolverLogin) {
            btnVolverLogin.addEventListener("click", () => {
                window.location.href = sesionActiva ? "inicio.html" : "Login.html";
            });
        }
    });
})();
