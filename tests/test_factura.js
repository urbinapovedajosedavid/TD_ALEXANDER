/* Prueba de la factura imprimible (App.factura en js/core.js).
 *
 * La factura es lo único que el sistema entrega en papel, así que se
 * revisa como documento: que tenga tabla de verdad, que los números
 * cuadren y, sobre todo, que escape los nombres de producto: esos nombres
 * los escribe el usuario y llegan hasta un document.write.
 *
 * Uso:  node tests/test_factura.js
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

const sandbox = {
    localStorage: almacen(),
    sessionStorage: almacen(),
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
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

vm.runInContext(
    fs.readFileSync(path.join(RAIZ, "Frontend", "js", "core.js"), "utf8"),
    sandbox
);

const { factura, fmt } = sandbox.window.App;

let fallos = 0;
let total = 0;
function check(nombre, condicion, detalle) {
    total++;
    if (condicion) {
        console.log("  ok   " + nombre);
    } else {
        fallos++;
        console.log("  FALLA " + nombre + (detalle !== undefined ? " -> " + JSON.stringify(detalle) : ""));
    }
}

const VENTA = {
    id: 42,
    fecha: "2026-10-01 14:30:00",
    metodo_pago: "efectivo",
    vendedor: "Administrador",
    subtotal: 1120.5,
    impuesto: 168.08,
    total: 1288.58,
    items: [
        { nombre: "Lavadora", cantidad: 2, precio_unitario: 500, subtotal: 1000 },
        { nombre: "Microondas", cantidad: 1, precio_unitario: 120.5, subtotal: 120.5 },
    ],
};

console.log("\n== estructura del documento ==");
const html = factura.plantilla(VENTA);

check("es un documento HTML completo", html.startsWith("<!DOCTYPE html>"), html.slice(0, 40));
check("lleva su propio estilo", html.includes("<style>"), "");
check("tiene charset para los acentos", /<meta charset="utf-8">/.test(html), "");
check("el título lleva el número", html.includes("<title>Factura 42</title>"), "");

console.log("\n== tabla de productos ==");
check("hay una tabla", html.includes("<table>") && html.includes("</table>"), "");
// <th[ >] y no <th, porque si no también cuenta el <thead>.
check("tiene cabecera de columnas", (html.match(/<th[ >]/g) || []).length === 5, "");
check("una fila por producto", (html.match(/<tr>/g) || []).length === 3, "");
check("sale el nombre del producto", html.includes("Lavadora"), "");
check("sale la cantidad", html.includes("<td class=\"num\">2</td>"), "");
check("el precio sale con signo de moneda", html.includes("$500.00"), "");
check("el importe sale con signo de moneda", html.includes("$1,000.00"), "");
check("los decimales de cada linea cuadran", html.includes("$120.50"), "");

console.log("\n== datos de la cabecera ==");
check("el número de factura", html.includes("#42"), "");
check("el nombre del negocio", html.includes("Tienda Alexander"), "");
check("el nombre del negocio es el completo, no recortado",
    !/>\s*Alexander\s*</.test(html), "");
check("la fecha", /\d{2}\/\d{2}\/\d{4}/.test(html), "");
check("el método de pago traducido", html.includes("Efectivo"), "");
check("el vendedor", html.includes("Administrador"), "");
check("el total de artículos", html.includes(">3<"), "");
check("el IVA muestra el porcentaje", html.includes("IVA (15%)"), "");

console.log("\n== totales ==");
check("subtotal", html.includes("$1,120.50"), "");
check("impuesto", html.includes("$168.08"), "");
check("total", html.includes("$1,288.58"), "");

console.log("\n== es una tabla de verdad, no texto suelto ==");
check("no usa border= old school", !/<table[^>]*border=/.test(html), "");
check("no usa cellpadding", !/<table[^>]*cellpadding/.test(html), "");
check("no hay cellspacing", !/<table[^>]*cellspacing/.test(html), "");
check("no deja <h2> sueltos como título", !/<h2>/.test(html), "");
check("el total está en un bloque propio", html.includes("class=\"gran\""), "");

console.log("\n== sin textos de relleno al pie ==");
// Se pidió quitarlo: la factura no lleva pies de página con frases de la
// casa ni nada escrito por debajo de los totales.
check("no dice 'Documento generado por'",
    !html.includes("Documento generado por"), "");
check("no dice 'sistema de ventas'", !/sistema de ventas/i.test(html), "");
check("no tiene etiqueta <footer>", !/<footer/.test(html), "");
check("no queda la clase .pie huérfana",
    !html.includes("class=\"pie\"") && !/\.pie\s*{/.test(html), "");
check("no hay texto despues de la tabla de totales",
    !/<\/table>[\s\S]*Documento/.test(html), "");

console.log("\n== impresión ==");
check("define @page con márgenes", html.includes("@page"), "");
check("oculta los botones al imprimir", /@media print[\s\S]*\.acciones \{ display: none/.test(html), "");
check("no parte filas entre páginas", html.includes("page-break-inside: avoid"), "");
check("repite la cabecera en cada página", html.includes("table-header-group"), "");
check("los números van alineados a la derecha", html.includes("text-align: right"), "");
check("las cifras usan ancho fijo", html.includes("tabular-nums"), "");

console.log("\n== nombres raros ==");
const conComillas = factura.plantilla({
    ...VENTA,
    items: [
        {
            nombre: 'Cafetera "Deluxe" <b>XL</b>',
            cantidad: 1,
            precio_unitario: 10,
            subtotal: 10,
        },
    ],
});

check("escapa las comillas del nombre", conComillas.includes("&quot;Deluxe&quot;"), "");
check("escapa las etiquetas del nombre", conComillas.includes("&lt;b&gt;XL&lt;/b&gt;"), "");
check("no inyecta HTML crudo", !conComillas.includes("<b>XL</b>"), "");
check("sigue mostrando el nombre", conComillas.includes("Cafetera"), "");

console.log("\n== venta recién cobrada vs. reimpresa ==");
// POST /api/ventas responde con venta_id; GET /api/ventas/<id> con id.
const cobrada = factura.plantilla({ ...VENTA, venta_id: 77, id: undefined });
check("la venta recién cobrada usa venta_id", cobrada.includes("#77"), "");
check("y no deja el id en undefined", !cobrada.includes("undefined"), "");
check("su titulo tambien lleva el numero", cobrada.includes("<title>Factura 77</title>"), "");

console.log("\n== casos raros ==");
const sinDetalle = factura.plantilla({ ...VENTA, items: [] });
check("venta sin detalle no rompe la tabla", sinDetalle.includes("<table>"), "");
check("muestra una fila en vez de una tabla vacía", sinDetalle.includes("Sin detalle"), "");
check("no inventa un total", sinDetalle.includes("$1,288.58"), "");

const sinNombre = factura.plantilla({
    id: 1,
    fecha: "2026-10-01 10:00:00",
    metodo_pago: "bitcoin",
    subtotal: 0,
    impuesto: 0,
    total: 0,
    items: [],
});
check("metodo de pago desconocido no queda vacío", sinNombre.includes("bitcoin"), "");
check("vendedor ausente no rompe", sinNombre.includes("—"), "");
check("total cero se formatea", sinNombre.includes("$0.00"), "");

console.log("\n" + "=".repeat(52));
if (fallos) {
    console.log("FALLARON " + fallos + " de " + total);
    process.exit(1);
}
console.log("TODAS LAS PRUEBAS DE LA FACTURA PASARON (" + total + ")");