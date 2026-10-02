/* Auditoría de páginas: controles con id en el HTML que ningún script toca,
 * ids que el JS busca y no existen, ids duplicados y scripts mal declarados.
 *
 * Los ids que layout.js inyecta en el momento de montar la página se
 * consideran correctos aunque no estén escritos en el HTML.
 *
 * Uso:  node tests/auditar_paginas.js
 */

const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const FRONT = path.join(RAIZ, "Frontend");
const JS = path.join(FRONT, "js");

/* Página -> script propio. [] = no usa scripts. */
const PAGINAS = {
    "index.html": [],
    "login.html": ["login.js"],
    "agregar_usuario.html": ["registro.js"],
    "inicio.html": ["inicio.js"],
    "ventas.html": ["ventas.js"],
    "almacen.html": ["almacen.js"],
    "reportes.html": ["reportes.js"],
    "provedores.html": ["provedores.js"],
    "copia_de_seguridad.html": ["copia_de_seguridad.js"],
};

const leer = (ruta) => fs.readFileSync(ruta, "utf8");

const COMUNES = ["core.js", "demo.js", "layout.js"];
const fuenteComun = [leer(path.join(JS, "core.js")), leer(path.join(JS, "demo.js")), leer(path.join(JS, "layout.js"))].join("\n");

/* Ids que los scripts crean en tiempo de ejecución (layout.js arma la
 * cabecera y los modales; core.js arma el aviso flotante). No hace falta
 * que estén escritos en el HTML. */
const IDS_INYECTADOS = [
    ...fuenteComun.matchAll(/id="([^"]+)"/g),
    ...fuenteComun.matchAll(/\.id = "([^"]+)"/g),
].map((m) => m[1]);

let problemas = 0;

