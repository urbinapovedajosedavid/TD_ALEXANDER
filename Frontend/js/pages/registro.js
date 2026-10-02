/* Alta de usuarios.
 *
 * Esta pantalla se abre desde el login, donde no hay sesión, así que no
 * puede pasar por App.auth.exigir(): el endpoint /auth/registro es de uso
 * exclusivo del ADMIN y sin sesión no hay a quién preguntarle. Antes el
 * botón "Crear usuario" del login rebotaba al propio login y el alta era
 * un callejón sin salida.
 *
 * Por eso el alta usa App.cuentas, un almacén de cuentas del navegador que
 * no necesita servidor: la cuenta creada sirve para entrar enseguida, haya
 * servidor o no. Si quien llega es un administrador con sesión real de
 * servidor, además se da de alta allí para no romper el despliegue normal.
 */

(function () {
    const $ = (id) => document.getElementById(id);

    /* true solo con sesión de administrador de verdad: ni cuenta local ni
     * modo demostración. */
    function hayAdminReal() {
        if (!App.auth.esAdmin()) return false;
        if (App.auth.esLocal()) return false;
        if (window.App.demo && App.demo.sinServidor()) return false;
        return true;
    }

    document.addEventListener("DOMContentLoaded", () => {
        const form = $("formUsuarioModal");
        const mensaje = $("mensajeModal");

        form.addEventListener("submit", async (evento) => {
            evento.preventDefault();

            const usuario = $("usuarioModal").value.trim();
            const clave = $("claveModal").value;

            if (!usuario || !clave) {
                App.ui.mensaje(mensaje, "Completa los campos.", "error");
                return;
            }

            const enServidor = hayAdminReal();
            let texto;

            try {
                // Primero en el navegador: es lo que garantiza que la cuenta
                // exista aunque el servidor no responda.
                const cuenta = App.cuentas.crear({
                    usuario: usuario,
                    clave: clave,
                    rol: enServidor ? "ADMIN" : "VENDEDOR",
                });

                if (enServidor) {
                    try {
                        await App.api.registro({ usuario: usuario, clave: clave });
                        texto = `Usuario ${cuenta.usuario} creado. Entra con "${cuenta.usuario}".`;
                    } catch (err) {
                        // El servidor no lo aceptó, pero la cuenta local ya
                        // está: se avisa sin dejar al usuario sin salida.
                        texto = `Usuario ${cuenta.usuario} creado en este navegador. ` +
                            `No se pudo crear en el servidor: ${err.message}`;
                    }
                } else {
                    texto = `Usuario ${cuenta.usuario} creado. Ya puedes entrar con esa cuenta.`;
                }

                form.reset();
                App.ui.mensaje(mensaje, texto, "exito");
                $("btnEntrarNuevo").hidden = false;
            } catch (err) {
                App.ui.mensaje(mensaje, err.message, "error");
            }
        });

        $("btnEntrarNuevo").addEventListener("click", () => {
            window.location.href = "login.html";
        });

        $("btnVolverLogin").addEventListener("click", () => {
            window.location.href = "login.html";
        });
    });
})();