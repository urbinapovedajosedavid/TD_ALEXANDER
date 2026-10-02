/* Prueba de integración del modo demostración.
 *
 * Carga js/core.js y js/demo.js en un entorno sin navegador y simula que
 * NO hay servidor: fetch falla como cuando el puerto está cerrado. Comprueba
 * que el sistema entra igual, con admin / admin, y que un 401 del servidor
 * real NO se convierte en una sesión de demo.
 *
 * Uso:  node tests/test_modo_demo.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.resolve(__dirname, "..");

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
    };
}

let fetchLlamadas = 0;

/* Servidor apagado: fetch siempre rechaza, como cuando nada escucha. */
function fetchApagado() {
    fetchLlamadas++;
    return Promise.reject(new TypeError("Failed to fetch"));
}

const sandbox = {
    localStorage: almacen(),
    sessionStorage: almacen(),
    fetch: fetchApagado,

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
    String,
    Object,
    Array,
    Boolean,
    TypeError,
    Error,
    AbortController,
    FormData: class FormData { constructor() { this._d = new Map(); } append(k, v) { this._d.set(k, v); } get(k) { return this._d.get(k); } },
    Blob: class Blob { constructor() { this.size = 0; } },

    /* sesionCaida() redirige con location.replace; en el navegador existe,
     * aqui hay que imitarlo. */
    location: { replace() {}, assign() {}, href: "" },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function cargar(archivo) {
    vm.runInContext(
        fs.readFileSync(path.join(RAIZ, "Frontend", "js", archivo), "utf8"),
        sandbox
    );
}

cargar("core.js");
cargar("demo.js");

const App = sandbox.App;

let fallos = 0;
const checks = [];

function check(nombre, condicion, detalle) {
    checks.push({ nombre, condicion: Boolean(condicion), detalle });
    if (!condicion) fallos++;
}

/* Ejecuta una llamada a la API y devuelve { ok, valor } o { ok:false, error }. */
async function intentar(fn) {
    try {
        return { ok: true, valor: await fn() };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

(async function () {
    App.demo.reiniciar();

    /* ---------- 1. Entrar con admin/admin sin servidor ---------- */
    const llamadasAntes = fetchLlamadas;
    const r = await intentar(() => App.api.login("admin", "admin"));

    check("login admin/admin funciona sin servidor", r.ok, r);
    check("devuelve token", r.ok && typeof r.valor.token === "string", r.valor);
    check("devuelve el usuario admin",
        r.ok && r.valor.usuario && r.valor.usuario.usuario === "admin", r.valor);

    const sesion = JSON.parse(sandbox.sessionStorage.getItem("tiendaAlexanderSesion"));
    check("la sesion guarda un token de demo", sesion && sesion.token === "demo", sesion);
    check("se intento el servidor real antes de la demo",
        fetchLlamadas === llamadasAntes + 1, fetchLlamadas - llamadasAntes);

    /* ---------- 2. La API sigue respondiendo ---------- */
    const prods = await intentar(() => App.api.productos());
    check("listar productos funciona", prods.ok, prods);
    check("trae los datos de ejemplo", prods.ok && prods.valor.length === 4,
        prods.ok && prods.valor.length);
    check("los productos traen categoria resuelta",
        prods.ok && prods.valor.every((p) => p.categoria_nombre), prods.valor);

    const cats = await intentar(() => App.api.categorias());
    check("listar categorias funciona", cats.ok && cats.valor.length === 3, cats);

    const prov = await intentar(() => App.api.proveedores());
    check("listar proveedores funciona", prov.ok && prov.valor.length === 1, prov);

    /* ---------- 3. No insiste con el servidor caido ---------- */
    const antes2 = fetchLlamadas;
    await intentar(() => App.api.productos());
    check("no vuelve a preguntar al servidor dentro del mismo periodo",
        fetchLlamadas === antes2, fetchLlamadas - antes2);

    /* ---------- 4. Venta y reportes ---------- */
    const idPrimero = prods.valor[0].id;
    const venta = await intentar(() =>
        App.api.registrarVenta({
            metodo_pago: "efectivo",
            items: [{ id: idPrimero, cantidad: 1 }],
        })
    );
    check("registrar venta funciona", venta.ok, venta);
    check("la venta descuenta stock", venta.ok && venta.valor.total > 0, venta.valor);

    const rep = await intentar(() => App.api.reportes("hoy"));
    check("reportes funcionan", rep.ok && rep.valor.kpis.cantidad_ventas === 1, rep.valor);

    const inv = await intentar(() => App.api.resumenInventario());
    check("resumen de inventario funciona", inv.ok && inv.valor.total_productos === 4, inv.valor);

    /* ---------- 5. Los errores de negocio se muestran igual ---------- */
    const malaClave = await intentar(() => App.api.login("admin", "incorrecta"));
    check("clave incorrecta avisa en vez de romper",
        !malaClave.ok && /incorrectos/.test(malaClave.error), malaClave);

    const sinStock = await intentar(() =>
        App.api.registrarVenta({
            metodo_pago: "efectivo",
            items: [{ id: idPrimero, cantidad: 9999 }],
        })
    );
    check("venta sin stock avisa",
        !sinStock.ok && /Stock insuficiente/.test(sinStock.error), sinStock);

    const usuarioMalo = await intentar(() => App.api.login("nadie", "x"));
    check("usuario inexistente avisa",
        !usuarioMalo.ok && /incorrectos/.test(usuarioMalo.error), usuarioMalo);

    /* ---------- 6. La copia de seguridad funciona sin servidor ---------- */
    /* La pantalla pide /respaldos/info al abrirse. Esa ruta tiene que
     * existir en la demo: si falta, salía el error "la demo no implementa
     * la ruta GET /respaldos/info" apenas se abría Copia de seguridad. */
    const info = await intentar(() => App.api.infoRespaldo());
    check("abrir copia de seguridad sin servidor no avisa", info.ok, info);
    check("la pantalla recibe tamaño y fecha de la base",
        info.ok && info.valor.tamano_bytes > 0 && !!info.valor.fecha,
        info.ok && info.valor);

    /* La página llama a App.demo.exportar() cuando no hay servidor, así que se
     * comprueba que el respaldo sale con los datos de la demo. */
    const respaldo = App.demo.exportar();
    check("el respaldo se genera sin servidor", respaldo.exito === true, respaldo);
    check("el respaldo trae los productos", respaldo.datos.productos.length === 4,
        respaldo.datos.productos.length);
    check("el respaldo trae la venta registrada", respaldo.datos.ventas.length === 1,
        respaldo.datos.ventas.length);
    check("el respaldo no incluye contraseñas",
        !JSON.stringify(respaldo.datos).includes("clave"), "regala claves");
    check("el respaldo no incluye sesiones",
        !("sesiones" in respaldo.datos), Object.keys(respaldo.datos));

    const sinAdm = await intentar(() =>
        App.demo.pedir("/respaldos/restaurar", {
            method: "POST",
            cuerpo: { get: () => ({ text: () => Promise.resolve('{"nada":1}') }) },
        })
    );
    check("restaurar un archivo sin productos se rechaza",
        !sinAdm.ok && /formato de un respaldo/.test(sinAdm.error), sinAdm);

    /* ---------- 7. Logout ---------- */
    await intentar(() => App.api.logout());
    const trasLogout = await intentar(() => App.api.productos());
    check("tras logout pide iniciar sesion",
        !trasLogout.ok && /Sesión no válida/.test(trasLogout.error), trasLogout);

    /* ---------- 8. Un 401 del servidor NO cae a la demo ----------
     * Esto es lo que impide que el modo demo se convierta en una forma de
     * saltarse la seguridad: si el servidor contesta, manda el servidor. */

    sandbox.sessionStorage.setItem(
        "tiendaAlexanderSesion",
        JSON.stringify({
            token: "token-real-del-servidor",
            usuario: { id: 1, nombre: "Administrador", usuario: "admin", rol: "ADMIN" },
        })
    );

    /* El servidor ahora contesta 401 en vez de fallar por red. */
    sandbox.fetch = function () {
        fetchLlamadas++;
        return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ exito: false, mensaje: "Sesión no válida o vencida." }),
        });
    };

    /* Se adelanta el reloj para que App.demo piense que ya toca reintentar
     * el servidor de verdad. */
    const relojReal = Date.now;
    Date.now = () => relojReal() + 10 * 60 * 1000;

    const con401 = await intentar(() => App.api.productos());
    Date.now = relojReal;

    check("un 401 del servidor no se convierte en sesion de demo",
        !con401.ok && /Sesión no válida/.test(con401.error), con401);
    check("el 401 llego desde el fetch del servidor", fetchLlamadas > antes2, {
        llamadas: fetchLlamadas,
        antes: antes2,
    });

    /* Y al revés: un 403 de un vendedor tampoco debe convertirse en demo. */
    sandbox.fetch = function () {
        return Promise.resolve({
            ok: false,
            status: 403,
            json: () => Promise.resolve({ exito: false, mensaje: "Necesitas permisos de administrador." }),
        });
    };
    Date.now = () => relojReal() + 20 * 60 * 1000;
    const con403 = await intentar(() => App.api.usuarios());
    Date.now = relojReal;

    check("un 403 tampoco cae a la demo",
        !con403.ok && /permisos de administrador/.test(con403.error), con403);

    for (const c of checks) {
        console.log(
            (c.condicion ? "  ok   " : "  FALLA ") +
                c.nombre +
                (c.condicion || c.detalle === undefined ? "" : " -> " + JSON.stringify(c.detalle))
        );
    }
    console.log("\n" + "=".repeat(46));
    if (fallos) {
        console.log("FALLARON " + fallos + " de " + checks.length);
        process.exit(1);
    }
    console.log("TODAS LAS PRUEBAS PASARON (" + checks.length + ")");
})();