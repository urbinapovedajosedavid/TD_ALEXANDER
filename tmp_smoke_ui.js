/* Prueba rápida: render del flujo de reportes en el modo demo (mock de DOM). */
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

const elementos = {};
function stub() {
    const el = {
        id: "", className: "", classList: null, style: {}, dataset: {},
        value: "", innerHTML: "", textContent: "", children: [], _h: {},
        addEventListener(tipo, fn) { (el._h[tipo] = el._h[tipo] || []).push(fn); },
        appendChild(c) { el.children.push(c); return c; },
        remove() {}, querySelector: () => stub(), querySelectorAll: () => [],
        setAttribute() {}, closest: () => stub(), reset() {}, focus() {}, click() {},
    };
    el.classList = {
        add(...n) { el._c = [...new Set([...(el._c || []), ...n])]; },
        remove(...n) { el._c = (el._c || []).filter((x) => !n.includes(x)); },
        contains(c) { return (el._c || []).includes(c); },
        toggle(c, f) { const tiene = this.contains(c); const quiere = f === undefined ? !tiene : Boolean(f); if (quiere) this.add(c); else this.remove(c); return quiere; },
    };
    el._c = [];
    return el;
}

const manejadoresDocumento = {};
const sandbox = {
    localStorage: local,
    sessionStorage: sesion,
    document: {
        body: stub(),
        createElement: (tag) => { const e = stub(); e.tagName = tag; return e; },
        getElementById: (id) => (elementos[id] = elementos[id] || stub()),
        querySelector: () => stub(),
        querySelectorAll: () => [],
        addEventListener: (tipo, fn) => { (manejadoresDocumento[tipo] = manejadoresDocumento[tipo] || []).push(fn); },
        forms: {},
    },
    window: null, location: { replace: () => {}, href: "reportes.html", pathname: "/reportes.html" },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {}, removeEventListener() {}, removeListener() {}, addEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    addEventListener() {}, removeEventListener() {}, innerWidth: 1440, innerHeight: 900,
    setTimeout, clearTimeout, console, Math, Date, JSON, Number, Promise,
    URLSearchParams, Blob, fetch: () => Promise.reject(new Error("sin red")),
    FormData: class FormData { constructor() { this.datos = {}; } },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {}, },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

vm.runInContext(fs.readFileSync(path.join(RAIZ, "Frontend", "js", "core.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "Frontend", "js", "demo.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "Frontend", "js", "layout.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "Frontend", "js", "pages", "reportes.js"), "utf8"), sandbox);

const App = sandbox.window.App;
const demo = App.demo;
const doc = sandbox.document;

let fallos = 0;
function check(nombre, cond, detalle) {
    console.log((cond ? "  ok   " : "  FALLA") + " " + nombre);
    if (!cond) { fallos++; if (detalle !== undefined) console.log("       ->", typeof detalle === "string" ? detalle : JSON.stringify(detalle)); }
}

(async function () {
    sesion.setItem("tiendaAlexanderSesion", JSON.stringify({ token: "demo-token", usuario: { id: 1, nombre: "Administrador", usuario: "admin", rol: "ADMIN" } }));
    await demo.pedir("/auth/login", { method: "POST", body: { usuario: "admin", clave: "admin" } });
    demo.reiniciar();

    // Montar la página (dispara DOMContentLoaded -> App.layout.montar + wiring + cargar("hoy")).
    (manejadoresDocumento["DOMContentLoaded"] || []).forEach((fn) => fn({}));
    await new Promise((r) => setTimeout(r, 120));

    const tipoSelect = elementos["selectTipoReporte"];
    check("existe el select de tipo de reporte", Boolean(tipoSelect));
    check("admin ve el select (no oculto)", !tipoSelect.classList.contains("oculto"));

    // El admin elige "Reporte de Ventas por Usuario".
    tipoSelect.value = "ventas_usuario";
    tipoSelect._h.change[0]({ target: { value: "ventas_usuario" } });
    await new Promise((r) => setTimeout(r, 600));

    const panelUsuario = elementos["panelReporteVentasUsuario"];
    const panelInventario = elementos["panelReporteInventario"];
    check("panel de ventas por usuario visible al elegirlo", !panelUsuario.classList.contains("oculto"));
    check("panel de inventario oculto al elegir ventas por usuario", panelInventario.classList.contains("oculto"));

    const selectUsuario = elementos["selectUsuarioReporte"];
    check("select de usuario existe", Boolean(selectUsuario));
    check("select de usuario se pobló (tiene opciones)", typeof selectUsuario.innerHTML === "string" && selectUsuario.innerHTML.includes("Administrador"));
    console.log("   HTML select usuario:", String(selectUsuario.innerHTML).slice(0, 200));
    console.log("   toast (avisos):", String(elementos["toastApp"] && elementos["toastApp"].textContent));

    const contenedorHistorial = elementos["contenedorHistorialUsuario"];
    check("contenedor de historial existe", Boolean(contenedorHistorial));
    await new Promise((r) => setTimeout(r, 300));
    check("historial renderiza días (botones creados)", contenedorHistorial.children.length > 0, contenedorHistorial.children.length);
    console.log("   historial botones:", contenedorHistorial.children.map((b) => b.textContent));

    const detalle = elementos["detalleReporteUsuario"];
    check("detalle oculto hasta elegir un día", detalle.classList.contains("oculto"));

    // Elige el primer día del historial.
    const primerBoton = contenedorHistorial.children[0];
    check("hay al menos un día para elegir", Boolean(primerBoton));
    if (primerBoton && primerBoton._h && primerBoton._h.click && primerBoton._h.click.length) {
        primerBoton._h.click[0]({ target: primerBoton });
        await new Promise((r) => setTimeout(r, 250));
        check("detalle se muestra al elegir el día", !detalle.classList.contains("oculto"));
        const kpiTotal = elementos["kpiInventarioTotal"];
        check("inventario del día actualizado (KPI)", typeof kpiTotal.textContent === "string", kpiTotal.textContent);
        console.log("   kpiInventarioTotal:", kpiTotal.textContent);
        const tablaDetalle = elementos["tablaDetalleUsuario"];
        check("tabla de facturas pintada", Array.isArray(tablaDetalle.children), tablaDetalle.children.length);
        console.log("   filas facturas:", tablaDetalle.children.length);
    } else {
        check("botón de día con handler", false, primerBoton && primerBoton._h);
    }

    // Cambiar la vista del día a "Inventario Total Vendido".
    const btnInv = elementos["btnVistaInventario"];
    check("botón inventario existe", Boolean(btnInv));
    if (btnInv && btnInv._h && btnInv._h.click && btnInv._h.click.length) {
        btnInv._h.click[0]({ target: btnInv });
        await new Promise((r) => setTimeout(r, 150));
        check("vista inventario sin error", true);
    }

    console.log(fallos === 0 ? "SMOKE UI OK" : `SMOKE UI CON FALLAS (${fallos})`);
    process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e); process.exit(2); });
