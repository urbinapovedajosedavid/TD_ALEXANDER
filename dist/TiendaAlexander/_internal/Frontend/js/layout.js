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

    /* Ícono de cada opción. El sidebar colapsado muestra solo estos. */
    const ICONOS = {
        inicio: "🏠",
        ventas: "💰",
        almacen: "📦",
        stock: "📊",
        reportes: "📈",
        proveedores: "🚚",
        copia_de_seguridad: "💾",
    };

    /* Subtítulo de la cabecera por página. */
    const SUBTITULOS = {
        inicio: "Panel de administración e inventario",
        almacen: "Módulo de gestión de productos",
        stock: "Módulo de recarga y control de stock",
        ventas: "Módulo de registro y procesamiento de ventas",
        reportes: "Módulo de analítica y reportes",
        proveedores: "Módulo de administración de proveedores",
        copia_de_seguridad: "Copia de seguridad",
    };

    
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

    function plantillaSidebar(activa) {
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
                        <span class="nav-icono" aria-hidden="true">${ICONOS[p.clave] || "•"}</span>
                        <span class="nav-texto">${p.texto}</span>
                        <span class="nav-flecha" aria-hidden="true">▾</span>
                    </button>
                    <div class="nav-submenu">
                        ${itemsHtml}
                    </div>
                </div>`;
            }

            return `
            <button class="nav-item ${p.clave === activa ? "nav-item-activa" : ""}"
                    type="button" data-ruta="${p.ruta}">
                <span class="nav-icono" aria-hidden="true">${ICONOS[p.clave] || "•"}</span>
                <span class="nav-texto">${p.texto}</span>
            </button>`;
        }).join("");

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

            <div class="sidebar-footer">
                <button class="nav-item nav-item-secundario" type="button"
                        id="btnCopiaSeguridad">
                    <span class="nav-icono" aria-hidden="true">${ICONOS.copia_de_seguridad}</span>
                    <span class="nav-texto">Copia de seguridad</span>
                </button>
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
                                type="button" role="menuitem">Cambiar de cuenta</button>
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


        <div id="modalConfig" class="modal modal-oculto" aria-hidden="true">
            <div class="modal-contenido">
                <div class="modal-cabecera">
                    <h3>Configuración visual (por perfil)</h3>
                    <button id="cerrarModalConfig" class="boton-cerrar" type="button" aria-label="Cerrar">&times;</button>
                </div>
                <form id="formConfig" class="form-producto">
                    <div class="form-row">
                        <label for="cfgFondo">Color de fondo (hex)</label>
                        <input type="color" id="cfgFondo" value="#f7fffc">
                    </div>
                    <div class="form-row">
                        <label for="cfgTexto">Color de texto (hex)</label>
                        <input type="color" id="cfgTexto" value="#1f3f4a">
                    </div>
                    <div class="form-row">
                        <label for="cfgTamaño">Tamaño de letra base (%)</label>
                        <input type="range" id="cfgTamaño" min="90" max="110" step="1" value="100">
                        <small id="cfgTamañoVal">100%</small>
                    </div>
                    <div class="form-row">
                        <label for="cfgRadio">Radio de bordes</label>
                        <select id="cfgRadio">
                            <option value="8">Suave (8px)</option>
                            <option value="12" selected>Normal (12px)</option>
                            <option value="16">Redondeado (16px)</option>
                            <option value="20">Más redondeado (20px)</option>
                        </select>
                    </div>
                    <p id="mensajeConfig" class="mensaje"></p>
                    <div class="modal-acciones">
                        <button type="button" id="btnResetConfig" class="btn-pill btn-pill-oscuro">Restaurar</button>
                        <button type="submit" class="btn-pill btn-pill-menta">Guardar por perfil</button>
                    </div>
                </form>
            </div>
        </div>        <div id="modalUsuarios" class="modal modal-oculto" aria-hidden="true">
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
    function getConfigKey() {
        const u = App.auth && App.auth.actual ? App.auth.actual() : null;
        if (u && u.usuario) return "tdalex_config_" + u.usuario;
        return "tdalex_config_global";
    }

    function cargarConfigVisual() {
        try {
            const key = getConfigKey();
            const raw = null; 
            if (!raw) return;
            const cfg = JSON.parse(raw);
            aplicarConfigVisual(cfg);
        } catch (e) {}
    }

    function aplicarConfigVisual(cfg) {
        if (!cfg) return;
        const root = document.documentElement;
        if (cfg.fondo) {
            root.style.setProperty("--fondo", cfg.fondo);
            root.style.setProperty("--fondo-app", cfg.fondo);
        }
        if (cfg.texto) root.style.setProperty("--texto", cfg.texto);
        if (cfg.tamaño) root.style.setProperty("--font-size-base", cfg.tamaño + "%");
        if (cfg.radio) root.style.setProperty("--border-radius", cfg.radio + "px");
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

        document.getElementById("cerrarModalCambiarClave").addEventListener("click", () => {
            document.getElementById("formCambiarClave").reset();
            App.ui.mensaje(document.getElementById("mensajeCambiarClave"), "");
            App.ui.cerrar("modalCambiarClave");
        });

        document.getElementById("cerrarModalUsuarios").addEventListener("click", () => {
            App.ui.cerrar("modalUsuarios");
        });

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

        // Manejo de dropdowns
        sidebar.querySelectorAll("[data-dropdown]").forEach((boton) => {
            boton.addEventListener("click", (evento) => {
                evento.stopPropagation();
                const dropdown = boton.closest(".nav-dropdown");
                if (!dropdown) return;

                const estaAbierto = dropdown.classList.contains("nav-dropdown-abierto") || dropdown.classList.contains("active");
                dropdown.classList.toggle("nav-dropdown-abierto");
                dropdown.classList.toggle("active");
                boton.setAttribute("aria-expanded", String(dropdown.classList.contains("nav-dropdown-abierto") || dropdown.classList.contains("active")));
            });
        });

        // Cerrar dropdowns al hacer clic fuera
        document.addEventListener("click", (evento) => {
            if (!sidebar.contains(evento.target)) {
                sidebar.querySelectorAll(".nav-dropdown-abierto, .nav-dropdown.active").forEach((dropdown) => {
                    dropdown.classList.remove("nav-dropdown-abierto");
                    dropdown.classList.remove("active");
                    const boton = dropdown.querySelector("[data-dropdown]");
                    if (boton) boton.setAttribute("aria-expanded", "false");
                });
            }
        });
    }

    function montar() {
        cargarConfigVisual();
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

        if (sidebar) {
            sidebar.querySelectorAll(".nav-item[data-ruta]").forEach((boton) => {
                boton.addEventListener("click", () => {
                    window.location.href = boton.dataset.ruta;
                });
            });

            sidebar.querySelectorAll(".nav-subitem[data-ruta]").forEach((boton) => {
                boton.addEventListener("click", () => {
                    if (boton.dataset.ruta === "#") {
                        const txt = boton.querySelector(".nav-texto").textContent;
                        if (txt.includes("Estilo") || txt.includes("Fondo")) App.layout.abrirConfig("estilo");
                        else if (txt.includes("Tamaño")) App.layout.abrirConfig("fuente");
                        else if (txt.includes("Contraste")) App.layout.abrirConfig("contraste");
                        else App.layout.abrirConfig();
                        return;
                    }
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

    function abrirConfig(preferido) {
        asegurarModales();
        const modal = document.getElementById("modalConfig");
        if (!modal) return;
        const key = getConfigKey();
        try {
            const raw = null; 
            if (raw) {
                const cfg = JSON.parse(raw);
                if (cfg.fondo) document.getElementById("cfgFondo").value = cfg.fondo;
                if (cfg.texto) document.getElementById("cfgTexto").value = cfg.texto;
                if (cfg.tamaño) {
                    document.getElementById("cfgTamaño").value = cfg.tamaño;
                    document.getElementById("cfgTamañoVal").textContent = cfg.tamaño + "%";
                }
                if (cfg.radio) document.getElementById("cfgRadio").value = cfg.radio;
            }
        } catch (e) {}
        document.getElementById("mensajeConfig").textContent = "";
        App.ui.abrir("modalConfig");

        const foco = {
            estilo: "cfgFondo",
            fuente: "cfgTamaño",
            contraste: "cfgTexto",
        }[preferido];
        if (foco) {
            const campo = document.getElementById(foco);
            if (campo) setTimeout(function () { campo.focus(); }, 120);
        }

        document.getElementById("formConfig").onsubmit = function (e) {
            e.preventDefault();
            guardarConfig();
        };
        document.getElementById("btnResetConfig").onclick = resetConfig;
        document.getElementById("cfgTamaño").oninput = function () {
            document.getElementById("cfgTamañoVal").textContent = this.value + "%";
        };
        const cerrar = document.getElementById("cerrarModalConfig");
        if (cerrar) cerrar.onclick = function () {
            App.ui.cerrar("modalConfig");
        };
        App.ui.cerrarAlTocarFondo("modalConfig");
    }

    function guardarConfig() {
        const cfg = {
            fondo: document.getElementById("cfgFondo").value,
            texto: document.getElementById("cfgTexto").value,
            tamaño: parseInt(document.getElementById("cfgTamaño").value),
            radio: document.getElementById("cfgRadio").value,
        };
        
        aplicarConfigVisual(cfg);
        document.getElementById("mensajeConfig").textContent =
            "Configuración guardada para este perfil.";
        setTimeout(function () {
            App.ui.cerrar("modalConfig");
        }, 800);
    }

    function resetConfig() {
        const key = getConfigKey();
        
        document.documentElement.style.removeProperty("--fondo");
        document.documentElement.style.removeProperty("--fondo-app");
        document.documentElement.style.removeProperty("--texto");
        document.documentElement.style.removeProperty("--font-size-base");
        document.documentElement.style.removeProperty("--border-radius");
        document.getElementById("cfgFondo").value = "#f7fffc";
        document.getElementById("cfgTexto").value = "#1f3f4a";
        document.getElementById("cfgTamaño").value = "100";
        document.getElementById("cfgTamañoVal").textContent = "100%";
        document.getElementById("cfgRadio").value = "12";
        document.getElementById("mensajeConfig").textContent =
            "Restaurado a valores por defecto.";
    }

    return { montar, paginaActual, abrirConfig, cargarConfigVisual };
})();