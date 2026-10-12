/* Núcleo compartido del frontend.
 *
 * Antes de unificar, cada página repetía su propio bloque de fetch con
 * `${API_URL}/...`, su propio try/catch, su propio formateo de dinero y su
 * propio par abrir/cerrar de modales (había cuatro pares casi idénticos).
 * Aquí vive una sola implementación de cada cosa.
 *
 * Se carga en todas las páginas, antes que layout.js y que el script
 * específico de cada una. No usa módulos ES a propósito, para que las
 * páginas puedan abrirse con doble clic sin servidor de archivos.
 */

window.App = window.App || {};

/* ==========================================
   API — cliente HTTP
   ========================================== */

App.api = (function () {
    const BASE = "http://127.0.0.1:5000/api";

    /* Cuando el servidor responde 401 (token vencido o cerrado desde otro
     * dispositivo) la sesión local ya no sirve: se limpia y se manda a
     * login, para no dejar la pantalla a medias pidiendo datos que el
     * servidor ya no va a dar. */
    let redirigiendo = false;

    function sesionCaida(mensaje) {
        if (redirigiendo) return;
        redirigiendo = true;
        sessionStorage.removeItem("tiendaAlexanderSesion");
        App.ui.aviso(mensaje || "Tu sesión expiró. Vuelve a iniciar sesión.");
        window.location.replace("login.html");
    }

    async function pedir(ruta, opciones = {}) {
        // Sesión de una cuenta creada en este navegador: el token "local" no
        // existe para ningún servidor, así que ni se intenta. Se responde con
        // la demo, que es donde viven los datos de esa sesión.
        if (App.auth.esLocal()) {
            return modoDemo(ruta, opciones);
        }

        // Si ya sabemos que el servidor no está corriendo, se va directo a la
        // demo en vez de esperar el tiempo de espera en cada petición.
        if (window.App.demo && App.demo.sinServidor()) {
            return modoDemo(ruta, opciones);
        }

        const esFormulario = opciones.cuerpo instanceof FormData;

        const config = {
            method: opciones.method || "GET",
            headers: {},
        };

        // Un FormData (subir un archivo) ya lleva su propio Content-Type con
        // el bordeMultipart: ponerlo a mano rompe el archivo.
        if (!esFormulario) config.headers["Content-Type"] = "application/json";

        // El token es lo que el servidor revisa; sin él la API responde 401.
        const token = App.auth.token();
        if (token) {
            config.headers.Authorization = "Bearer " + token;
        }

        if (opciones.cuerpo !== undefined) {
            config.body = opciones.cuerpo;
        } else if (opciones.body !== undefined) {
            config.body = JSON.stringify(opciones.body);
        }

        let respuesta;
        try {
            respuesta = await pedirConTiempo(BASE + ruta, config, App.demo.TIMEOUT_MS);
        } catch (err) {
            // Fallo de red: el servidor no está escuchando. Se cae a la demo.
            // Un 401 o un 403 nunca llegan aquí: esos son del servidor y los
            // maneja el bloque de más abajo.
            if (window.App.demo) {
                App.demo.marcarCaido();
                return modoDemo(ruta, opciones);
            }
            throw new Error(
                "No se pudo conectar con el servidor. ¿Está corriendo " +
                    "'python Backend/server.py'?"
            );
        }

        let datos = {};
        try {
            datos = await respuesta.json();
        } catch (err) {
            // Respuesta sin cuerpo JSON (p.ej. error 500 de Flask).
            throw new Error("El servidor devolvió una respuesta inesperada.");
        }

        if (!respuesta.ok) {
            // Un login fallido también es 401, pero ahí no hay sesión que
            // cerrar: el error se le muestra al usuario tal cual.
            if (respuesta.status === 401 && !ruta.startsWith("/auth/login")) {
                sesionCaida(datos.mensaje);
            }
            throw new Error(datos.mensaje || `Error ${respuesta.status}`);
        }

        return datos;
    }

    /* fetch que no se queda colgada si el puerto está cerrado: sin esto,
     * abrir el sistema sin servidor se queda esperando lo que tarde el
     * sistema operativo en responder. */
    function pedirConTiempo(url, config, ms) {
        if (!window.AbortController) return fetch(url, config);

        const control = new AbortController();
        const temporizador = setTimeout(() => control.abort(), ms);
        return fetch(url, Object.assign({}, config, { signal: control.signal })).finally(
            () => clearTimeout(temporizador)
        );
    }

    /* Puente hacia la API simulada del navegador. */
    async function modoDemo(ruta, opciones) {
        const r = await App.demo.pedir(ruta, { method: opciones.method || "GET", body: opciones.body, cuerpo: opciones.cuerpo });
        if (!App.auth.token()) {
            App.auth.guardar("demo", {
                id: 1, nombre: "Administrador", usuario: "admin", rol: "ADMIN",
            });
        }
        return r;
    }

    return {
        BASE,

        // ---------- Auth ----------
        login: (usuario, clave) =>
            pedir("/auth/login", { method: "POST", body: { usuario, clave } }),
        registro: (datos) =>
            pedir("/auth/registro", { method: "POST", body: datos }),
        logout: () => pedir("/auth/logout", { method: "POST" }),
        cambiarClave: (actual, nueva) =>
            pedir("/auth/cambiar-clave", {
                method: "POST",
                body: { actual, nueva },
            }),
        eliminarCuenta: () => pedir("/auth/cuenta", { method: "DELETE" }),
        usuarios: () => pedir("/usuarios"),

        // ---------- Categorías ----------
        categorias: () => pedir("/categorias"),
        crearCategoria: (nombre) =>
            pedir("/categorias", { method: "POST", body: { nombre } }),

        // ---------- Productos ----------
        productos: () => pedir("/productos"),
        crearProducto: (datos) =>
            pedir("/productos", { method: "POST", body: datos }),
        actualizarProducto: (id, datos) =>
            pedir(`/productos/${id}`, { method: "PUT", body: datos }),
        eliminarProducto: (id) =>
            pedir(`/productos/${id}`, { method: "DELETE" }),

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
        resumenInventario: () => pedir("/inventario/resumen"),

        // ---------- Copias de seguridad ----------
        infoRespaldo: () => pedir("/respaldos/info"),
        restaurarRespaldo: (archivo) => {
            const datos = new FormData();
            datos.append("archivo", archivo);
            return pedir("/respaldos/restaurar", { method: "POST", cuerpo: datos });
        },

        /* Descarga la copia: en el servidor el archivo .db, y en la demo el JSON
         * que ya vive en el navegador.
         *
         * No puede pasar por pedir() porque la respuesta no es JSON sino el
         * archivo en sí: se pide con fetch para poder leer el nombre que
         * propone el servidor. El tiempo de espera y la caída a la demo sí
         * se respetan, como en el resto de la API. */
        descargarRespaldo: async () => {
            const config = {
                headers: { Authorization: `Bearer ${App.auth.token()}` },
            };

            const descargarDemo = async () => {
                const respaldo = await App.demo.exportar();
                App.ui.descargar(
                    new Blob([JSON.stringify(respaldo.datos, null, 2)], {
                        type: "application/json",
                    }),
                    `alexander_demo_${respaldo.datos.generado.replace(/[: ]/g, "-")}.json`
                );
                return true;
            };

            // Ya sabemos que el servidor no está: no se espera el timeout.
            if (window.App.demo && App.demo.sinServidor()) return descargarDemo();

            let r;
            try {
                r = await pedirConTiempo(
                    `${BASE}/respaldos/descargar`,
                    config,
                    App.demo.TIMEOUT_MS
                );
            } catch (err) {
                if (window.App.demo) {
                    App.demo.marcarCaido();
                    return descargarDemo();
                }
                throw new Error(
                    "No se pudo conectar con el servidor para bajar la copia."
                );
            }

            if (r.status === 401) {
                sesionCaida("Tu sesión expiró. Vuelve a iniciar sesión.");
                throw new Error("Sesión no válida o vencida.");
            }
            if (!r.ok) throw new Error("No se pudo generar la copia de seguridad.");

            const nombre = /filename="?([^"]+)"?/.exec(
                r.headers.get("Content-Disposition") || ""
            );

            App.ui.descargar(await r.blob(), nombre ? nombre[1] : "respaldo.db");
            return true;
        },
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

    // Acepta tanto "2026-10-01 14:30:00" (SQLite) como un ISO string.
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

    // Escapa texto antes de meterlo en innerHTML: los nombres de producto
    // vienen del usuario y se renderizan con plantillas.
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
   AUTH — sesión del usuario
   ==========================================
   Las cuentas viven en la tabla `usuarios` del servidor, con hash PBKDF2.
   Aquí solo se guarda el token de sesión y quién está conectado, en
   sessionStorage para que cerrar el navegador lo borre. El token NO da
   acceso por sí solo: el servidor lo revisa en cada petición, así que
   perder la pestaña no es un problema, pero cerrar sesión en cualquier
   sitio sí invalida el token.

   Antes se guardaban usuarios y contraseñas en texto plano dentro de
   localStorage (validacionesUsuario.js).
 */

