/* Núcleo compartido del frontend - Tienda Alexander.
 *
 * Persistencia en SQLite y sesiones de servidor mediante cookies HttpOnly
 * respaldadas en la tabla `sesiones` de la base de datos.
 */

window.App = window.App || {};

/* ==========================================
   ICONOS — Iconografía vectorial coherente (Lucide SVG)
   ========================================== */

App.iconos = {
    eye: '<svg class="icono-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    eyeOff: '<svg class="icono-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>',
    inicio: '<svg class="icono-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    ventas: '<svg class="icono-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>',
    almacen: '<svg class="icono-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
    stock: '<svg class="icono-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>',
    reportes: '<svg class="icono-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
    proveedores: '<svg class="icono-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>',
    copia_de_seguridad: '<svg class="icono-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>',
    chevronDown: '<svg class="icono-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    settings: '<svg class="icono-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    search: '<svg class="icono-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    folder: '<svg class="icono-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
    truckSmall: '<svg class="icono-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>',
    user: '<svg class="icono-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    key: '<svg class="icono-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>',
    users: '<svg class="icono-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    trash: '<svg class="icono-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    logout: '<svg class="icono-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
};

/* ==========================================
   API — cliente HTTP RESTful
   ========================================== */

App.api = (function () {
    const BASE =
        window.location.protocol === "file:" ||
        (window.location.port && window.location.port !== "5000")
            ? "http://127.0.0.1:5000/api"
            : "/api";

    let redirigiendo = false;

    function sesionCaida(mensaje) {
        if (redirigiendo) return;
        redirigiendo = true;
        if (App.auth) App.auth.limpiar();
        App.ui.aviso(mensaje || "Tu sesión expiró. Vuelve a iniciar sesión.");
        setTimeout(() => {
            window.location.replace("Login.html");
        }, 1200);
    }

    async function pedir(ruta, opciones = {}) {
        const esFormulario = opciones.cuerpo instanceof FormData;

        const config = {
            method: opciones.method || "GET",
            headers: {},
            credentials: "include",
        };

        if (!esFormulario) {
            config.headers["Content-Type"] = "application/json";
        }

        if (opciones.cuerpo !== undefined) {
            config.body = opciones.cuerpo;
        } else if (opciones.body !== undefined) {
            config.body = JSON.stringify(opciones.body);
        }

        let respuesta;
        try {
            respuesta = await fetch(BASE + ruta, config);
        } catch (err) {
            throw new Error(
                "No se pudo conectar con el servidor. Verifica que 'python app.py' esté ejecutándose."
            );
        }

        let datos = {};
        try {
            datos = await respuesta.json();
        } catch (err) {
            throw new Error("El servidor devolvió una respuesta inesperada.");
        }

        if (!respuesta.ok) {
            if (respuesta.status === 401 && !ruta.startsWith("/auth/login")) {
                sesionCaida(datos.mensaje);
            }
            const error = new Error(datos.mensaje || `Error ${respuesta.status}`);
            error.status = respuesta.status;
            error.datos = datos;
            throw error;
        }

        return datos;
    }

    return {
        BASE,

        // ---------- Autenticación y usuarios ----------
        login: (usuario, clave) =>
            pedir("/auth/login", { method: "POST", body: { usuario, clave } }),
        yo: () => pedir("/auth/yo"),
        logout: () => pedir("/auth/logout", { method: "POST" }),
        cambiarClave: (actual, nueva, confirmacion) =>
            pedir("/auth/cambiar-clave", {
                method: "POST",
                body: { actual, nueva, confirmacion },
            }),
        eliminarCuenta: () => pedir("/auth/cuenta", { method: "DELETE" }),
        registro: (datos) =>
            pedir("/auth/registro", { method: "POST", body: datos }),
        registroPublico: (datos) =>
            pedir("/auth/registro-publico", { method: "POST", body: datos }),
        usuarios: () => pedir("/usuarios"),
        usuario: (id) => pedir(`/usuarios/${id}`),
        desbloquearUsuario: (id) =>
            pedir(`/usuarios/${id}/desbloquear`, { method: "POST" }),
        cambiarEstadoUsuario: (id, activo) =>
            pedir(`/usuarios/${id}/estado`, { method: "PUT", body: { activo } }),
        eliminarUsuario: (id) =>
            pedir(`/usuarios/${id}`, { method: "DELETE" }),
        restablecerClaveUsuario: (id, clave_admin) =>
            pedir(`/usuarios/${id}/restablecer-clave`, {
                method: "POST",
                body: { clave_admin },
            }),

        // ---------- Categorías ----------
        categorias: () => pedir("/categorias"),
        crearCategoria: (nombre) =>
            pedir("/categorias", { method: "POST", body: { nombre } }),

        // ---------- Productos e Inventario ----------
        productos: () => pedir("/productos"),
        crearProducto: (datos) =>
            pedir("/productos", { method: "POST", body: datos }),
        actualizarProducto: (id, datos) =>
            pedir(`/productos/${id}`, { method: "PUT", body: datos }),
        eliminarProducto: (id) =>
            pedir(`/productos/${id}`, { method: "DELETE" }),
        recargarStock: (id, cantidad, precio_entrada) =>
            pedir(`/productos/${id}/recargar`, {
                method: "POST",
                body: { cantidad, precio_entrada },
            }),
        resumenInventario: () => pedir("/inventario/resumen"),

        // ---------- Ventas ----------
        registrarVenta: (datos) =>
            pedir("/ventas", { method: "POST", body: datos }),
        venta: (id) => pedir(`/ventas/${id}`),
        anularVenta: (id) =>
            pedir(`/ventas/${id}/anular`, { method: "POST" }),

        // ---------- Proveedores ----------
        proveedores: () => pedir("/proveedores"),
        crearProveedor: (datos) =>
            pedir("/proveedores", { method: "POST", body: datos }),
        actualizarProveedor: (id, datos) =>
            pedir(`/proveedores/${id}`, { method: "PUT", body: datos }),
        eliminarProveedor: (id) =>
            pedir(`/proveedores/${id}`, { method: "DELETE" }),

        // ---------- Reportes ----------
        reportes: (periodo) => pedir(`/reportes?periodo=${encodeURIComponent(periodo)}`),
        reportesPorFechas: (inicio, fin) =>
            pedir(
                `/reportes?fecha_inicio=${encodeURIComponent(inicio)}` +
                    `&fecha_fin=${encodeURIComponent(fin)}`
            ),
        reportesPorUsuario: (usuarioId, categoriaId = "", inicio = "", fin = "") => {
            const params = new URLSearchParams();
            if (categoriaId) params.set("categoria_id", categoriaId);
            if (inicio) params.set("fecha_inicio", inicio);
            if (fin) params.set("fecha_fin", fin);
            const qs = params.toString();
            return pedir(`/reportes/usuario/${usuarioId}${qs ? "?" + qs : ""}`);
        },

        // ---------- Copias de seguridad ----------
        infoRespaldo: () => pedir("/respaldos/info"),
        restaurarRespaldo: (archivo) => {
            const datos = new FormData();
            datos.append("archivo", archivo);
            return pedir("/respaldos/restaurar", { method: "POST", cuerpo: datos });
        },
        descargarRespaldo: async () => {
            let r;
            try {
                r = await fetch(`${BASE}/respaldos/descargar`, {
                    credentials: "include",
                });
            } catch (err) {
                throw new Error("No se pudo conectar con el servidor para descargar la copia.");
            }

            if (r.status === 401) {
                sesionCaida("Tu sesión expiró. Vuelve a iniciar sesión.");
                throw new Error("Sesión no válida o vencida.");
            }
            if (!r.ok) {
                throw new Error("No se pudo generar la copia de seguridad.");
            }

            const nombre = /filename="?([^"]+)"?/.exec(
                r.headers.get("Content-Disposition") || ""
            );
            App.ui.descargar(await r.blob(), nombre ? nombre[1] : "respaldo.db");
            return true;
        },
    };
})();

