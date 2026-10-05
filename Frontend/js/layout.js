/* Sidebar y cabecera común.
 *
 * Estas dos zonas estaban copiadas en inicio.html, almacen.html,
 * ventas.html, reportes.html y proveedores.html: unas 60 líneas por
 * archivo que solo cambiaban en el botón activo y el subtítulo. Aquí se
 * generan una vez a partir de la tabla PAGINAS.
 *
 * Cada página solo necesita:
 *   <aside id="sidebar"></aside>
 *   <header id="barraSuperior"></header>
 * y declarar su subtítulo en data-subtitulo.
 */

window.App = window.App || {};

App.layout = (function () {
    const LOGO = "https://i.postimg.cc/XqZdZjvF/logo-TD.jpg";

    /* Origen único de la navegación. El orden es también el del menú. */
    const PAGINAS = [
        { clave: "inicio", ruta: "inicio.html", texto: "Inicio" },
        { clave: "ventas", ruta: "ventas.html", texto: "Ventas" },
        { clave: "almacen", ruta: "almacen.html", texto: "Inventario" },
        { clave: "reportes", ruta: "reportes.html", texto: "Reportes" },
        { clave: "proveedores", ruta: "provedores.html", texto: "Proveedores" },
    ];

    /* Subtítulo de la cabecera por página. */
    const SUBTITULOS = {
        inicio: "Panel de administración e inventario",
        almacen: "Módulo de gestión de inventario",
        ventas: "Módulo de registro y procesamiento de ventas",
        reportes: "Módulo de analítica y reportes",
        proveedores: "Módulo de administración de proveedores",
        copia_de_seguridad: "Módulo de copia de seguridad",
    };

    /* Deduce la página activa a partir del archivo abierto.
     * La copia de seguridad está en el pie del menú, no en la lista
     * principal: se reconoce para poner su subtítulo, pero no se marca
     * ninguna opción del menú como activa. */
    function paginaActual() {
        const archivo = window.location.pathname.split("/").pop() || "";
        const encontrada = PAGINAS.find((p) => p.ruta === archivo);
        if (encontrada) return encontrada.clave;
        return archivo === "copia_de_seguridad.html" ? "copia_de_seguridad" : "";
    }

    function plantillaSidebar(activa) {
        const botones = PAGINAS.map(
            (p) => `
            <button class="nav-item ${p.clave === activa ? "nav-item-activa" : ""}"
                    type="button" data-ruta="${p.ruta}">${p.texto}</button>`
        ).join("");

        return `
            <div class="sidebar-brand">
                <div class="logo-circulo">
                    <img src="${LOGO}" alt="Logo Tienda Alexander">
                </div>
                <div>
                    <h2>GestiónApp</h2>
                    <p>Control principal</p>
                </div>
            </div>

            <nav class="sidebar-nav" aria-label="Navegación del panel">
                ${botones}
            </nav>

            <div class="sidebar-footer">
                <button class="nav-item nav-item-secundario" type="button"
                        id="btnCopiaSeguridad">Copia de seguridad</button>
            </div>`;
    }

    function plantillaCabecera(subtitulo, usuario) {
        return `
            <div class="marca">
                <div class="logo-circulo">
                    <img src="${LOGO}" alt="Logo Tienda">
                </div>
                <div>
                    <h2>Gestión de Tienda Alexander</h2>
                    <p>${subtitulo}</p>
                </div>
            </div>

            
            <div class="acciones-superior">
                <div class="ajustes-wrapper">
                    <button id="botonAjustes" class="boton boton-secundario"
                            type="button" aria-expanded="false" aria-controls="menuAjustes">
                        ⚙ Ajustes
                    </button>
                    <div id="menuAjustes" class="menu-ajustes oculto" role="menu">
                        <button id="cerrarSesionAjustes" class="menu-ajuste-item"
                                type="button" role="menuitem">Cerrar sesión</button>
                        <button id="cambiarCuentaAjustes" class="menu-ajuste-item"
                                type="button" role="menuitem">Cambiar cuenta</button>
                        <button id="cambiarContrasenaAjustes" class="menu-ajuste-item"
                                type="button" role="menuitem">Cambiar contraseña</button>
                        <button id="verPerfilesAjustes" class="menu-ajuste-item"
                                type="button" role="menuitem">Ver perfiles</button>
                        <button id="eliminarCuentaAjustes" class="menu-ajuste-item"
                                type="button" role="menuitem">Eliminar cuenta</button>
                    </div>
                </div>
                <span id="usuarioAdminValor" class="etiqueta-perfil">
                    Usuario: ${App.fmt.texto(usuario)}
                </span>
            </div>`;
    }

/* ---------- Ajustes ----------
     * Estas acciones se generan desde aquí porque aparecen en todas las
     * páginas con el sidebar. Los formularios viven en un <div> que se
     * inyecta una sola vez en el body.
     */
    function plantillasModales() {
        return `
        <div id="modalCambiarClave" class="modal modal-oculto" aria-hidden="true">
            <div class="modal-contenido">
                <div class="modal-cabecera">
                    <h3>Cambiar contraseña</h3>
                    <button id="cerrarModalCambiarClave" class="boton-cerrar" type="button"
                            aria-label="Cerrar">&times;</button>
                </div>

                <form id="formCambiarClave" class="form-producto">
                    <div class="form-row">
                        <label for="claveActual">Contraseña actual</label>
                        <input type="password" id="claveActual" autocomplete="current-password" required>
                    </div>
                    <div class="form-row">
                        <label for="claveNueva">Nueva contraseña</label>
                        <input type="password" id="claveNueva" autocomplete="new-password" required>
                    </div>
                    <div class="form-row">
                        <label for="claveRepetida">Repetir nueva contraseña</label>
                        <input type="password" id="claveRepetida" autocomplete="new-password" required>
                    </div>

                    <p id="mensajeCambiarClave" class="mensaje"></p>
                    <div class="modal-acciones">
                        <button type="button" id="btnCancelarCambiarClave" class="btn-pill btn-pill-oscuro">Cancelar</button>
                        <button type="submit" class="btn-pill btn-pill-menta">Guardar contraseña</button>
                    </div>
                </form>
            </div>
        </div>

        <div id="modalUsuarios" class="modal modal-oculto" aria-hidden="true">
            <div class="modal-contenido">
                <div class="modal-cabecera">
                    <h3>Usuarios del sistema</h3>
                    <button id="cerrarModalUsuarios" class="boton-cerrar" type="button"
                            aria-label="Cerrar">&times;</button>
                </div>

                <div class="tabla-panel">
                    <table class="tabla">
                        <thead>
                            <tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Creado</th></tr>
                        </thead>
                        <tbody id="tablaUsuarios"></tbody>
                    </table>
                    <div id="mensajeSinUsuarios" class="estado-vacio">No hay usuarios.</div>
                </div>

                <div class="modal-acciones">
                    <button type="button" id="btnCerrarUsuarios" class="btn-pill btn-pill-oscuro">Cerrar</button>
                </div>
            </div>
        </div>`;
    }

    function asegurarModales() {
        if (document.getElementById("modalCambiarClave")) return;
        const contenedor = document.createElement("div");
        contenedor.innerHTML = plantillasModales();
        while (contenedor.firstChild) {
            document.body.appendChild(contenedor.firstChild);
        }
    }

    async function enviarCambioClave(evento) {
        evento.preventDefault();

        const actual = document.getElementById("claveActual").value;
        const nueva = document.getElementById("claveNueva").value;
        const repetida = document.getElementById("claveRepetida").value;
        const mensaje = document.getElementById("mensajeCambiarClave");

        if (nueva.length < 4) {
            App.ui.mensaje(mensaje, "La nueva contraseña debe tener al menos 4 caracteres.", "error");
            return;
        }
        if (nueva !== repetida) {
            App.ui.mensaje(mensaje, "Las dos contraseñas nuevas no coinciden.", "error");
            return;
        }

        try {
            const r = await App.api.cambiarClave(actual, nueva);
            App.ui.mensaje(mensaje, r.mensaje || "Contraseña actualizada.", "exito");
            evento.target.reset();
            setTimeout(() => App.ui.cerrar("modalCambiarClave"), 1200);
        } catch (err) {
            App.ui.mensaje(mensaje, err.message, "error");
        }
    }

    async function mostrarUsuarios() {
        try {
            const lista = await App.api.usuarios();
            App.ui.pintarTabla(
                "tablaUsuarios",
                "mensajeSinUsuarios",
                lista,
                (u) => `
                    <tr>
                        <td>${App.fmt.texto(u.nombre)}</td>
                        <td>${App.fmt.texto(u.usuario)}</td>
                        <td>${App.fmt.texto(u.rol)}</td>
                        <td>${App.fmt.fechaHora(u.creado_en)}</td>
                    </tr>`
            );
            App.ui.abrir("modalUsuarios");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    /* Menú de ajustes: abrir/cerrar y cierre al pulsar fuera. */
    function conectarAjustes() {
        const boton = document.getElementById("botonAjustes");
        const menu = document.getElementById("menuAjustes");
        if (!boton || !menu) return;

        asegurarModales();

        boton.addEventListener("click", (evento) => {
            evento.stopPropagation();
            menu.classList.toggle("oculto");
            boton.setAttribute("aria-expanded", String(!menu.classList.contains("oculto")));
        });

        document.addEventListener("click", (evento) => {
            if (!menu.contains(evento.target) && !boton.contains(evento.target)) {
                menu.classList.add("oculto");
                boton.setAttribute("aria-expanded", "false");
            }
        });

        document.getElementById("cerrarSesionAjustes").addEventListener("click", () => {
            App.auth.cerrar();
        });

        document.getElementById("cambiarCuentaAjustes").addEventListener("click", () => {
            App.auth.cerrar();
        });

        document.getElementById("cambiarContrasenaAjustes").addEventListener("click", () => {
            App.ui.abrir("modalCambiarClave");
        });

        document.getElementById("verPerfilesAjustes").addEventListener("click", mostrarUsuarios);

        // Los dos "x" de las cabeceras nuevas.
        document.getElementById("cerrarModalCambiarClave").addEventListener("click", () => {
            document.getElementById("formCambiarClave").reset();
            App.ui.mensaje(document.getElementById("mensajeCambiarClave"), "");
            App.ui.cerrar("modalCambiarClave");
        });

        document.getElementById("cerrarModalUsuarios").addEventListener("click", () => {
            App.ui.cerrar("modalUsuarios");
        });

        // Listar usuarios es una operación de ADMIN: el servidor responde 403
        // a un vendedor, así que el botón se oculta en vez de dejar un
        // mensaje de error tras cada clic.
        if (!App.auth.esAdmin()) {
            const itemUsuarios = document.getElementById("verPerfilesAjustes");
            if (itemUsuarios) itemUsuarios.remove();
        }

        document
            .getElementById("formCambiarClave")
            .addEventListener("submit", enviarCambioClave);

        document.getElementById("btnCancelarCambiarClave").addEventListener("click", () => {
            document.getElementById("formCambiarClave").reset();
            App.ui.mensaje(document.getElementById("mensajeCambiarClave"), "");
            App.ui.cerrar("modalCambiarClave");
        });

        document.getElementById("btnCerrarUsuarios").addEventListener("click", () => {
            App.ui.cerrar("modalUsuarios");
        });

        App.ui.cerrarAlTocarFondo("modalCambiarClave");
        App.ui.cerrarAlTocarFondo("modalUsuarios");

        document
            .getElementById("eliminarCuentaAjustes")
            .addEventListener("click", eliminarCuenta);
    }

    /* Borrar la cuenta es irreversible y afecta al acceso al sistema, así
     * que se pide confirmación explícita con el nombre de la cuenta. El
     * servidor impide además quedarse sin ningún administrador. */
    async function eliminarCuenta() {
        const usuario = App.auth.actual();
        if (!usuario) return;

        const escrito = window.prompt(
            "Esto eliminará la cuenta '" +
                usuario.usuario +
                "' de forma permanente.\n" +
                "Si ya tiene ventas registradas, el sistema no lo permitirá.\n" +
                "Escribe tu nombre de usuario para confirmar:"
        );
        if (escrito === null) return;

        if (escrito.trim().toLowerCase() !== usuario.usuario.toLowerCase()) {
            App.ui.aviso("El nombre no coincide. La cuenta no se eliminó.");
            return;
        }

        try {
            await App.api.eliminarCuenta();
            App.auth.limpiar();
            window.location.href = "login.html";
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    /* Monta sidebar y cabecera, y conecta la navegación. */
    function montar() {
        if (!App.auth.exigir()) return false;

        const activa = paginaActual();
        const usuario = App.auth.actual();

        const sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.innerHTML = plantillaSidebar(activa);

        const cabecera = document.getElementById("barraSuperior");
        if (cabecera) {
            cabecera.innerHTML = plantillaCabecera(
                SUBTITULOS[activa] || SUBTITULOS.inicio,
                usuario.nombre || usuario.usuario
            );
        }

        // Navegación: antes cada botón llevaba su propio onclick.
        if (sidebar) {
            sidebar.querySelectorAll(".nav-item[data-ruta]").forEach((boton) => {
                boton.addEventListener("click", () => {
                    window.location.href = boton.dataset.ruta;
                });
            });

            const btnCopia = document.getElementById("btnCopiaSeguridad");
            if (btnCopia) {
                btnCopia.addEventListener("click", () => {
                    window.location.href = "copia_de_seguridad.html";
                });
            }
        }

        conectarAjustes();
        return true;
    }

    return { montar, paginaActual };
})();