for (const [html, script] of Object.entries(PAGINAS)) {
    const fuente = leer(path.join(FRONT, html));

    const cargados = [...fuente.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

    const propios = [].concat(script);
    const fuentes = COMUNES.length ? [fuenteComun] : [];
    propios.forEach((s) => fuentes.push(leer(path.join(JS, "pages", s))));
    const todo = fuentes.join("\n");

    /* Controles del HTML que nadie menciona. */
    const ids = [...new Set(
        [...fuente.matchAll(/<(?:button|a|input|select|textarea|form)\b[^>]*\bid="([^"]+)"/g)]
            .map((m) => m[1])
    )];

    const huerfanos = ids.filter(
        (id) => !todo.includes(`"${id}"`) && !todo.includes(`'${id}'`) && !todo.includes(`"${id}`)
    );

    /* ids que el JS busca y el HTML no define (salvo los inyectados). */
    const buscados = [...new Set(
        [...todo.matchAll(/\$\("([^"]+)"\)|getElementById\("([^"]+)"\)/g)].map((m) => m[1] || m[2])
    )];
    const faltan = buscados.filter(
        (id) => !fuente.includes(`id="${id}"`) && !IDS_INYECTADOS.includes(id)
    );

    /* ids repetidos en el mismo HTML. */
    const todos = [...fuente.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    const duplicados = [...new Set(todos.filter((v, i) => todos.indexOf(v) !== i))];

    /* index.html solo redirige: no carga scripts. */
    const esperaLayout = html !== "index.html" && !propios.every((s) => ["login.js", "registro.js"].includes(s));
    const esperados = (html === "index.html" ? [] : COMUNES.filter((c) => c !== "layout.js" || esperaLayout)).concat(propios.map((s) => "pages/" + s));
    const sinCargar = esperados.filter((s) => !cargados.includes("js/" + s));

    const lista = [
        ["control sin usar", huerfanos],
        ["id buscado y ausente", faltan],
        ["id duplicado", duplicados],
        ["script no cargado", sinCargar],
    ].filter(([, v]) => v.length);

    if (lista.length) {
        problemas++;
        console.log(`\n${html}`);
        for (const [etiqueta, valores] of lista) {
            valores.forEach((v) => console.log(`   ${etiqueta.padEnd(22)} ${v}`));
        }
    } else {
        console.log(`  ok  ${html.padEnd(24)} ${ids.length} controles, ${cargados.length} scripts`);
    }
}

/* ---------- Métodos de App que no existen ----------
 *
 * El botón "Eliminar" del inventario no hacía nada porque llamaba a
 * App.ui.confirmir() en vez de App.ui.confirmar(). Como el método no
 * existe, la línea tiraba TypeError y el clic se moría en silencio: el
 * HTML estaba bien, el botón tenía su listener, y ninguna de las pruebas
 * anteriores lo notaba porque revisan la API, no el DOM.
 *
 * Esto compara cada llamada App.<algo>.<metodo>() con lo que ese módulo
 * realmente exporta.
 */

/* Quita los comentarios. El [^:] antes del // protege las URLs del tipo
 * "http://127.0.0.1:5000/api", que si no se partían por la mitad.
 *
 * Esto va antes de cualquier troceado: los comentarios decorativos del
 * return traen comas ("/* Descarga la copia: el archivo .db, y en la demo..."),
 * y si se dividiera por comas sin limpiarlos primero, un comentario partía
 * la clave que venía justo después. */
function sinComentarios(fuente) {
    return fuente
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/* Devuelve las claves del objeto que devuelve un módulo de la forma
 * App.<nombre> = (function () { ... return { a, b: ..., c() {} }; })();
 * Hay que respetar las llaves anidadas: las funciones del return pueden
 * tener su propio { }. */
function clavesDelReturn(fuente, nombre) {
    const limpio = sinComentarios(fuente);

    const inicio = limpio.search(new RegExp(`App\\.${nombre}\\s*=\\s*\\(function`));
    if (inicio === -1) return null;

    /* Se toma el ÚLTIMO return { antes del })(); que cierra el módulo, no el
     * primero. Un módulo puede tener returns intermedios dentro de sus
     * funciones (los datos de ejemplo de la demo, los errores de validación),
     * y con el primero se leían las claves del return equivocado: de ahí que
     * App.demo pareciera no exportar nada. */
    const fin = limpio.indexOf("})();", inicio);
    const desde = limpio.lastIndexOf("return {", fin === -1 ? limpio.length : fin);
    if (desde === -1) return null;

    const claves = new Set();
    let profundidad = 0;
    let actual = "";

    for (let i = desde + "return {".length; i < limpio.length; i++) {
        const c = limpio[i];

        if (c === "{" || c === "[" || c === "(") profundidad++;
        else if (c === "}" || c === "]" || c === ")") {
            if (profundidad === 0) break;
            profundidad--;
        }

        // Una coma a nivel de este objeto separa dos claves.
        if (c === "," && profundidad === 0) {
            agregar(actual);
            actual = "";
            continue;
        }
        actual += c;
    }
    agregar(actual);

    function agregar(texto) {
        const m = texto.trim().match(/^([A-Za-z_$][\w$]*)\s*[:(]?/);
        if (m) claves.add(m[1]);
    }

    return claves;
}

const MODULOS = ["api", "auth", "fmt", "ui", "factura", "layout", "demo", "cuentas"];
const exportados = {};
for (const m of MODULOS) {
    const claves = clavesDelReturn(fuenteComun, m);
    if (claves) exportados[m] = claves;
}

const llamadasMalas = [];

const scripts = [
    ...COMUNES.map((c) => path.join(JS, c)),
    ...fs.readdirSync(path.join(JS, "pages")).map((c) => path.join(JS, "pages", c)),
];

for (const ruta of scripts) {
    const archivo = path.relative(path.join(RAIZ, "Frontend"), ruta).replace(/\\/g, "/");

    for (const m of sinComentarios(leer(ruta)).matchAll(/\bApp\.([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)\s*\(/g)) {
        const [, modulo, metodo] = m;
        if (!exportados[modulo]) continue;      // no es un módulo conocido
        if (exportados[modulo].has(metodo)) continue;
        llamadasMalas.push(`${archivo}: App.${modulo}.${metodo}()`);
    }
}

if (llamadasMalas.length) {
    problemas++;
    console.log("\nllamadas a métodos que no existen");
    [...new Set(llamadasMalas)].forEach((v) => console.log("   " + v));
}

console.log("\n" + "=".repeat(52));
console.log(problemas ? `${problemas} página(s) con detalles` : "TODAS LAS PÁGINAS ESTÁN LIMPIAS");
process.exit(problemas ? 1 : 0);