/* ==========================================
   AUTH — Sesión del usuario en el Servidor
   ========================================== */

App.auth = (function () {
    const CLAVE_CACHE = "alexander_usuario_cache";
    let _usuarioActual = null;
    let _sesionComprobada = false;

    function _leerCache() {
        try {
            const guardado = sessionStorage.getItem(CLAVE_CACHE);
            if (guardado) return JSON.parse(guardado);
        } catch (e) {}
        return null;
    }

    function _escribirCache(usuario) {
        try {
            if (usuario) {
                sessionStorage.setItem(CLAVE_CACHE, JSON.stringify(usuario));
            } else {
                sessionStorage.removeItem(CLAVE_CACHE);
            }
        } catch (e) {}
    }

    function verificarSync() {
        if (_sesionComprobada) return _usuarioActual;
        const enCache = _leerCache();
        if (enCache) {
            _usuarioActual = enCache;
            _sesionComprobada = true;
            // Revalida en segundo plano de forma asíncrona sin bloquear la interfaz
            verificar();
            return _usuarioActual;
        }
        try {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", App.api.BASE + "/auth/yo", false);
            xhr.withCredentials = true;
            xhr.send(null);
            if (xhr.status === 200) {
                const respuesta = JSON.parse(xhr.responseText);
                _usuarioActual = respuesta.usuario || null;
            } else {
                _usuarioActual = null;
            }
        } catch (e) {
            _usuarioActual = null;
        }
        _escribirCache(_usuarioActual);
        _sesionComprobada = true;
        return _usuarioActual;
    }

    async function verificar() {
        try {
            const r = await App.api.yo();
            _usuarioActual = r.usuario || null;
            _escribirCache(_usuarioActual);
            _sesionComprobada = true;
            return _usuarioActual;
        } catch (e) {
            _usuarioActual = null;
            _escribirCache(null);
            _sesionComprobada = true;
            return null;
        }
    }

    function actual() {
        if (!_sesionComprobada) {
            verificarSync();
        }
        return _usuarioActual;
    }

    function guardar(_tokenIgnorado, usuario) {
        _usuarioActual = usuario;
        _escribirCache(usuario);
        _sesionComprobada = true;
    }

    function limpiar() {
        _usuarioActual = null;
        _escribirCache(null);
        _sesionComprobada = true;
    }

    async function cerrar() {
        try {
            await App.api.logout();
        } catch (err) {}
        limpiar();
        window.location.href = "Login.html";
    }

    function esAdmin() {
        const u = actual();
        return Boolean(u && u.rol === "ADMIN");
    }

    function exigir() {
        const u = actual();
        if (!u) {
            limpiar();
            window.location.replace("Login.html");
            return false;
        }
        return true;
    }

    return {
        actual,
        guardar,
        limpiar,
        cerrar,
        esAdmin,
        exigir,
        verificar,
    };
})();

