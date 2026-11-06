window.App = window.App || {};

App.layout = (function () {
    const LOGO = "https://i.postimg.cc/XqZdZjvF/logo-TD.jpg";

    const PAGINAS = [
        { clave: "inicio", ruta: "inicio.html", texto: "Inicio" },
        { clave: "ventas", ruta: "ventas.html", texto: "Ventas" },
        {
            clave: "almacen",
            texto: "Producto",
            submenu: true,
            items: [
                { clave: "almacen", ruta: "almacen.html", texto: "Gestión de productos" },
                { clave: "stock", ruta: "stock.html", texto: "Stock" },
            ],
        },
        { clave: "reportes", ruta: "reportes.html", texto: "Reportes" },
        { clave: "proveedores", ruta: "provedores.html", texto: "Proveedores" },
    ];

    const SUBTITULOS = {
        inicio: "Panel de administración e inventario",
        almacen: "Módulo de gestión de productos",
        stock: "Módulo de recarga y control de stock",
        ventas: "Módulo de registro y procesamiento de ventas",
        reportes: "Módulo de analítica y reportes",
        proveedores: "Módulo de administración de proveedores",
        copia_de_seguridad: "Copia de seguridad",
    };

    function iconoMenu(clave) {
        return (App.iconos && App.iconos[clave]) || "";
    }

    function paginaActual() {
        const archivo = window.location.pathname.split("/").pop() || "";
        const encontrada = PAGINAS.find((p) => {
            if (p.submenu) {
                return p.items.some((i) => i.ruta === archivo);
            }
            return p.ruta === archivo;
        });
        if (encontrada) {
            if (encontrada.submenu) {
                const itemActivo = encontrada.items.find((i) => i.ruta === archivo);
                return itemActivo ? itemActivo.clave : encontrada.clave;
            }
            return encontrada.clave;
        }
        return archivo === "copia_de_seguridad.html" ? "copia_de_seguridad" : "";
    }

    function plantillaSidebar(activa, esAdmin) {
        const botones = PAGINAS.map((p) => {
            if (p.submenu) {
                const tieneActivo = p.items.some((i) => i.clave === activa);
                const itemsHtml = p.items
                    .map(
                        (i) => `
                    <button class="nav-subitem ${i.clave === activa ? "nav-subitem-activo" : ""}"
                            type="button" data-ruta="${i.ruta}">
                        <span class="nav-texto">${i.texto}</span>
                    </button>`
                    )
                    .join("");

                return `
                <div class="nav-dropdown ${tieneActivo ? "nav-dropdown-abierto active" : ""}">
                    <button class="nav-item nav-item-dropdown ${tieneActivo ? "nav-item-activa" : ""}"
                            type="button" data-dropdown="${p.clave}" aria-expanded="${tieneActivo}">
                        <span class="nav-icono" aria-hidden="true">${iconoMenu(p.clave)}</span>
                        <span class="nav-texto">${p.texto}</span>
                        <span class="nav-flecha" aria-hidden="true">${iconoMenu("chevronDown")}</span>
                    </button>
                    <div class="nav-submenu">
                        ${itemsHtml}
                    </div>
                </div>`;
            }

            return `
            <button class="nav-item ${p.clave === activa ? "nav-item-activa" : ""}"
                    type="button" data-ruta="${p.ruta}">
                <span class="nav-icono" aria-hidden="true">${iconoMenu(p.clave)}</span>
                <span class="nav-texto">${p.texto}</span>
            </button>`;
        }).join("");

        const bloqueCopia = esAdmin
            ? `
            <div class="sidebar-footer">
                <button class="nav-item nav-item-secundario ${activa === "copia_de_seguridad" ? "nav-item-activa" : ""}" type="button"
                        id="btnCopiaSeguridad">
                    <span class="nav-icono" aria-hidden="true">${iconoMenu("copia_de_seguridad")}</span>
                    <span class="nav-texto">Copia de seguridad</span>
                </button>
            </div>`
            : "";

        return `
            <div class="sidebar-brand">
                <div class="logo-circulo">
                    <img src="${LOGO}" alt="Logo Tienda Alexander">
                </div>
                <div class="sidebar-marca-texto">
                    <h2>GestiónApp</h2>
                    <p>Control principal</p>
                </div>
            </div>

            <nav class="sidebar-nav" aria-label="Navegación del panel">
                ${botones}
            </nav>

            ${bloqueCopia}`;
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
                        ${iconoMenu("settings")}
                        <span>Ajustes</span>
                    </button>
                    <div id="menuAjustes" class="menu-ajustes oculto" role="menu">
                        <button id="cambiarContrasenaAjustes" class="menu-ajuste-item"
                                type="button" role="menuitem">
                            ${iconoMenu("key")}
                            <span>Cambiar contraseña</span>
                        </button>
                        <button id="verPerfilesAjustes" class="menu-ajuste-item"
                                type="button" role="menuitem">
                            ${iconoMenu("users")}
                            <span>Gestión de usuarios</span>
                        </button>
                        <button id="eliminarCuentaAjustes" class="menu-ajuste-item"
                                type="button" role="menuitem">
                            ${iconoMenu("trash")}
                            <span>Eliminar mi cuenta</span>
                        </button>
                        <button id="cerrarSesionAjustes" class="menu-ajuste-item"
                                type="button" role="menuitem">
                            ${iconoMenu("logout")}
                            <span>Cerrar sesión</span>
                        </button>
                    </div>
                </div>
                <span id="usuarioAdminValor" class="etiqueta-perfil">
                    ${iconoMenu("user")}
                    <span>Usuario: ${App.fmt.texto(usuario)}</span>
                </span>
            </div>`;
    }

    function plantillasModales() {
        const ojo = iconoMenu("eye");
        return `
        <div id="modalCambiarClave" class="modal modal-oculto" aria-hidden="true">
            <div class="modal-contenido">
                <div class="modal-cabecera">
                    <h3>Cambiar contraseña</h3>
                    <button id="cerrarModalCambiarClave" class="boton-cerrar" type="button"
                            aria-label="Cerrar">&times;</button>
                </div>

                <p id="avisoCambioObligatorio" class="aviso-seguridad" hidden>
                    Tu administrador restableció esta contraseña. Debes cambiarla antes de continuar.
                </p>
                <form id="formCambiarClave" class="form-producto">
                    <div class="form-row">
                        <label for="claveActual">Contraseña actual</label>
                        <div class="campo-password">
                            <input type="password" id="claveActual" autocomplete="current-password" required>
                            <button type="button" class="btn-ver-password" data-target="claveActual"
                                    aria-label="Mostrar contraseña" title="Mostrar contraseña">${ojo}</button>
                        </div>
                    </div>
                    <div class="form-row">
                        <label for="claveNueva">Nueva contraseña</label>
                        <div class="campo-password">
                            <input type="password" id="claveNueva" autocomplete="new-password" required>
                            <button type="button" class="btn-ver-password" data-target="claveNueva"
                                    aria-label="Mostrar contraseña" title="Mostrar contraseña">${ojo}</button>
                        </div>
                    </div>
                    <div class="form-row">
                        <label for="claveRepetida">Repetir nueva contraseña</label>
                        <div class="campo-password">
                            <input type="password" id="claveRepetida" autocomplete="new-password" required>
                            <button type="button" class="btn-ver-password" data-target="claveRepetida"
                                    aria-label="Mostrar contraseña" title="Mostrar contraseña">${ojo}</button>
                        </div>
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
            <div class="modal-contenido" style="max-width: 960px;">
                <div class="modal-cabecera">
                    <h3>Usuarios del sistema</h3>
                    <button id="cerrarModalUsuarios" class="boton-cerrar" type="button"
                            aria-label="Cerrar">&times;</button>
                </div>

                <div class="tabla-panel">
                    <table class="tabla">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Usuario</th>
                                <th>Teléfono</th>
                                <th>Rol</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="tablaUsuarios"></tbody>
                    </table>
                    <div id="mensajeSinUsuarios" class="estado-vacio">No hay usuarios.</div>
                </div>

                <div class="modal-acciones">
                    <button type="button" id="btnNuevoUsuarioModal" class="btn-pill btn-pill-menta">+ Crear usuario</button>
                    <button type="button" id="btnCerrarUsuarios" class="btn-pill btn-pill-oscuro">Cerrar</button>
                </div>
            </div>
        </div>

        <div id="modalDetalleUsuario" class="modal modal-oculto" aria-hidden="true">
            <div class="modal-contenido">
                <div class="modal-cabecera">
                    <h3>Detalles del usuario</h3>
                    <button id="cerrarDetalleUsuario" class="boton-cerrar" type="button"
                            aria-label="Cerrar">&times;</button>
                </div>
                <dl id="datosDetalleUsuario" class="datos-perfil"></dl>
                <p id="mensajeDetalleUsuario" class="mensaje"></p>
                <div class="modal-acciones">
                    <button id="btnRestablecerClaveUsuario" type="button"
                            class="btn-pill btn-pill-menta">Restablecer contraseña</button>
                    <button id="btnCerrarDetalleUsuario" type="button"
                            class="btn-pill btn-pill-oscuro">Cerrar</button>
                </div>
            </div>
        </div>

        <div id="modalRestablecerClave" class="modal modal-oculto" aria-hidden="true">
            <div class="modal-contenido">
                <div class="modal-cabecera">
                    <h3>Restablecer contraseña</h3>
                    <button id="cerrarRestablecerClave" class="boton-cerrar" type="button"
                            aria-label="Cerrar">&times;</button>
                </div>
                <form id="formRestablecerClave" class="form-producto">
                    <p>Confirma tu contraseña actual de administrador. Se generará una clave temporal que solo se mostrará una vez y que el usuario deberá cambiar al iniciar sesión.</p>
                    <div class="form-row">
                        <label for="claveAdminActual">Tu contraseña actual</label>
                        <div class="campo-password">
                            <input id="claveAdminActual" type="password"
                                   autocomplete="current-password" required>
                            <button type="button" class="btn-ver-password" data-target="claveAdminActual"
                                    aria-label="Mostrar contraseña" title="Mostrar contraseña">${ojo}</button>
                        </div>
                    </div>
                    <p id="mensajeRestablecerClave" class="mensaje"></p>
                    <div id="resultadoClaveTemporal" class="resultado-clave oculto">
                        <strong>Clave temporal (solo se muestra esta vez):</strong>
                        <code id="claveTemporalUsuario"></code>
                        <p>Entrégala al usuario por un canal seguro. No la guardes ni la compartas públicamente.</p>
                    </div>
                    <div class="modal-acciones">
                        <button id="btnCancelarRestablecerClave" type="button"
                                class="btn-pill btn-pill-oscuro">Cancelar</button>
                        <button id="btnConfirmarRestablecerClave" type="submit"
                                class="btn-pill btn-pill-menta">Generar clave temporal</button>
                    </div>
                </form>
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
            const r = await App.api.cambiarClave(actual, nueva, repetida);
            App.ui.mensaje(mensaje, r.mensaje || "Contraseña actualizada.", "exito");
            evento.target.reset();
            const usuario = App.auth.actual();
            if (usuario) {
                usuario.debe_cambiar_clave = false;
                App.auth.guardar(null, usuario);
            }
            const modal = document.getElementById("modalCambiarClave");
            modal.dataset.obligatorio = "false";
            document.getElementById("cerrarModalCambiarClave").hidden = false;
            document.getElementById("btnCancelarCambiarClave").hidden = false;
            document.getElementById("avisoCambioObligatorio").hidden = true;
            setTimeout(() => App.ui.cerrar("modalCambiarClave"), 1200);
        } catch (err) {
            App.ui.mensaje(mensaje, err.message, "error");
        }
    }

    async function mostrarDetalleUsuario(id) {
        try {
            const usuario = await App.api.usuario(id);
            const usuarioActual = App.auth.actual();
            const estado = usuario.activo
                ? (usuario.bloqueado ? `Activo (bloqueado, nivel ${usuario.nivel_bloqueo})` : "Activo")
                : "Inactivo";
            document.getElementById("datosDetalleUsuario").innerHTML = `
                <dt>Nombre completo</dt><dd>${App.fmt.texto(usuario.nombre) || "—"}</dd>
                <dt>Nombre de usuario</dt><dd>${App.fmt.texto(usuario.usuario)}</dd>
                <dt>Teléfono</dt><dd>${App.fmt.texto(usuario.telefono) || "—"}</dd>
                <dt>Rol</dt><dd>${App.fmt.texto(usuario.rol)}</dd>
                <dt>Fecha de registro</dt><dd>${App.fmt.texto(App.fmt.fechaHora(usuario.creado_en)) || "—"}</dd>
                <dt>Estado</dt><dd>${App.fmt.texto(estado)}</dd>`;
            const botonRestablecer = document.getElementById("btnRestablecerClaveUsuario");
            botonRestablecer.dataset.id = String(id);
            botonRestablecer.hidden = Boolean(usuarioActual && usuarioActual.id === id);
            App.ui.mensaje(document.getElementById("mensajeDetalleUsuario"), "");
            App.ui.abrir("modalDetalleUsuario");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    async function enviarRestablecimientoClave(evento) {
        evento.preventDefault();
        const boton = document.getElementById("btnRestablecerClaveUsuario");
        const id = Number(boton.dataset.id);
        const claveAdmin = document.getElementById("claveAdminActual").value;
        const mensaje = document.getElementById("mensajeRestablecerClave");
        if (!id || !claveAdmin) {
            App.ui.mensaje(mensaje, "Confirma tu contraseña actual.", "error");
            return;
        }

        try {
            const respuesta = await App.api.restablecerClaveUsuario(id, claveAdmin);
            document.getElementById("claveAdminActual").value = "";
            document.getElementById("claveTemporalUsuario").textContent =
                respuesta.clave_temporal;
            document.getElementById("resultadoClaveTemporal").classList.remove("oculto");
            document.getElementById("btnConfirmarRestablecerClave").hidden = true;
            App.ui.mensaje(mensaje, respuesta.mensaje, "exito");
        } catch (err) {
            App.ui.mensaje(mensaje, err.message, "error");
        }
    }

    function abrirRestablecerClave() {
        document.getElementById("formRestablecerClave").reset();
        document.getElementById("resultadoClaveTemporal").classList.add("oculto");
        document.getElementById("claveTemporalUsuario").textContent = "";
        document.getElementById("btnConfirmarRestablecerClave").hidden = false;
        App.ui.mensaje(document.getElementById("mensajeRestablecerClave"), "");
        App.ui.abrir("modalRestablecerClave");
    }

    async function cargarYRenderizarUsuarios() {
        const actual = App.auth.actual();
        const lista = await App.api.usuarios();

        App.ui.pintarTabla(
            "tablaUsuarios",
            "mensajeSinUsuarios",
            lista,
            (u) => {
                let estadoBadge = '<span class="badge disponible">Activo</span>';
                if (!u.activo) {
                    estadoBadge = '<span class="badge agotado">Inactivo</span>';
                } else if (u.bloqueado) {
                    estadoBadge = `<span class="badge agotado">Bloqueado (N${u.nivel_bloqueo})</span>`;
                }

                const botones = [];
                if (u.bloqueado) {
                    botones.push(
                        `<button class="btn-accion" data-accion-usuario="desbloquear" data-id="${u.id}">Desbloquear</button>`
                    );
                }
                if (!actual || u.id !== actual.id) {
                    const textoToggle = u.activo ? "Desactivar" : "Activar";
                    const claseExtra = u.activo ? "eliminar" : "";
                    botones.push(
                        `<button class="btn-accion ${claseExtra}" data-accion-usuario="estado" data-id="${u.id}" data-activo="${u.activo ? "0" : "1"}">${textoToggle}</button>`
                    );
                    botones.push(
                        `<button class="btn-accion eliminar" data-accion-usuario="eliminar" data-id="${u.id}">Eliminar</button>`
                    );
                }

                return `
                    <td><button class="enlace-usuario" type="button" data-detalle-usuario="${u.id}">${App.fmt.texto(u.nombre)}</button></td>
                    <td><button class="enlace-usuario" type="button" data-detalle-usuario="${u.id}"><strong>${App.fmt.texto(u.usuario)}</strong></button></td>
                    <td>${App.fmt.texto(u.telefono) || "—"}</td>
                    <td>${App.fmt.texto(u.rol)}</td>
                    <td>${estadoBadge}</td>
                    <td class="acciones-tabla">${botones.join(" ") || "—"}</td>`;
            }
        );
    }

    async function mostrarUsuarios() {
        try {
            await cargarYRenderizarUsuarios();
            App.ui.abrir("modalUsuarios");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

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

        document.getElementById("cambiarContrasenaAjustes").addEventListener("click", () => {
            App.ui.abrir("modalCambiarClave");
        });

        document.getElementById("verPerfilesAjustes").addEventListener("click", mostrarUsuarios);

        document.getElementById("cerrarModalCambiarClave").addEventListener("click", () => {
            if (document.getElementById("modalCambiarClave").dataset.obligatorio === "true") {
                return;
            }
            document.getElementById("formCambiarClave").reset();
            App.ui.mensaje(document.getElementById("mensajeCambiarClave"), "");
            App.ui.cerrar("modalCambiarClave");
        });
        document.getElementById("btnCancelarCambiarClave").addEventListener("click", () => {
            if (document.getElementById("modalCambiarClave").dataset.obligatorio === "true") {
                return;
            }
            document.getElementById("formCambiarClave").reset();
            App.ui.mensaje(document.getElementById("mensajeCambiarClave"), "");
            App.ui.cerrar("modalCambiarClave");
        });

        document.getElementById("cerrarModalUsuarios").addEventListener("click", () => {
            App.ui.cerrar("modalUsuarios");
        });
        document.getElementById("cerrarDetalleUsuario").addEventListener("click", () => {
            App.ui.cerrar("modalDetalleUsuario");
        });
        document.getElementById("btnCerrarDetalleUsuario").addEventListener("click", () => {
            App.ui.cerrar("modalDetalleUsuario");
        });
        document.getElementById("btnRestablecerClaveUsuario").addEventListener("click", () => {
            abrirRestablecerClave();
        });
        document.getElementById("cerrarRestablecerClave").addEventListener("click", () => {
            App.ui.cerrar("modalRestablecerClave");
        });
        document.getElementById("btnCancelarRestablecerClave").addEventListener("click", () => {
            App.ui.cerrar("modalRestablecerClave");
        });
        document.getElementById("formRestablecerClave").addEventListener(
            "submit",
            enviarRestablecimientoClave
        );

        const btnNuevoUsuario = document.getElementById("btnNuevoUsuarioModal");
        if (btnNuevoUsuario) {
            btnNuevoUsuario.addEventListener("click", () => {
                window.location.href = "agregar_usuario.html";
            });
        }

        const tablaUsuarios = document.getElementById("tablaUsuarios");
        if (tablaUsuarios) {
            tablaUsuarios.addEventListener("click", async (evento) => {
                const enlaceDetalle = evento.target.closest("[data-detalle-usuario]");
                if (enlaceDetalle) {
                    await mostrarDetalleUsuario(Number(enlaceDetalle.dataset.detalleUsuario));
                    return;
                }
                const btn = evento.target.closest("[data-accion-usuario]");
                if (!btn) return;
                const id = Number(btn.dataset.id);
                const accion = btn.dataset.accionUsuario;
                try {
                    if (accion === "desbloquear") {
                        const r = await App.api.desbloquearUsuario(id);
                        App.ui.aviso(r.mensaje || "Usuario desbloqueado.");
                    } else if (accion === "estado") {
                        const nuevoActivo = btn.dataset.activo === "1";
                        const r = await App.api.cambiarEstadoUsuario(id, nuevoActivo);
                        App.ui.aviso(r.mensaje || "Estado actualizado.");
                    } else if (accion === "eliminar") {
                        const confirmado = App.ui.confirmar(
                            "¿Eliminar esta cuenta de forma permanente? " +
                            "Las cuentas con ventas registradas no se pueden eliminar."
                        );
                        if (!confirmado) return;
                        const r = await App.api.eliminarUsuario(id);
                        App.ui.aviso(r.mensaje || "Usuario eliminado.");
                    }
                    await cargarYRenderizarUsuarios();
                } catch (err) {
                    App.ui.aviso(err.message);
                }
            });
        }

        if (!App.auth.esAdmin()) {
            const itemUsuarios = document.getElementById("verPerfilesAjustes");
            if (itemUsuarios) itemUsuarios.remove();
        }

        document
            .getElementById("formCambiarClave")
            .addEventListener("submit", enviarCambioClave);

        document.getElementById("btnCerrarUsuarios").addEventListener("click", () => {
            App.ui.cerrar("modalUsuarios");
        });

        App.ui.cerrarAlTocarFondo("modalCambiarClave");
        App.ui.cerrarAlTocarFondo("modalUsuarios");
        App.ui.cerrarAlTocarFondo("modalDetalleUsuario");
        App.ui.cerrarAlTocarFondo("modalRestablecerClave");

        const usuarioActual = App.auth.actual();
        if (usuarioActual && usuarioActual.debe_cambiar_clave) {
            const modalClave = document.getElementById("modalCambiarClave");
            modalClave.dataset.obligatorio = "true";
            document.getElementById("cerrarModalCambiarClave").hidden = true;
            document.getElementById("btnCancelarCambiarClave").hidden = true;
            document.getElementById("avisoCambioObligatorio").hidden = false;
            App.ui.abrir("modalCambiarClave");
        }

        document
            .getElementById("eliminarCuentaAjustes")
            .addEventListener("click", eliminarCuenta);
    }

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
            window.location.href = "Login.html";
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    function conectarSidebar(sidebar) {
        if (!sidebar) return;

        const escritorio = window.matchMedia("(min-width: 961px)");
        const MARGEN_BORDE = 24;
        let enElBorde = false;

        const desplegar = (valor) => {
            if (valor === enElBorde) return;
            enElBorde = valor;
            sidebar.classList.toggle("sidebar-expandida", valor);
        };

        document.addEventListener("mousemove", (evento) => {
            if (!escritorio.matches) {
                desplegar(false);
                return;
            }
            const limite = sidebar.getBoundingClientRect().right + MARGEN_BORDE;
            desplegar(evento.clientX <= limite);
        });

        document.addEventListener("mouseleave", () => desplegar(false));
        window.addEventListener("blur", () => desplegar(false));

        sidebar.addEventListener(
            "touchstart",
            () => desplegar(!enElBorde),
            { passive: true }
        );

        escritorio.addEventListener("change", (evento) => {
            if (!evento.matches) desplegar(false);
        });

        sidebar.querySelectorAll("[data-dropdown]").forEach((boton) => {
            boton.addEventListener("click", (evento) => {
                evento.stopPropagation();
                const dropdown = boton.closest(".nav-dropdown");
                if (!dropdown) return;

                dropdown.classList.toggle("nav-dropdown-abierto");
                dropdown.classList.toggle("active");
                boton.setAttribute(
                    "aria-expanded",
                    String(
                        dropdown.classList.contains("nav-dropdown-abierto") ||
                            dropdown.classList.contains("active")
                    )
                );
            });
        });

        document.addEventListener("click", (evento) => {
            if (!sidebar.contains(evento.target)) {
                sidebar
                    .querySelectorAll(".nav-dropdown-abierto, .nav-dropdown.active")
                    .forEach((dropdown) => {
                        dropdown.classList.remove("nav-dropdown-abierto");
                        dropdown.classList.remove("active");
                        const boton = dropdown.querySelector("[data-dropdown]");
                        if (boton) boton.setAttribute("aria-expanded", "false");
                    });
            }
        });
    }

    function montar() {
        if (!App.auth.exigir()) return false;

        const activa = paginaActual();
        const usuario = App.auth.actual();
        const esAdmin = App.auth.esAdmin();

        const sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.innerHTML = plantillaSidebar(activa, esAdmin);

        const cabecera = document.getElementById("barraSuperior");
        if (cabecera) {
            cabecera.innerHTML = plantillaCabecera(
                SUBTITULOS[activa] || SUBTITULOS.inicio,
                usuario.nombre || usuario.usuario
            );
        }

        if (sidebar) {
            sidebar.querySelectorAll(".nav-item[data-ruta]").forEach((boton) => {
                boton.addEventListener("click", () => {
                    window.location.href = boton.dataset.ruta;
                });
            });

            sidebar.querySelectorAll(".nav-subitem[data-ruta]").forEach((boton) => {
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

            conectarSidebar(sidebar);
        }

        conectarAjustes();
        return true;
    }

    return { montar, paginaActual };
})();
