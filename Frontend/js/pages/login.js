/* Pantalla de inicio de sesión.
 *
 * Antes validaba contra localStorage con contraseña en texto plano
 * (Backend/login.js + validacionesUsuario.js). Ahora las cuentas están
 * en la base de datos y la validación ocurre en el servidor.
 */

(function () {
    const $ = (id) => document.getElementById(id);

    /* Abre una sesión de cuenta creada en este navegador. No hay token de
     * servidor, así que se le avisa a la demo quién entra para que reconozca
     * al usuario en las peticiones siguientes. */
    function entrarConCuentaLocal(cuenta) {
        App.auth.guardarLocal(cuenta);
        if (window.App.demo) App.demo.iniciarSesion(cuenta);
        window.location.href = "inicio.html";
    }

    
    document.addEventListener("DOMContentLoaded", () => {
        const form = $("formLogin");

        // Si ya hay una sesión abierta no tiene sentido quedarse en el login.
        if (App.auth.actual() && App.auth.token()) {
            window.location.replace("inicio.html");
            return;
        }

        $("btnIrRegistro").addEventListener("click", () => {
            // El alta es la única pantalla a la que se entra sin sesión:
            // es justamente donde se crea la cuenta, así que pedir que ya
            // haya iniciado sesión la dejaba en un callejón sin salida.
            window.location.href = "agregar_usuario.html";
        });

        form.addEventListener("submit", async (evento) => {
            evento.preventDefault();

            const usuario = $("usuarioLogin").value.trim();
            const clave = $("claveLogin").value;

            if (!usuario || !clave) {
                App.ui.mensaje($("mensajeLogin"), "Completa ambos campos.", "error");
                return;
            }

            try {
                const respuesta = await App.api.login(usuario, clave);

                /* Si la cuenta es de este navegador, la sesión tiene que
                 * quedar marcada como local. La demo la acepta y devuelve un
                 * token que ningún servidor reconoce: si el servidor se
                 * levanta a media sesión, mandaría ese token y recibiría un
                 * 401 que cerraría la sesión del usuario. */
                const local = App.cuentas.buscar(respuesta.usuario.usuario);
                if (local) {
                    App.auth.guardarLocal(local);
                    if (window.App.demo) App.demo.iniciarSesion(local);
                } else {
                    // El token es lo que el servidor valida en cada petición;
                    // sin guardarlo la sesión no serviría de nada.
                    App.auth.guardar(respuesta.token, respuesta.usuario);
                }

                window.location.href = "inicio.html";
            } catch (err) {
                // El servidor manda cuando conoce la cuenta. Si la rechaza,
                // se mira si se creó en este navegador: así una cuenta del
                // alta local sirve aunque el servidor esté encendido.
                const cuenta = App.cuentas.verificar(usuario, clave);
                if (cuenta) {
                    entrarConCuentaLocal(cuenta);
                    return;
                }
                App.ui.mensaje($("mensajeLogin"), err.message, "error");
            }
        });
    });
})();