/* ==========================================
   FMT — formateo para mostrar
   ========================================== */

App.fmt = (function () {
    function dinero(valor) {
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return "C$0.00";
        return (
            "C$" +
            numero.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })
        );
    }

    function entero(valor) {
        const numero = Number(valor);
        return Number.isFinite(numero) ? String(numero) : "0";
    }

    function fechaHora(valor) {
        if (!valor) return "";
        const fecha = new Date(String(valor).replace(" ", "T"));
        if (Number.isNaN(fecha.getTime())) return String(valor);
        return fecha.toLocaleString("es-NI", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function texto(valor) {
        if (valor === null || valor === undefined) return "";
        return String(valor)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    return { dinero, entero, fechaHora, texto };
})();

/* ==========================================
   UI — modales, avisos, contraseñas y tablas
   ========================================== */

App.ui = (function () {
    function abrir(idModal) {
        const modal = document.getElementById(idModal);
        if (!modal) return null;
        modal.classList.remove("modal-oculto");
        modal.classList.add("modal-activo");
        modal.setAttribute("aria-hidden", "false");
        return modal;
    }

    function cerrar(idModal) {
        const modal = document.getElementById(idModal);
        if (!modal) return;
        modal.classList.add("modal-oculto");
        modal.classList.remove("modal-activo");
        modal.setAttribute("aria-hidden", "true");
    }

    function cerrarAlTocarFondo(idModal) {
        const modal = document.getElementById(idModal);
        if (!modal) return;
        modal.addEventListener("click", (evento) => {
            if (evento.target === modal && modal.dataset.obligatorio !== "true") {
                cerrar(idModal);
            }
        });
    }

    function mensaje(elemento, texto, tipo = "info") {
        if (!elemento) return;
        elemento.textContent = texto;
        elemento.className = `mensaje ${tipo}`.trim();
    }

    function aviso(texto) {
        let toast = document.getElementById("toastApp");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "toastApp";
            toast.className = "toast";
            toast.setAttribute("role", "status");
            document.body.appendChild(toast);
        }

        toast.textContent = texto;
        toast.classList.add("toast-visible");

        clearTimeout(toast._temporizador);
        toast._temporizador = setTimeout(() => {
            toast.classList.remove("toast-visible");
        }, 3200);
    }

    function confirmar(pregunta) {
        return window.confirm(pregunta);
    }

    function descargar(blob, nombre) {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombre;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        URL.revokeObjectURL(url);
    }

    function estadoVacio(idMensaje, hayFilas) {
        const bloque = document.getElementById(idMensaje);
        if (bloque) bloque.style.display = hayFilas ? "none" : "block";
    }

    function pintarTabla(idTabla, idMensajeVacio, filas, plantillaFila) {
        const cuerpo = document.getElementById(idTabla);
        if (!cuerpo) return;

        cuerpo.innerHTML = "";
        estadoVacio(idMensajeVacio, filas.length > 0);

        filas.forEach((fila) => {
            const tr = document.createElement("tr");
            tr.innerHTML = plantillaFila(fila);
            cuerpo.appendChild(tr);
        });
    }

    function ajustarAlturaTabla(idPanel, idCuerpo, filasVisibles) {
        const maximo = filasVisibles || 5;
        const panel = document.getElementById(idPanel);
        const cuerpo = document.getElementById(idCuerpo);
        if (!panel || !cuerpo) return;

        const filas = cuerpo.querySelectorAll("tr");
        if (filas.length <= maximo) {
            panel.style.maxHeight = "";
            return;
        }

        const cabecera = panel.querySelector("thead");
        let alto = cabecera ? cabecera.offsetHeight : 0;
        for (let i = 0; i < maximo; i++) {
            alto += filas[i].offsetHeight;
        }
        panel.style.maxHeight = `${alto}px`;
    }

    return {
        abrir,
        cerrar,
        cerrarAlTocarFondo,
        mensaje,
        aviso,
        confirmar,
        descargar,
        estadoVacio,
        pintarTabla,
        ajustarAlturaTabla,
    };
})();