App.auth = (function () {
    const CLAVE = "tiendaAlexanderSesion";

    function sesion() {
        try {
            return JSON.parse(sessionStorage.getItem(CLAVE)) || null;
        } catch (err) {
            return null;
        }
    }

    function actual() {
        const s = sesion();
        return s ? s.usuario : null;
    }

    function token() {
        const s = sesion();
        return s ? s.token || "" : "";
    }

    function guardar(tokenRecibido, usuario) {
        sessionStorage.setItem(
            CLAVE,
            JSON.stringify({ token: tokenRecibido, usuario })
        );
    }

    function limpiar() {
        sessionStorage.removeItem(CLAVE);
    }

    /* Cierra la sesión avisando al servidor, para que el token deje de
     * servir aunque alguien lo hubiera copiado. Si el servidor no
     * responde, la sesión local se borra igual. */
    async function cerrar() {
        try {
            await App.api.logout();
        } catch (err) {
            // Sin servidor no hay nada que revocar; se limpia igual.
        }
        limpiar();
        window.location.href = "login.html";
    }

    function esAdmin() {
        const usuario = actual();
        return Boolean(usuario && usuario.rol === "ADMIN");
    }

    /* Sesión de una cuenta creada en este mismo navegador (App.cuentas).
     *
     * No hay token de servidor: el token "local" existe solo para que
     * sessionStorage tenga la misma forma que una sesión normal y para que
     * App.api.pedir sepa que debe responder con la demo en vez de enviar
     * ese token a un servidor que lo rechazaría con 401. */
    function guardarLocal(usuario) {
        sessionStorage.setItem(
            CLAVE,
            JSON.stringify({ token: "local", usuario, local: true })
        );
    }

    /* true si la sesión viene de una cuenta local, no de un login real. */
    function esLocal() {
        const s = sesion();
        return Boolean(s && s.local);
    }

    /* Primera línea de toda página protegida. Devuelve true si se puede
     * seguir; si no, ya redirigió a login y el script debe terminar con
     * `if (!App.auth.exigir()) return;` para no seguir trabajando. */
    function exigir() {
        if (!actual() || !token()) {
            limpiar();
            window.location.replace("login.html");
            return false;
        }
        return true;
    }

    return { actual, token, guardar, guardarLocal, esLocal, limpiar, cerrar, esAdmin, exigir };
})();

