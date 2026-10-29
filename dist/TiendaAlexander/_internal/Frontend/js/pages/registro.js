/* Pantalla de alta de usuarios - Tienda Alexander.
 *
 * Crea cuentas directamente en la base de datos SQLite del servidor.
 * Cero LocalStorage y cero SessionStorage.
 */

(function () {
    const $ = (id) => document.getElementById(id);

    document.addEventListener("DOMContentLoaded", () => {
        const form = $("formUsuarioModal");
        const mensaje = $("mensajeModal");
        const btnEntrarNuevo = $("btnEntrarNuevo");
        const btnVolverLogin = $("btnVolverLogin");

        form.addEventListener("submit", async (evento) => {
            evento.preventDefault();

            const usuario = $("usuarioModal").value.trim();
            const clave = $("claveModal").value;

            if (!usuario || !clave) {
                App.ui.mensaje(mensaje, "Completa todos los campos obligatorios.", "error");
                return;
            }

            if (usuario.length < 3) {
                App.ui.mensaje(mensaje, "El usuario debe tener al menos 3 caracteres.", "error");
                return;
            }

            if (clave.length < 4) {
                App.ui.mensaje(mensaje, "La contraseña debe tener al menos 4 caracteres.", "error");
                return;
            }

            App.ui.mensaje(mensaje, "Creando usuario en la base de datos...", "info");

            try {
                // Si hay un admin logueado, usa el endpoint administrativo; si no, el registro público
                const esAdmin = App.auth.esAdmin();
                const peticion = esAdmin ? App.api.registro : App.api.registroPublico;

                const res = await peticion({
                    usuario: usuario,
                    clave: clave,
                    contrasena: clave,
                    nombre: usuario,
                });

                form.reset();
                App.ui.mensaje(
                    mensaje,
                    res.mensaje || `Usuario "${usuario}" creado con éxito. Ya puedes iniciar sesión.`,
                    "exito"
                );
                if (btnEntrarNuevo) btnEntrarNuevo.hidden = false;
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
                window.location.href = "Login.html";
            });
        }
    });
})();
