/* Prueba del modo demostración: ejecuta js/demo.js con localStorage y
 * sessionStorage simulados, sin navegador.
 *
 * Uso:  node tests/test_demo.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.resolve(__dirname, "..");

/* Almacenes mínimos en memoria, con la misma interfaz que los del navegador. */
function almacen() {
    const datos = {};
    return {
        getItem: (k) => (k in datos ? datos[k] : null),
        setItem: (k, v) => {
            datos[k] = String(v);
        },
        removeItem: (k) => {
            delete datos[k];
        },
        _datos: datos,
    };
}

const local = almacen();
const sesion = almacen();

const sandbox = {
    localStorage: local,
    sessionStorage: sesion,
    document: {
        body: { appendChild() {} },
        createElement: () => ({
            setAttribute() {},
            addEventListener() {},
            appendChild() {},
            remove() {},
            classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        }),
        getElementById: () => null,
    },
    setTimeout,
    clearTimeout,
    console,
    Math,
    Date,
    JSON,
    Number,
    Promise,
};
/* En un navegador window ES el objeto global: por eso `window.App = ...`
 * crea la variable global `App`. Hay que imitarlo para que el módulo
 * se comporte igual aquí. */
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

vm.runInContext(
    fs.readFileSync(path.join(RAIZ, "Frontend", "js", "demo.js"), "utf8"),
    sandbox
);

const demo = sandbox.window.App.demo;

let fallos = 0;
const checks = [];

function check(nombre, condicion, detalle) {
    checks.push({ nombre, condicion: Boolean(condicion), detalle });
    if (!condicion) fallos++;
}

