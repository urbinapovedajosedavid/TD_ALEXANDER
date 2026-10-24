/* Prueba rápida: reporte de ventas por usuario en modo demo. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = "C:/Users/iurdm/TD_ALEXANDER";

function almacen() {
    const datos = {};
    return {
        getItem: (k) => (k in datos ? datos[k] : null),
        setItem: (k, v) => { datos[k] = String(v); },
        removeItem: (k) => { delete datos[k]; },
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
            setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {},
            classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        }),
        getElementById: () => null,
    },
    setTimeout, clearTimeout, console, Math, Date, JSON, Number, Promise,
    URLSearchParams, Blob, fetch, localStorage: local, sessionStorage: sesion,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

vm.runInContext(fs.readFileSync(path.join(RAIZ, "Frontend", "js", "core.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "Frontend", "js", "demo.js"), "utf8"), sandbox);

const App = sandbox.window.App;
const demo = App.demo;

let fallos = 0;
function check(nombre, cond, detalle) {
    console.log((cond ? "  ok   " : "  FALLA") + " " + nombre);
    if (!cond) { fallos++; if (detalle) console.log("       ->", JSON.stringify(detalle)); }
}

(async function () {
    demo.reiniciar();

    let r = await demo.pedir("/auth/login", { method: "POST", body: { usuario: "admin", clave: "admin" } });
    check("login admin ok", r.exito && r.usuario.rol === "ADMIN", r);

    r = await demo.pedir("/usuarios");
    check("lista usuarios (inicio) ok", Array.isArray(r), r);
    console.log("   usuarios:", JSON.stringify((Array.isArray(r) ? r : r.datos || []).map(u => ({ id: u.id, nombre: u.nombre, rol: u.rol }))));

    // Crea un vendedor nuevo y verifica que aparece en la lista.
    r = await demo.pedir("/auth/registro", { method: "POST", body: { usuario: "vendedorNuevo", clave: "vend123", nombre: "Vendedor Nuevo" } });
    check("registro de vendedor ok", r.exito, r);

    r = await demo.pedir("/usuarios");
    const usuarios = Array.isArray(r) ? r : (r.datos || []);
    check("lista usuarios incluye al nuevo vendedor", usuarios.some((u) => u.usuario === "vendedorNuevo"), usuarios);
    const vendedor = usuarios.find((u) => u.usuario === "vendedorNuevo");
    console.log("   vendedorNuevo:", JSON.stringify(vendedor));

    const idVendedor = vendedor ? Number(vendedor.id) : null;
    check("el vendedor nuevo tiene id numérico", Boolean(idVendedor), vendedor);

    r = await demo.pedir("/reportes/usuario/" + idVendedor);
    check("reporte por usuario (vendedor nuevo) responde ok", r.exito, r);
    check("el reporte devuelve ventas vacias para vendedor sin ventas", r.exito && Array.isArray(r.ventas) && r.ventas.length === 0, r);

    console.log(fallos === 0 ? "SMOKE OK" : `SMOKE CON FALLAS (${fallos})`);
    process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e); process.exit(2); });
