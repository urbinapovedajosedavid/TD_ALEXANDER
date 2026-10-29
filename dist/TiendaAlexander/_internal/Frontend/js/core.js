/* Núcleo compartido del frontend - Tienda Alexander.
 *
 * Arquitectura segura con persistencia exclusiva en SQLite y autenticación en servidor.
 * PROHIBIDO el uso de localStorage y sessionStorage para datos sensibles, credenciales o tokens.
 * La sesión se gestiona estrictamente en el backend mediante cookies HttpOnly cifradas.
 */

window.App = window.App || {};

/* ==========================================
   API — cliente HTTP RESTful
   ========================================== */

App.api = (function () {
    const BASE = (window.location.protocol === "file:" || !window.location.port)
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
            credentials: "include", // Envía automáticamente la cookie HttpOnly de sesión de Flask
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
        cambiarClave: (actual, nueva) =>
            pedir("/auth/cambiar-clave", {
                method: "POST",
                body: { actual, nueva },
            }),
        eliminarCuenta: () => pedir("/auth/cuenta", { method: "DELETE" }),
        registro: (datos) =>
            pedir("/auth/registro", { method: "POST", body: datos }),
        registroPublico: (datos) =>
            pedir("/auth/registro-publico", { method: "POST", body: datos }),
        usuarios: () => pedir("/usuarios"),

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
        recargarStock: (id, cantidad) =>
            pedir(`/productos/${id}/recargar`, { method: "POST", body: { cantidad } }),
        resumenInventario: () => pedir("/inventario/resumen"),

        // ---------- Ventas ----------
        registrarVenta: (datos) =>
            pedir("/ventas", { method: "POST", body: datos }),
        venta: (id) => pedir(`/ventas/${id}`),

        // ---------- Proveedores ----------
        proveedores: () => pedir("/proveedores"),
        crearProveedor: (datos) =>
            pedir("/proveedores", { method: "POST", body: datos }),
        eliminarProveedor: (id) =>
            pedir(`/proveedores/${id}`, { method: "DELETE" }),

        // ---------- Reportes ----------
        reportes: (periodo) => pedir(`/reportes?periodo=${periodo}`),
        reportesPorFechas: (inicio, fin) =>
            pedir(
                `/reportes?fecha_inicio=${encodeURIComponent(inicio)}` +
                    `&fecha_fin=${encodeURIComponent(fin)}`
            ),
        reportesPorUsuario: (usuarioId) =>
            pedir(`/reportes/usuario/${usuarioId}`),

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
   ==========================================
   CERO LocalStorage / CERO SessionStorage.
   El estado del usuario se mantiene en memoria durante la navegación
   y se valida directamente contra el servidor mediante cookies HttpOnly.
*/

App.auth = (function () {
    let _usuarioActual = null;
    let _sesionComprobada = false;

    function verificarSync() {
        if (_sesionComprobada) return _usuarioActual;
        try {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", App.api.BASE + "/auth/yo", false); // síncrono para bloqueo inicial de render
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

    function token() {
        // Cero tokens almacenados en el cliente; autenticación por cookie de sesión
        return "";
    }

    function guardar(tokenIgnorado, usuario) {
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

    function esLocal() {
        return false;
    }

    function guardarLocal() {}

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
        token,
        guardar,
        limpiar,
        cerrar,
        esAdmin,
        esLocal,
        guardarLocal,
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
   UI — modales, avisos y tablas
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
            if (evento.target === modal) cerrar(idModal);
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

/* ==========================================
   FACTURA — hoja imprimible de una venta
   ========================================== */

App.factura = (function () {
    const IVA_PORCENTAJE = 15;

    const METODOS = {
        efectivo: "Efectivo",
        tarjeta: "Tarjeta",
        transferencia: "Transferencia",
    };

    function numero(venta) {
        return venta.venta_id !== undefined ? venta.venta_id : venta.id;
    }

    function metodo(valor) {
        return METODOS[valor] || App.fmt.texto(valor) || "—";
    }

    function detalle(venta) {
        const items = venta.items || [];

        if (items.length) {
            return items
                .map(
                    (i, n) => `
                    <tr>
                        <td class="num">${n + 1}</td>
                        <td>${App.fmt.texto(i.nombre)}</td>
                        <td class="num">${App.fmt.entero(i.cantidad)}</td>
                        <td class="num">${App.fmt.dinero(i.precio_unitario)}</td>
                        <td class="num">${App.fmt.dinero(i.subtotal)}</td>
                    </tr>`
                )
                .join("");
        }

        return `
            <tr>
                <td class="num">1</td>
                <td>Sin detalle de productos</td>
                <td class="num">—</td>
                <td class="num">—</td>
                <td class="num">C${App.fmt.dinero(venta.total)}</td>
            </tr>`;
    }

    function unidades(venta) {
        return (venta.items || []).reduce((s, i) => s + Number(i.cantidad || 0), 0);
    }

    function plantilla(venta) {
        const total = venta.total !== undefined ? venta.total : venta.subtotal;
        const id = numero(venta);

        return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Factura ${App.fmt.entero(id)}</title>
<style>
    * { box-sizing: border-box; }

    body {
        margin: 0;
        padding: 24px;
        background: #eceff3;
        color: #1a1a1a;
        font: 13px/1.5 "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    .hoja {
        max-width: 760px;
        margin: 0 auto;
        padding: 40px 44px;
        background: #fff;
        border: 1px solid #d9dee5;
    }

    .encabezado {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        padding-bottom: 18px;
        border-bottom: 2px solid #1a1a1a;
    }

    .negocio { font-size: 19px; font-weight: 700; letter-spacing: .2px; }
    .negocio small {
        display: block;
        margin-top: 3px;
        font-size: 11px;
        font-weight: 400;
        color: #6b7280;
    }

    .doc { text-align: right; white-space: nowrap; }
    .doc .tipo {
        font-size: 11px;
        letter-spacing: 1.6px;
        text-transform: uppercase;
        color: #6b7280;
    }
    .doc .folio { font-size: 23px; font-weight: 700; }

    .datos {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 40px;
        padding: 16px 0 22px;
        font-size: 12px;
    }

    .datos p { margin: 0; }
    .datos b {
        margin-left: 6px;
        font-weight: 600;
    }

    table { width: 100%; border-collapse: collapse; }

    thead th {
        padding: 9px 10px;
        background: #f4f6f8;
        border-bottom: 1px solid #1a1a1a;
        border-top: 1px solid #1a1a1a;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: .7px;
        text-transform: uppercase;
        text-align: left;
    }

    tbody td {
        padding: 9px 10px;
        border-bottom: 1px solid #e3e7ec;
        vertical-align: top;
    }

    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    thead .num { text-align: right; }
    tbody td:nth-child(1),
    tbody td:nth-child(3) { width: 1%; }
    tbody td:nth-child(4), tbody td:nth-child(5) { width: 1%; }

    .cierre {
        display: flex;
        justify-content: flex-end;
        margin-top: 22px;
    }

    .totales { width: 290px; }

    .totales div {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        padding: 6px 10px;
    }

    .totales .sub { color: #4b5563; }
    .totales .iva { border-bottom: 1px solid #cbd2da; }

    .totales .gran {
        margin-top: 4px;
        padding: 11px 10px;
        background: #f4f6f8;
        border-top: 2px solid #1a1a1a;
        border-bottom: 2px solid #1a1a1a;
        font-size: 16px;
        font-weight: 700;
    }

    .acciones {
        max-width: 760px;
        margin: 0 auto 14px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }

    .acciones button {
        padding: 8px 16px;
        font: inherit;
        font-size: 12px;
        border: 1px solid #b9c1cb;
        border-radius: 6px;
        background: #fff;
        color: #1a1a1a;
        cursor: pointer;
    }

    .acciones .primario {
        background: #1a1a1a;
        border-color: #1a1a1a;
        color: #fff;
    }

    @page { margin: 14mm; }

    @media print {
        body { padding: 0; background: #fff; }
        .acciones { display: none; }
        .hoja {
            max-width: none;
            padding: 0;
            border: 0;
        }
        tr { page-break-inside: avoid; }
        thead { display: table-header-group; }
    }
</style>
</head>
<body>
<div class="acciones">
    <button type="button" onclick="window.close()">Cerrar</button>
    <button type="button" class="primario" onclick="window.print()">Imprimir</button>
</div>

<main class="hoja">
    <header class="encabezado">
        <div class="negocio">
            Tienda Alexander
            <small>Ventas e inventario</small>
        </div>
        <div class="doc">
            <div class="tipo">Factura</div>
            <div class="folio">#C${App.fmt.entero(id)}</div>
        </div>
    </header>

    <section class="datos">
        <p>Fecha<b>${App.fmt.fechaHora(venta.fecha) || "—"}</b></p>
        <p>Método de pago<b>${metodo(venta.metodo_pago)}</b></p>
        <p>Atendió<b>${App.fmt.texto(venta.vendedor) || "—"}</b></p>
        <p>Artículos<b>${App.fmt.entero(unidades(venta))}</b></p>
    </section>

    <table>
        <thead>
            <tr>
                <th class="num">#</th>
                <th>Producto</th>
                <th class="num">Cant.</th>
                <th class="num">Precio</th>
                <th class="num">Importe</th>
            </tr>
        </thead>
        <tbody>${detalle(venta)}</tbody>
    </table>

    <section class="cierre">
        <div class="totales">
            <div class="sub">
                <span>Subtotal</span>
                <span>${App.fmt.dinero(venta.subtotal)}</span>
            </div>
            <div class="sub iva">
                <span>IVA (${IVA_PORCENTAJE}%)</span>
                <span>${App.fmt.dinero(venta.impuesto)}</span>
            </div>
            <div class="gran">
                <span>Total</span>
                <span>${App.fmt.dinero(total)}</span>
            </div>
        </div>
    </section>
</main>
</body>
</html>`;
    }

    function imprimir(venta) {
        const ventana = window.open("", "_blank");
        if (!ventana) {
            App.ui.aviso(
                "Permite las ventanas emergentes del navegador para ver la factura."
            );
            return false;
        }

        ventana.document.write(plantilla(venta));
        ventana.document.close();

        ventana.addEventListener("load", () => {
            ventana.focus();
            ventana.print();
        });

        return true;
    }

    return { imprimir, plantilla };
})();
