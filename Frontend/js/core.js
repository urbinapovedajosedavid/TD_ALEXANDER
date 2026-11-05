/* Núcleo compartido del frontend - Tienda Alexander.
 *
 * Persistencia en SQLite y sesiones de servidor mediante cookies HttpOnly
 * respaldadas en la tabla `sesiones` de la base de datos.
 */

window.App = window.App || {};

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
    let _usuarioActual = null;
    let _sesionComprobada = false;

    function verificarSync() {
        if (_sesionComprobada) return _usuarioActual;
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
        _sesionComprobada = true;
        return _usuarioActual;
    }

    async function verificar() {
        try {
            const r = await App.api.yo();
            _usuarioActual = r.usuario || null;
            _sesionComprobada = true;
            return _usuarioActual;
        } catch (e) {
            _usuarioActual = null;
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
        _sesionComprobada = true;
    }

    function limpiar() {
        _usuarioActual = null;
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

/* Delegación global para botones de mostrar/ocultar contraseña (.btn-ver-password) */
document.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".btn-ver-password");
    if (!boton) return;
    const idDestino = boton.getAttribute("data-target");
    const input = idDestino ? document.getElementById(idDestino) : null;
    if (!input) return;

    const esPassword = input.type === "password";
    input.type = esPassword ? "text" : "password";
    boton.textContent = esPassword ? "🙈" : "👁";
    boton.setAttribute(
        "aria-label",
        esPassword ? "Ocultar contraseña" : "Mostrar contraseña"
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