async function pedir(ruta, method, body, cuerpo) {
    try {
        return { ok: true, datos: await demo.pedir(ruta, { method, body, cuerpo }) };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

(async function () {
    demo.reiniciar();

    /* --- sin sesión --- */
    let r = await pedir("/productos", "GET");
    check("sin sesión no lee productos", !r.ok && /Sesión no válida/.test(r.error), r);

    /* --- login --- */
    r = await pedir("/auth/login", "POST", { usuario: "admin", clave: "admin" });
    check("admin/admin entra", r.ok && r.datos.usuario.rol === "ADMIN", r);

    r = await pedir("/auth/login", "POST", { usuario: "admin", clave: "otra" });
    check("clave incorrecta rechazada", !r.ok, r);

    /* --- catálogo sembrado --- */
    r = await pedir("/productos", "GET");
    check("productos de ejemplo", r.ok && r.datos.length === 4, r.datos && r.datos.length);
    check("categoria_nombre resuelta",
        r.ok && r.datos.every((p) => typeof p.categoria_nombre === "string"), r.datos);

    r = await pedir("/categorias", "GET");
    check("3 categorias", r.ok && r.datos.length === 3, r.datos && r.datos.length);

    /* --- el token de demo no sirve contra el servidor real --- */
    check("token de demo no es un JWT del servidor",
        !JSON.stringify(local._datos).includes("pbkdf2"), "no deberia haber hashes");

    /* --- validaciones de producto --- */
    r = await pedir("/productos", "POST", { nombre: "Nuevo", precio: 10, stock: 3 });
    check("crear producto", r.ok && r.datos.id > 4, r);
    const idNuevo = r.datos.id;

    r = await pedir("/productos", "GET");
    check("el nuevo no pisa los de ejemplo",
        r.ok && r.datos.length === 5 && r.datos.filter((p) => p.id === idNuevo).length === 1,
        r.datos && r.datos.map((p) => p.id));

    r = await pedir("/productos", "POST", { nombre: "Exceso", precio: 10, stock: 65 });
    check("stock > 64 rechazado", !r.ok && /64/.test(r.error), r);

    r = await pedir("/productos", "POST", { nombre: "X", precio: 10, stock: 1 });
    check("nombre de 1 caracter rechazado", !r.ok && /2 caracteres/.test(r.error), r);

    r = await pedir("/productos", "POST", { nombre: "X", precio: -1, stock: 1 });
    check("precio negativo rechazado", !r.ok, r);

    r = await pedir("/productos", "POST", {
        nombre: "Repetido", precio: 5, stock: 1, codigo: "7501234567890",
    });
    check("codigo duplicado rechazado", !r.ok && /código de barras/.test(r.error), r);

    r = await pedir("/productos/" + idNuevo, "PUT", {
        nombre: "Nuevo XL", precio: 10, stock: 3, codigo: "NUEVO-1",
    });
    check("editar producto existente", r.ok, r);

    r = await pedir("/productos/" + idNuevo, "PUT", {
        nombre: "Nuevo XL", precio: 10, stock: 3, codigo: "7501234567890",
    });
    check("editar con codigo duplicado rechazado",
        !r.ok && /código de barras/.test(r.error), r);

    r = await pedir("/productos/9999", "PUT", { nombre: "Fantasma", precio: 1, stock: 1 });
    check("editar inexistente", !r.ok && /no encontrado/.test(r.error), r);

    /* --- venta: IVA y stock --- */
    r = await pedir("/ventas", "POST", {
        metodo_pago: "efectivo",
        items: [{ id: idNuevo, cantidad: 2 }],
    });
    // precio 10 * 2 = 20 ; iva 15% = 3 ; total 23
    check("venta: subtotal 20", r.ok && r.datos.subtotal === 20, r);
    check("venta: iva 15%", r.ok && r.datos.impuesto === 3, r);
    check("venta: total 23", r.ok && r.datos.total === 23, r);

    /* La factura: la respuesta trae el detalle y se puede recuperar sola. */
    check("la venta devuelve su detalle",
        r.ok && r.datos.items && r.datos.items.length === 1, r.datos && r.datos.items);
    check("el detalle trae el nombre del producto",
        r.ok && r.datos.items[0].nombre === "Nuevo XL", r.datos.items[0]);
    check("el detalle trae el precio real",
        r.ok && r.datos.items[0].precio_unitario === 10, r.datos.items[0]);
    check("el detalle trae el importe de la linea",
        r.ok && r.datos.items[0].subtotal === 20, r.datos.items[0]);

    const idVenta = r.datos.venta_id;
    r = await pedir("/ventas/" + idVenta, "GET");
    check("reimprimir factura", r.ok && r.datos.id === idVenta, r);
    check("la factura trae los mismos totales",
        r.ok && r.datos.subtotal === 20 && r.datos.impuesto === 3 && r.datos.total === 23, r.datos);
    check("la factura trae el vendedor",
        r.ok && r.datos.vendedor === "Administrador", r.datos && r.datos.vendedor);
    check("la factura trae el metodo de pago",
        r.ok && r.datos.metodo_pago === "efectivo", r.datos && r.datos.metodo_pago);

    r = await pedir("/ventas/9999", "GET");
    check("factura de venta inexistente", !r.ok && /no existe/.test(r.error), r);

    r = await pedir("/productos", "GET");
    const despues = r.datos.find((p) => p.id === idNuevo);
    check("stock descontado", despues && despues.stock === 1, despues);

    r = await pedir("/ventas", "POST", { items: [{ id: idNuevo, cantidad: 99 }] });
    check("stock insuficiente rechazado", !r.ok && /Stock insuficiente/.test(r.error), r);

    r = await pedir("/ventas", "POST", { items: [] });
    check("carrito vacio rechazado", !r.ok, r);

    r = await pedir("/ventas", "POST", {
        items: [{ id: idNuevo, cantidad: 1 }], metodo_pago: "bitcoin",
    });
    check("metodo de pago invalido", !r.ok, r);

    /* --- un producto vendido sí se borra, y la factura sobrevive --- */
    r = await pedir("/productos/" + idNuevo, "DELETE");
    check("producto vendido se borra", r.ok, r);

    r = await pedir("/productos", "GET");
    check("el producto ya no esta en el inventario",
        r.ok && !r.datos.some((p) => p.id === idNuevo), r);

    r = await pedir("/productos/" + idNuevo, "DELETE");
    check("borrarlo otra vez -> no encontrado",
        !r.ok && /no encontrado/.test(r.error), r);

    r = await pedir("/ventas/" + idVenta, "GET");
    check("la factura sigue disponible tras borrar el producto",
        r.ok && r.datos.id === idVenta, r);
    check("la factura conserva sus totales",
        r.ok && r.datos.subtotal === 20 && r.datos.impuesto === 3 && r.datos.total === 23, r.datos);
    check("la factura conserva el nombre del producto borrado",
        r.ok && r.datos.items[0].nombre === "Nuevo XL", r.datos && r.datos.items[0]);
    check("la factura conserva el precio que se cobro",
        r.ok && r.datos.items[0].precio_unitario === 10, r.datos && r.datos.items[0]);

    /* --- inventario y reportes --- */
    r = await pedir("/inventario/resumen", "GET");
    // Eran 5 productos y se borró el que se había vendido.
    check("resumen de inventario", r.ok && r.datos.total_productos === 4, r.datos);

    r = await pedir("/reportes?periodo=hoy", "GET");
    check("reporte cuenta la venta",
        r.ok && r.datos.kpis.cantidad_ventas === 1 && r.datos.kpis.total_vendido === 23,
        r.datos && r.datos.kpis);

    /* --- proveedores --- */
    r = await pedir("/proveedores", "POST", { nombre: "Nuevo Proveedor" });
    check("crear proveedor", r.ok, r);
    r = await pedir("/proveedores/" + r.datos.id, "DELETE");
    check("eliminar proveedor", r.ok, r);
    r = await pedir("/proveedores/9999", "DELETE");
    check("eliminar proveedor inexistente", !r.ok, r);

    /* --- roles --- */
    r = await pedir("/auth/logout", "POST");
    check("logout", r.ok, r);
    r = await pedir("/productos", "GET");
    check("tras logout no hay sesión", !r.ok, r);

    /* --- la demo solo acepta admin/admin --- */
    r = await pedir("/auth/login", "POST", { usuario: "vendedor", clave: "vendedor" });
    check("no existe la cuenta vendedor", !r.ok, r);

    /* --- no se guarda la contraseña en la sesión --- */
    r = await pedir("/auth/login", "POST", { usuario: "admin", clave: "admin" });
    const sesionDemo = sesion.getItem("tiendaAlexanderDemo");
    check("la sesion de demo no guarda la clave",
        sesionDemo !== null && !/clave/.test(sesionDemo), sesionDemo);
    check("la sesion de demo guarda el rol",
        sesionDemo !== null && /ADMIN/.test(sesionDemo), sesionDemo);

    /* --- roles: un vendedor creado desde Ajustes queda sin permisos --- */
    r = await pedir("/auth/login", "POST", { usuario: "admin", clave: "admin" });
    r = await pedir("/auth/registro", "POST", {
        usuario: "cajero", clave: "1234", nombre: "Cajero", rol: "VENDEDOR",
    });
    check("admin crea un vendedor", r.ok, r);

    await pedir("/auth/logout", "POST");
    r = await pedir("/auth/login", "POST", { usuario: "cajero", clave: "1234" });
    check("el vendedor entra", r.ok && r.datos.usuario.rol === "VENDEDOR", r);

    r = await pedir("/usuarios", "GET");
    check("vendedor no lista usuarios", !r.ok && /administrador/.test(r.error), r);

    r = await pedir("/auth/registro", "POST", { usuario: "otro", clave: "1234" });
    check("vendedor no crea usuarios", !r.ok, r);

    r = await pedir("/usuarios/1", "DELETE");
    check("vendedor no borra cuentas", !r.ok, r);

    /* --- admin de nuevo --- */
    await pedir("/auth/logout", "POST");
    r = await pedir("/auth/login", "POST", { usuario: "admin", clave: "admin" });
    r = await pedir("/usuarios", "GET");
    check("admin lista usuarios", r.ok && r.datos.length === 2, r.datos && r.datos.length);

    /* --- cambiar clave --- */
    r = await pedir("/auth/cambiar-clave", "POST", { actual: "mala", nueva: "nueva123" });
    check("cambio con clave mala rechazado", !r.ok, r);
    r = await pedir("/auth/cambiar-clave", "POST", { actual: "admin", nueva: "admin999" });
    check("cambio de clave ok", r.ok, r);
    await pedir("/auth/logout", "POST");
    r = await pedir("/auth/login", "POST", { usuario: "admin", clave: "admin" });
    check("clave vieja ya no entra", !r.ok, r);
    r = await pedir("/auth/login", "POST", { usuario: "admin", clave: "admin999" });
    check("clave nueva entra", r.ok, r);

    /* --- borrado de cuenta --- */
    r = await pedir("/auth/cuenta", "DELETE");
    check("ultimo admin no se borra", !r.ok && /única cuenta/.test(r.error), r);

    /* --- respaldos: exportar e importar --- */
    // Antes de exportar hay que haber entrado: más arriba se cambió la clave
    // del admin y se cerró la sesión.
    await pedir("/auth/login", "POST", { usuario: "admin", clave: "admin999" });

    const exportado = demo.exportar();
    check("exportar entrega los datos", exportado.exito === true, exportado);

    r = await pedir("/productos", "GET");
    const cuantosAntes = r.datos.length;
    check("el respaldo lleva todos los productos",
        exportado.datos.productos.length === cuantosAntes,
        { respaldo: exportado.datos.productos.length, enPantalla: cuantosAntes });
    check("el respaldo lleva las ventas", Array.isArray(exportado.datos.ventas));
    check("el respaldo NO lleva contraseñas",
        !JSON.stringify(exportado.datos).includes("clave"), "regala claves");
    check("el respaldo no incluye la tabla sesiones",
        !("sesiones" in exportado.datos), Object.keys(exportado.datos));

    /* /respaldos/info la pide la pantalla al abrirse. Sin esta ruta salía
     * el error "la demo no implementa la ruta GET /respaldos/info". */
    r = await pedir("/respaldos/info", "GET");
    check("info del respaldo responde en la demo", r.ok, r);
    check("info dice que hay datos", r.ok && r.datos.existe === true, r.datos);
    check("info trae un tamaño", r.ok && r.datos.tamano_bytes > 0, r.datos);
    check("info trae la fecha de los datos",
        r.ok && typeof r.datos.fecha === "string" && r.datos.fecha.length > 0, r.datos);

    await pedir("/auth/logout", "POST");
    await pedir("/auth/login", "POST", { usuario: "admin", clave: "admin999" });

    // Se guarda el respaldo antes de romper los datos.
    const copiaBuena = JSON.parse(JSON.stringify(exportado.datos));
    const cuantosEnRespaldo = copiaBuena.productos.length;
    const ultimoIdEnRespaldo = Math.max(...copiaBuena.productos.map((p) => p.id));

    r = await pedir("/productos", "POST", { nombre: "Temporario", precio: 3, stock: 1 });
    check("se crea un producto de más", r.ok, r);

    // Restaurar devuelve el estado guardado.
    const archivoDemo = {
        get: () => ({ text: () => Promise.resolve(JSON.stringify(copiaBuena)) }),
    };
    r = await pedir("/respaldos/restaurar", "POST", undefined, archivoDemo);
    check("restaurar responde ok", r.ok, r);

    r = await pedir("/productos", "GET");
    check("tras restaurar desaparece lo creado después",
        r.ok && r.datos.length === cuantosEnRespaldo, r.ok && r.datos.length);

    // Un archivo que no es un respaldo se rechaza.
    const archivoMalo = { get: () => ({ text: () => Promise.resolve("esto no es json") }) };
    r = await pedir("/respaldos/restaurar", "POST", undefined, archivoMalo);
    check("un archivo inválido se rechaza", !r.ok, r);

    const archivoVacio = { get: () => ({ text: () => Promise.resolve('{"nada":1}') }) };
    r = await pedir("/respaldos/restaurar", "POST", undefined, archivoVacio);
    check("un json sin productos se rechaza",
        !r.ok && /formato de un respaldo/.test(r.error), r);

    r = await pedir("/respaldos/restaurar", "POST");
    check("sin archivo se rechaza", !r.ok, r);

    // Tras restaurar, los ids nuevos no repitan los del archivo.
    r = await pedir("/productos", "POST", { nombre: "Post Respaldo", precio: 1, stock: 1 });
    check("el id sigue al del respaldo",
        r.ok && r.datos.id > ultimoIdEnRespaldo, r.datos);

    /* --- reinicio --- */
    demo.reiniciar();
    r = await pedir("/auth/login", "POST", { usuario: "admin", clave: "admin" });
    check("reiniciar restituye admin/admin", r.ok, r);

    /* --- salida --- */
    for (const c of checks) {
        console.log((c.condicion ? "  ok   " : "  FALLA ") + c.nombre +
            (c.condicion || c.detalle === undefined ? "" : " -> " + JSON.stringify(c.detalle)));
    }
    console.log("\n" + "=".repeat(46));
    if (fallos) {
        console.log("FALLARON " + fallos + " de " + checks.length);
        process.exit(1);
    }
    console.log("TODAS LAS PRUEBAS DE LA DEMO PASARON (" + checks.length + ")");
})();