/* ==========================================
   Cuentas locales — alta de usuarios sin servidor
   ==========================================

   La pantalla de alta se abre desde el login, donde por definición no hay
   sesión. El endpoint /auth/registro es de uso exclusivo del ADMIN, así que
   sin sesión no hay a quién preguntarle: el alta quedaba en un callejón
   sin salida y el botón "Crear usuario" del login rebotaba al login.

   Estas cuentas viven en localStorage y no dependen del servidor. Son lo
   que permite presentar el alta de usuarios sin conexión: se crea la
   cuenta y al momento sirve para entrar.

   Aviso: la clave se guarda en claro, igual que las cuentas de ejemplo de
   la demo. Es una medida para poder presentar sin base de datos, no un
   almacén de claves; en un despliegue real el alta va por /auth/registro
   y la contraseña nunca sale del servidor. */

App.cuentas = (function () {
    const CLAVE = "tiendaAlexanderCuentasLocales";
    const ROL_POR_DEFECTO = "VENDEDOR";

    function normalizar(usuario) {
        return String(usuario || "").trim();
    }

    function todas() {
        try {
            const crudo = JSON.parse(localStorage.getItem(CLAVE));
            return Array.isArray(crudo) ? crudo : [];
        } catch (err) {
            // Almacenamiento vacío o corrupto: se empieza de cero en vez de
            // dejar la pantalla de alta inservible.
            return [];
        }
    }

    function escribir(lista) {
        localStorage.setItem(CLAVE, JSON.stringify(lista));
    }

    function existe(usuario) {
        const buscado = normalizar(usuario).toLowerCase();
        return todas().some((c) => String(c.usuario).toLowerCase() === buscado);
    }

    /* Devuelve la cuenta pública (sin clave) o lanza el motivo del rechazo,
     * que la pantalla muestra tal cual. */
    function crear(datos) {
        const usuario = normalizar(datos.usuario);
        const clave = String(datos.clave || "");
        const nombre = normalizar(datos.nombre) || usuario;

        if (usuario.length < 3) {
            throw new Error("El usuario debe tener al menos 3 caracteres.");
        }
        if (clave.length < 4) {
            throw new Error("La contraseña debe tener al menos 4 caracteres.");
        }
        if (existe(usuario)) {
            throw new Error("Ese usuario ya existe, ingrese otro usuario.");
        }

        const lista = todas();
        const cuenta = {
            id: "local-" + (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
            nombre: nombre,
            usuario: usuario,
            rol: datos.rol === "ADMIN" ? "ADMIN" : ROL_POR_DEFECTO,
            clave: clave,
        };
        lista.push(cuenta);
        escribir(lista);

        return sinClave(cuenta);
    }

    function verificar(usuario, clave) {
        const buscado = normalizar(usuario).toLowerCase();
        const cuenta = todas().find((c) => String(c.usuario).toLowerCase() === buscado);
        if (!cuenta) return null;
        if (String(cuenta.clave) !== String(clave)) return null;
        return sinClave(cuenta);
    }

    /* Busca por nombre sin comprobar la clave: lo usa la demo para saber
     * quién es el usuario de la sesión abierta. */
    function buscar(usuario) {
        const buscado = normalizar(usuario).toLowerCase();
        const cuenta = todas().find((c) => String(c.usuario).toLowerCase() === buscado);
        return cuenta ? sinClave(cuenta) : null;
    }

    /* Lista para mostrar, nunca con las claves. */
    function lista() {
        return todas().map(sinClave);
    }

    function sinClave(cuenta) {
        return {
            id: cuenta.id,
            nombre: cuenta.nombre,
            usuario: cuenta.usuario,
            rol: cuenta.rol,
        };
    }

    function borrarTodas() {
        localStorage.removeItem(CLAVE);
    }

    return { crear, buscar, verificar, lista, existe, borrarTodas };
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

    /* Cierra el modal al pulsar fuera del panel de contenido. */
    function cerrarAlTocarFondo(idModal) {
        const modal = document.getElementById(idModal);
        if (!modal) return;
        modal.addEventListener("click", (evento) => {
            if (evento.target === modal) cerrar(idModal);
        });
    }

    /* ---------- Mensajes en línea ---------- */
    function mensaje(elemento, texto, tipo = "info") {
        if (!elemento) return;
        elemento.textContent = texto;
        elemento.className = `mensaje ${tipo}`.trim();
    }

    /* ---------- Aviso flotante ---------- */
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

    /* ---------- Confirmación ---------- */
    function confirmar(pregunta) {
        return window.confirm(pregunta);
    }

    /* Descarga un archivo generado en el navegador (CSV, respaldo de la
     * demo). El enlace se quita del DOM porque Safari lo ignora si no está. */
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

    /* ---------- Tabla vacía ---------- */
    /* Marca el bloque "no hay registros" de una tabla según corresponda. */
    function estadoVacio(idMensaje, hayFilas) {
        const bloque = document.getElementById(idMensaje);
        if (bloque) bloque.style.display = hayFilas ? "none" : "block";
    }

    /* ---------- Contenido de una tabla ---------- */
    /* Vacia el <tbody>, pinta las filas y resuelve el mensaje de vacío.
     * Todas las tablas del sistema usan el mismo patrón.
     */
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

    /* Limita un panel de tabla a `filasVisibles` filas; el resto se desplaza.
     * Se recalcula según el alto real de las filas para que el corte sea exacto. */
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
   ==========================================
   Se abre en una pestaña aparte y se manda a imprimir, así que el estilo
   va dentro del documento: no alcanza con base.css.

   Es lo más aburrido posible a propósito. Nada de colores fuertes ni
   sombras: tinta negra sobre blanco, una tabla con líneas finas y los
   números alineados a la derecha. Lo que hace que una factura se vea como
   factura es el orden y la legibilidad, no el adorno.

   La usan los dos lados: al cobrar (Frontend/js/pages/ventas.js) y para
   reimprimir una venta desde el reporte.
 */

App.factura = (function () {
    const IVA_PORCENTAJE = 15;

    const METODOS = {
        efectivo: "Efectivo",
        tarjeta: "Tarjeta",
        transferencia: "Transferencia",
    };

    /* La venta recién cobrada viene con `venta_id` y la que se recupera
     * del reporte con `id`. Aquí se normaliza. */
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

        // Una venta siempre trae detalle, pero si algún día no lo trae que
        // se vea una fila en vez de una tabla vacía.
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

    /* Hoja completa. El CSS va incrustado porque esta pestaña no carga
     * ninguna hoja del sistema. */
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

    /* ---------- Encabezado ---------- */

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

    /* ---------- Datos de la venta ---------- */

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

    /* ---------- Tabla ---------- */

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

    /* Las columnas de dinero se leen mucho mejor pegadas a la derecha y con
     * cifras de ancho fijo, para que los decimales queden en columna. */
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    thead .num { text-align: right; }
    tbody td:nth-child(1),
    tbody td:nth-child(3) { width: 1%; }
    tbody td:nth-child(4), tbody td:nth-child(5) { width: 1%; }

    /* ---------- Totales ---------- */

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

    /* ---------- Impresión ---------- */

    @page { margin: 14mm; }

    @media print {
        body { padding: 0; background: #fff; }
        .acciones { display: none; }
        .hoja {
            max-width: none;
            padding: 0;
            border: 0;
        }
        /* Una venta larga no debería partirse a mitad de una fila. */
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

    /* Abre la factura en una pestaña y la manda a imprimir. */
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

        /* Se imprime en el evento load y no enseguida: document.write deja
         * el documento a medio construir, y llamar a print() ahí puede
         * sacar la hoja sin estilos ni con el título todavía vacío. Al
         * esperar, la factura sale tal cual se ve en pantalla. */
        ventana.addEventListener("load", () => {
            ventana.focus();
            ventana.print();
        });

        return true;
    }

    return { imprimir, plantilla };
})();