/* Inicializar y delegar botones de mostrar/ocultar contraseña (.btn-ver-password) */
function inicializarBotonesPassword(raiz = document) {
    raiz.querySelectorAll(".btn-ver-password").forEach((boton) => {
        if (!boton.querySelector("svg")) {
            boton.innerHTML = App.iconos.eye;
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    inicializarBotonesPassword(document);
});

document.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".btn-ver-password");
    if (!boton) return;
    const idDestino = boton.getAttribute("data-target");
    const input = idDestino ? document.getElementById(idDestino) : null;
    if (!input) return;

    const mostrar = input.type === "password";
    input.type = mostrar ? "text" : "password";
    boton.innerHTML = mostrar ? App.iconos.eyeOff : App.iconos.eye;
    boton.setAttribute(
        "aria-label",
        mostrar ? "Ocultar contraseña" : "Mostrar contraseña"
    );
    boton.setAttribute(
        "title",
        mostrar ? "Ocultar contraseña" : "Mostrar contraseña"
    );
});

/* ==========================================
   FACTURA — apertura de factura.html
   ========================================== */

App.factura = (function () {
    function imprimir(venta) {
        const id = venta.venta_id !== undefined ? venta.venta_id : venta.id;
        try {
            sessionStorage.setItem("factura_actual", JSON.stringify(venta));
        } catch (e) {}

        const ventana = window.open(`factura.html?id=${encodeURIComponent(id)}`, "_blank");
        if (!ventana) {
            App.ui.aviso("Permite las ventanas emergentes del navegador para ver la factura.");
            return false;
        }
        return true;
    }

    return { imprimir };
})();
