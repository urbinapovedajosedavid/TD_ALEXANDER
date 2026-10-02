/* Modo demostración: una API simulada dentro del navegador.
 *
 * Sirve para abrir el sistema sin tener Flask corriendo: cuando una
 * petición falla porque el servidor no responde, App.api delega aquí en
 * lugar de mostrar un error, y todo el sistema sigue siendo usable con los
 * datos guardados en localStorage.
 *
 * IMPORTANTE — esto no es una puerta trasera al servidor real:
 *   - Solo entra en juego cuando el servidor NO responde (error de red).
 *     Si el servidor contesta con 401 o 403, es el servidor quien decide.
 *   - El token de demo es una cadena local: el servidor real no la conoce,
 *     así que si arrancas Flask con esta sesión abierta, la API la
 *     rechaza con 401 y se vuelve al login.
 *
 * Los datos de la demo son de mentira y no se mezclan con los de SQLite.
 * Para volver a los de verdad, borra la clave de localStorage desde la
 * consola o usa el botón "Restablecer demo" de Copia de seguridad.
 */

window.App = window.App || {};

App.demo = (function () {
    const CLAVE_DATOS = "tiendaAlexanderDemo";

    /* Tiempo que se espera esta respuesta del servidor antes de asumir
     * que no está corriendo. Después se reintenta cada REINTENTO_MS. */
    const TIMEOUT_MS = 1500;
    const REINTENTO_MS = 30000;

    let caidoEn = 0; // marca de tiempo del último fallo de red

    /* ---------- Persistencia ---------- */

    function datosIniciales() {
        // Los contadores arrancan DESPUÉS del último id sembrado: si no, el
        // primer producto nuevo en crearse pisaría al primero de ejemplo.
        return {
            siguienteId: { usuario: 2, categoria: 4, producto: 5, venta: 1, proveedor: 2 },
            /* Una sola cuenta, como se pidió para la demostración. Los permisos
             * por rol igual se respetan: si alguien crea un vendedor desde
             * Ajustes, ese usuario sí queda sin acceso a las áreas de admin. */
            usuarios: [
                { id: 1, nombre: "Administrador", usuario: "admin", rol: "ADMIN", clave: "admin" },
            ],
            categorias: [
                { id: 1, nombre: "Alimentos" },
                { id: 2, nombre: "Electrónica" },
                { id: 3, nombre: "Electrodomésticos" },
            ],
            productos: [
                { id: 1, codigo_barra: "7501234567890", nombre: "Licuadora", precio: 450, stock: 12, categoria_id: 3 },
                { id: 2, codigo_barra: "7509876543210", nombre: "Microondas", precio: 320.5, stock: 8, categoria_id: 3 },
                { id: 3, codigo_barra: "7505555555555", nombre: "Arroz 5lb", precio: 95.75, stock: 24, categoria_id: 1 },
                { id: 4, codigo_barra: "7504444444444", nombre: "Detergente", precio: 120, stock: 0, categoria_id: 1 },
            ],
            proveedores: [
                {
                    id: 1, nombre: "Distribuidora Alexander", telefono: "8888-8888",
                    cedula: "001-000000-0000A", direccion: "Calle 1", departamento: "Managua",
                },
            ],
            ventas: [],
        };
    }

    function cargar() {
        try {
            const crudo = localStorage.getItem(CLAVE_DATOS);
            if (!crudo) return sembrar();
            const d = JSON.parse(crudo);
            if (!d || !Array.isArray(d.productos)) return sembrar();
            return d;
        } catch (err) {
            return sembrar();
        }
    }

    function sembrar() {
        const d = datosIniciales();
        localStorage.setItem(CLAVE_DATOS, JSON.stringify(d));
        return d;
    }

    function reiniciar() {
        localStorage.removeItem(CLAVE_DATOS);
        sembrar();
    }

    function escribir(d) {
        localStorage.setItem(CLAVE_DATOS, JSON.stringify(d));
    }

    /* ---------- Respaldos ----------

     * En la demo los datos ya viven en el navegador, así que "descargar un
     * respaldo" es exportarlos y "restaurar" es importarlos: las dos
     * mitades reales de lo que hace el servidor con el archivo .db. */

    function exportar() {
        const d = cargar();
        return {
            exito: true,
            datos: {
                generado: ahora(),
                version: "demo",
                categorias: d.categorias,
                productos: d.productos,
                ventas: d.ventas,
                proveedores: d.proveedores,
                // Sin las claves: un respaldo no debe regalar contraseñas.
                usuarios: d.usuarios.map((u) => ({
                    id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol,
                })),
            },
        };
    }

    function importar(entrada) {
        if (!entrada || !Array.isArray(entrada.productos)) {
            return Promise.reject(
                new Error("El archivo no tiene el formato de un respaldo.")
            );
        }

        const d = cargar();
        d.categorias = entrada.categorias || [];
        d.productos = entrada.productos;
        d.ventas = entrada.ventas || [];
        d.proveedores = entrada.proveedores || [];

        // Los ids vienen del archivo: se recalculan los contadores para que
        // lo que se cree después no repita ninguno.
        const mayor = (filas) =>
            filas.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);

        d.siguienteId = {
            usuario: mayor(d.usuarios) + 1,
            categoria: mayor(d.categorias) + 1,
            producto: mayor(d.productos) + 1,
            venta: mayor(d.ventas) + 1,
            proveedor: mayor(d.proveedores) + 1,
        };

        escribir(d);
        return Promise.resolve({ exito: true, mensaje: "Respaldo restaurado." });
    }

    /* ---------- Utilidades (mismas reglas que el servidor) ---------- */

    const IVA = 0.15;

    function dinero(valor) {
        // Math.round redondea .5 hacia arriba, igual que ROUND_HALF_UP.
        return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
    }

    function ahora() {
        const f = new Date();
        const p = (n) => String(n).padStart(2, "0");
        return (
            f.getFullYear() + "-" + p(f.getMonth() + 1) + "-" + p(f.getDate()) +
            " " + p(f.getHours()) + ":" + p(f.getMinutes()) + ":" + p(f.getSeconds())
        );
    }

    function haceDias(dias) {
        return new Date(Date.now() - dias * 86400000).toISOString().slice(0, 19).replace("T", " ");
    }

    function nombreCategoria(d, id) {
        const c = d.categorias.find((x) => x.id === id);
        return c ? c.nombre : "Sin Categoría";
    }

    function sinClaves(usuario) {
        return {
            id: usuario.id,
            nombre: usuario.nombre,
            usuario: usuario.usuario,
            rol: usuario.rol,
        };
    }

    function comoProducto(p, d) {
        return {
            id: p.id,
            codigo: p.codigo_barra,
            nombre: p.nombre,
            precio: p.precio,
            stock: p.stock,
            categoria_id: p.categoria_id,
            categoria_nombre: nombreCategoria(d, p.categoria_id),
        };
    }

    /* ---------- Sesión de demo ---------- */

    function sesionDemo() {
        try {
            return JSON.parse(sessionStorage.getItem("tiendaAlexanderDemo")) || null;
        } catch (err) {
            return null;
        }
    }

    /* Solo se guarda QUIÉN entró, nunca la clave: la contraseña no necesita
     * viajar en la sesión porque los datos de la demo ya están en el equipo. */
    function guardarSesionDemo(usuario) {
        sessionStorage.setItem(
            "tiendaAlexanderDemo",
            JSON.stringify({ usuario: usuario.usuario, rol: usuario.rol })
        );
    }

    function borrarSesionDemo() {
        sessionStorage.removeItem("tiendaAlexanderDemo");
    }

    /* Abre sesión de demo a mano. Lo usa el login cuando la cuenta se creó
     * en este navegador y no existe en el servidor: sin esto, la demo no
     * reconocería al usuario y rechazaría la primera petición con
     * "Sesión no válida". */
    function iniciarSesion(usuario) {
        guardarSesionDemo(usuario);
    }

    /* Si el token guardado en la sesión actual es de demo, se devuelve el
     * usuario; si es del servidor real, aquí no aplica.
     *
     * También mira en App.cuentas: las cuentas creadas desde la pantalla de
     * alta viven en su propio localStorage, no en los datos de la demo. */
    function usuarioDeDemo() {
        const s = sesionDemo();
        if (!s) return null;

        const d = cargar();
        const deDemo = d.usuarios.find((u) => u.usuario === s.usuario);
        if (deDemo) return deDemo;

        return window.App.cuentas ? App.cuentas.buscar(s.usuario) : null;
    }

    /* ---------- Rutas ---------- */

    function idDeRuta(ruta) {
        const partes = ruta.split("/").filter(Boolean);
        const n = Number(partes[partes.length - 1]);
        return Number.isInteger(n) ? n : null;
    }

    function pedir(ruta, opciones = {}) {
        const metodo = (opciones.method || "GET").toUpperCase();
        const cuerpo = opciones.body || {};
        const d = cargar();

        /* --- sin sesión --- */
        const publico = ruta === "/auth/login";
        if (!publico && !usuarioDeDemo()) {
            return Promise.reject(new Error("Sesión no válida o vencida. Vuelve a iniciar sesión."));
        }

        const yo = usuarioDeDemo();

        /* --- respaldos --- */
        if (ruta === "/respaldos/info" && metodo === "GET") {
            if (yo.rol !== "ADMIN") {
                return Promise.reject(
                    new Error("Necesitas permisos de administrador para esta acción.")
                );
            }
            // En la demo la "base" es el JSON del navegador, así que lo que
            // se informa es el tamaño y la fecha de esos mismos datos.
            const respaldo = exportar();
            return Promise.resolve({
                existe: true,
                tamano_bytes: JSON.stringify(respaldo.datos).length,
                fecha: respaldo.datos.generado,
            });
        }

        if (ruta === "/respaldos/exportar" && metodo === "GET") {
            return Promise.resolve(exportar());
        }

        if (ruta === "/respaldos/restaurar" && metodo === "POST") {
            if (yo.rol !== "ADMIN") {
                return Promise.reject(
                    new Error("Necesitas permisos de administrador para esta acción.")
                );
            }
            const archivo = opciones.cuerpo && opciones.cuerpo.get("archivo");
            if (!archivo) {
                return Promise.reject(new Error("No se recibió ningún archivo."));
            }
            return archivo
                .text()
                .then((texto) => {
                    try {
                        return importar(JSON.parse(texto));
                    } catch (err) {
                        return Promise.reject(
                            new Error("El archivo no tiene el formato de un respaldo.")
                        );
                    }
                });
        }

        /* --- auth --- */
        if (ruta === "/auth/login" && metodo === "POST") {
            const u = d.usuarios.find(
                (x) => x.usuario.toLowerCase() === String(cuerpo.usuario || "").trim().toLowerCase()
            );

            if (u) {
                if (u.clave !== cuerpo.clave) {
                    return Promise.reject(new Error("Usuario o contraseña incorrectos."));
                }
                guardarSesionDemo(u);
                return Promise.resolve({
                    exito: true,
                    token: "demo-" + Math.random().toString(36).slice(2),
                    usuario: sinClaves(u),
                });
            }

            // La cuenta se creó desde la pantalla de alta, que vive en
            // localStorage y no en los datos de la demo.
            const local = window.App.cuentas
                ? App.cuentas.verificar(cuerpo.usuario, cuerpo.clave)
                : null;
            if (!local) {
                return Promise.reject(new Error("Usuario o contraseña incorrectos."));
            }

            guardarSesionDemo(local);
            return Promise.resolve({
                exito: true,
                token: "local-" + Math.random().toString(36).slice(2),
                usuario: local,
            });
        }

        if (ruta === "/auth/yo") {
            return Promise.resolve({ exito: true, usuario: sinClaves(yo) });
        }

        if (ruta === "/auth/logout") {
            borrarSesionDemo();
            return Promise.resolve({ exito: true, mensaje: "Sesión cerrada." });
        }

        if (ruta === "/auth/cambiar-clave" && metodo === "POST") {
            if (yo.clave !== cuerpo.actual) {
                return Promise.reject(new Error("La clave actual no es correcta."));
            }
            if (!cuerpo.nueva || cuerpo.nueva.length < 4) {
                return Promise.reject(new Error("La nueva clave debe tener al menos 4 caracteres."));
            }
            const u = d.usuarios.find((x) => x.id === yo.id);
            u.clave = cuerpo.nueva;
            escribir(d);
            guardarSesionDemo(u);
            return Promise.resolve({ exito: true, mensaje: "Contraseña actualizada." });
        }

        if (ruta === "/auth/cuenta" && metodo === "DELETE") {
            if (yo.rol === "ADMIN" && !d.usuarios.some((u) => u.rol === "ADMIN" && u.id !== yo.id)) {
                return Promise.reject(new Error("No puedes eliminar la única cuenta de administrador del sistema."));
            }
            d.usuarios = d.usuarios.filter((u) => u.id !== yo.id);
            escribir(d);
            borrarSesionDemo();
            return Promise.resolve({ exito: true, mensaje: "Cuenta eliminada." });
        }

        if (ruta === "/usuarios") {
            if (yo.rol !== "ADMIN") {
                return Promise.reject(new Error("Necesitas permisos de administrador para esta acción."));
            }
            return Promise.resolve(d.usuarios.map((u) => ({
                id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol,
                creado_en: haceDias(30),
            })));
        }

        if (ruta === "/auth/registro" && metodo === "POST") {
            if (yo.rol !== "ADMIN") {
                return Promise.reject(new Error("Necesitas permisos de administrador para esta acción."));
            }
            const nombre = String(cuerpo.usuario || "").trim();
            if (nombre.length < 3) {
                return Promise.reject(new Error("El usuario debe tener al menos 3 caracteres."));
            }
            if (!cuerpo.clave || cuerpo.clave.length < 4) {
                return Promise.reject(new Error("La clave debe tener al menos 4 caracteres."));
            }
            if (d.usuarios.some((u) => u.usuario.toLowerCase() === nombre.toLowerCase())) {
                return Promise.reject(new Error("Ese usuario ya existe, ingrese otro usuario."));
            }
            const nuevo = {
                id: d.siguienteId.usuario++,
                nombre: nombre,
                usuario: nombre,
                rol: "VENDEDOR",
                clave: cuerpo.clave,
            };
            d.usuarios.push(nuevo);
            escribir(d);
            return Promise.resolve({ exito: true, mensaje: "Usuario " + nombre + " agregado.", id: nuevo.id });
        }

        /* --- categorías --- */
        if (ruta === "/categorias" && metodo === "GET") {
            return Promise.resolve(d.categorias.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)));
        }

        if (ruta === "/categorias" && metodo === "POST") {
            const nombre = String(cuerpo.nombre || "").trim();
            if (!nombre) return Promise.reject(new Error("El nombre de la categoría es obligatorio."));
            if (d.categorias.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
                return Promise.reject(new Error("La categoría '" + nombre + "' ya existe."));
            }
            const nueva = { id: d.siguienteId.categoria++, nombre: nombre };
            d.categorias.push(nueva);
            escribir(d);
            return Promise.resolve({ exito: true, id: nueva.id, nombre: nombre });
        }

        /* --- productos --- */
        if (ruta === "/productos" && metodo === "GET") {
            return Promise.resolve(
                d.productos
                    .slice()
                    .sort((a, b) => a.nombre.localeCompare(b.nombre))
                    .map((p) => comoProducto(p, d))
            );
        }

        const idProducto = idDeRuta(ruta);

        if (ruta === "/productos" && metodo === "POST") {
            return Promise.resolve(crearProducto(d, cuerpo));
        }

        if (ruta.startsWith("/productos/") && metodo === "PUT") {
            const p = d.productos.find((x) => x.id === idProducto);
            if (!p) return Promise.reject(new Error("Producto no encontrado."));
            const limpio = validarProducto(d, cuerpo, idProducto);
            if (limpio.error) return Promise.reject(limpio.error);
            Object.assign(p, limpio.valores);
            escribir(d);
            return Promise.resolve({ exito: true, mensaje: "Producto actualizado correctamente." });
        }

        if (ruta.startsWith("/productos/") && metodo === "DELETE") {
            const existe = d.productos.some((x) => x.id === idProducto);
            if (!existe) return Promise.reject(new Error("Producto no encontrado."));
            if (d.ventas.some((v) => v.items.some((i) => i.id === idProducto))) {
                return Promise.reject(new Error("Este producto ya tiene ventas registradas y no se puede eliminar. Puedes dejar su stock en 0."));
            }
            d.productos = d.productos.filter((x) => x.id !== idProducto);
            escribir(d);
            return Promise.resolve({ exito: true, mensaje: "Producto eliminado correctamente." });
        }

        /* --- ventas --- */
        if (ruta === "/ventas" && metodo === "POST") {
            return Promise.resolve(registrarVenta(d, cuerpo, yo));
        }

        /* Una venta con su detalle, para reimprimir la factura. */
        if (ruta.startsWith("/ventas/") && metodo === "GET") {
            const id = Number(ruta.split("/")[2]);
            const v = d.ventas.find((x) => x.id === id);
            if (!v) return Promise.reject(new Error("La venta no existe."));

            const items = v.items.map((i) => {
                const p = d.productos.find((x) => x.id === i.id);
                const nombre = p ? p.nombre : "Producto " + i.id;
                const precio = i.precio_unitario !== undefined
                    ? i.precio_unitario
                    : (p ? p.precio : 0);
                return {
                    id: i.id,
                    nombre: nombre,
                    cantidad: i.cantidad,
                    precio_unitario: precio,
                    subtotal: dinero(precio * i.cantidad),
                };
            });

            const subtotal = dinero(items.reduce((s, i) => s + i.subtotal, 0));

            return Promise.resolve({
                id: v.id,
                fecha: v.fecha,
                metodo_pago: v.metodo_pago,
                vendedor: v.usuario,
                subtotal: subtotal,
                impuesto: dinero(subtotal * IVA),
                total: v.total,
                items: items,
            });
        }

        /* --- proveedores --- */
        if (ruta === "/proveedores" && metodo === "GET") {
            return Promise.resolve(d.proveedores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)));
        }

        if (ruta === "/proveedores" && metodo === "POST") {
            const nombre = String(cuerpo.nombre || "").trim();
            if (!nombre) return Promise.reject(new Error("El nombre del proveedor es obligatorio."));
            const nuevo = {
                id: d.siguienteId.proveedor++,
                nombre: nombre,
                telefono: String(cuerpo.telefono || "").trim(),
                cedula: String(cuerpo.cedula || "").trim(),
                direccion: String(cuerpo.direccion || "").trim(),
                departamento: String(cuerpo.departamento || "").trim(),
            };
            d.proveedores.push(nuevo);
            escribir(d);
            return Promise.resolve({ exito: true, mensaje: "Proveedor registrado.", id: nuevo.id });
        }

        if (ruta.startsWith("/proveedores/") && metodo === "DELETE") {
            const antes = d.proveedores.length;
            d.proveedores = d.proveedores.filter((x) => x.id !== idProducto);
            if (d.proveedores.length === antes) {
                return Promise.reject(new Error("Proveedor no encontrado."));
            }
            escribir(d);
            return Promise.resolve({ exito: true, mensaje: "Proveedor eliminado." });
        }

        /* --- reportes e inventario --- */
        if (ruta.startsWith("/reportes")) {
            const periodo = (ruta.split("periodo=")[1] || "hoy").toLowerCase();
            return Promise.resolve(reportes(d, periodo));
        }

        if (ruta === "/inventario/resumen") {
            const total = d.productos.length;
            const agotados = d.productos.filter((p) => p.stock === 0).length;
            const valor = dinero(d.productos.reduce((s, p) => s + p.precio * p.stock, 0));
            return Promise.resolve({
                total_productos: total,
                valor_inventario: valor,
                productos_agotados: agotados,
            });
        }

        return Promise.reject(new Error("La demo no implementa la ruta " + metodo + " " + ruta));
    }

    /* ---------- Validación de productos ---------- */

    function validarProducto(d, cuerpo, idExcluido) {
        const nombre = String(cuerpo.nombre || "").trim();
        if (nombre.length < 2) return { error: new Error("El nombre debe tener al menos 2 caracteres.") };

        const precio = Number(cuerpo.precio);
        if (!Number.isFinite(precio) || precio <= 0) {
            return { error: new Error("El precio debe ser un número mayor que 0.") };
        }

        const stock = Number(cuerpo.stock);
        if (!Number.isInteger(stock) || stock < 0) {
            return { error: new Error("El stock debe ser un número entero igual o mayor a 0.") };
        }
        if (stock > 64) {
            return { error: new Error("El stock no puede superar las 64 unidades.") };
        }

        const codigo = String(cuerpo.codigo || "").trim() || null;
        if (codigo && d.productos.some((p) => p.codigo_barra === codigo && p.id !== idExcluido)) {
            return { error: new Error("Ese código de barras ya está registrado en otro producto.") };
        }

        let categoria_id = cuerpo.categoria_id ? Number(cuerpo.categoria_id) : null;
        if (categoria_id && !d.categorias.some((c) => c.id === categoria_id)) {
            return { error: new Error("La categoría seleccionada no es válida.") };
        }

        return { valores: { codigo_barra: codigo, nombre: nombre, precio: precio, stock: stock, categoria_id: categoria_id } };
    }

    function crearProducto(d, cuerpo) {
        const r = validarProducto(d, cuerpo, null);
        if (r.error) return Promise.reject(r.error);
        const nuevo = Object.assign({ id: d.siguienteId.producto++ }, r.valores);
        d.productos.push(nuevo);
        escribir(d);
        return Promise.resolve({ exito: true, mensaje: "Producto guardado.", id: nuevo.id });
    }

    /* ---------- Ventas ---------- */

    function registrarVenta(d, cuerpo, yo) {
        const metodo = cuerpo.metodo_pago || "efectivo";
        if (!["efectivo", "tarjeta", "transferencia"].includes(metodo)) {
            return Promise.reject(new Error("Método de pago no válido."));
        }
        const items = cuerpo.items || [];
        if (!items.length) return Promise.reject(new Error("El carrito de ventas está vacío."));

        let total = 0;
        const detalle = [];
        for (const item of items) {
            const cantidad = Number(item.cantidad);
            if (!Number.isInteger(cantidad) || cantidad <= 0) {
                return Promise.reject(new Error("Cantidad inválida en el carrito."));
            }
            const p = d.productos.find((x) => x.id === Number(item.id));
            if (!p) {
                return Promise.reject(new Error("El producto con ID " + item.id + " no existe."));
            }
            if (p.stock < cantidad) {
                return Promise.reject(new Error(
                    "Stock insuficiente para '" + p.nombre + "'. Disponible: " + p.stock + "."
                ));
            }
            total += p.precio * cantidad;
            // Se guarda el precio del momento de la venta: si después sube,
            // la factura vieja tiene que seguir diciendo lo que se cobró.
            detalle.push({
                id: Number(item.id),
                nombre: p.nombre,
                cantidad: cantidad,
                precio_unitario: p.precio,
            });
        }

        const subtotal = dinero(total);
        const impuesto = dinero(subtotal * IVA);
        const totalFinal = dinero(subtotal + impuesto);

        const venta = {
            id: d.siguienteId.venta++,
            fecha: ahora(),
            total: totalFinal,
            metodo_pago: metodo,
            usuario: yo.nombre,
            items: detalle,
        };
        d.ventas.push(venta);
        for (const item of venta.items) {
            const p = d.productos.find((x) => x.id === item.id);
            p.stock -= item.cantidad;
        }
        escribir(d);

        return Promise.resolve({
            exito: true,
            mensaje: "Venta realizada con éxito.",
            venta_id: venta.id,
            fecha: venta.fecha,
            metodo_pago: venta.metodo_pago,
            subtotal: subtotal,
            impuesto: impuesto,
            total: totalFinal,
            items: detalle.map((i) => ({
                id: i.id,
                nombre: i.nombre,
                cantidad: i.cantidad,
                precio_unitario: i.precio_unitario,
                subtotal: dinero(i.precio_unitario * i.cantidad),
            })),
        });
    }

    function reportes(d, periodo) {
        const desde =
            periodo === "semana" ? haceDias(7) :
            periodo === "mes" ? haceDias(30) :
            ahora().slice(0, 11) + "00:00:00";

        const ventas = d.ventas.filter((v) => v.fecha >= desde).sort((a, b) => b.fecha.localeCompare(a.fecha));
        const totales = ventas.map((v) => v.total);
        const suma = totales.reduce((s, t) => s + t, 0);

        return {
            periodo: periodo,
            desde: desde,
            kpis: {
                total_vendido: dinero(suma),
                cantidad_ventas: ventas.length,
                productos_vendidos: ventas.reduce((s, v) => s + v.items.reduce((x, i) => x + i.cantidad, 0), 0),
                ticket_promedio: ventas.length ? dinero(suma / ventas.length) : 0,
            },
            ventas: ventas.map((v) => ({
                id: v.id, fecha: v.fecha, metodo_pago: v.metodo_pago,
                total: v.total, vendedor: v.usuario,
            })),
        };
    }

    function sinServidor() {
        return Date.now() - caidoEn < REINTENTO_MS;
    }

    return {
        pedir: pedir,
        reiniciar: reiniciar,
        exportar: exportar,
        sinServidor: sinServidor,
        iniciarSesion: iniciarSesion,
        TIMEOUT_MS: TIMEOUT_MS,
        marcarCaido: function () {
            caidoEn = Date.now();
        },
    };
})();