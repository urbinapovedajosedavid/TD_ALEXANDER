/* Comprueba que cada clase usada en el HTML y en los scripts exista en el
 * CSS, y que ninguna hoja de estilos tenga reglas que no usa nadie.
 *
 * Uso:  node tests/auditar_css.js
 */

const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const FRONT = path.join(RAIZ, "Frontend");

const htmls = fs.readdirSync(FRONT).filter((f) => f.endsWith(".html"));
const scripts = [];
(function recorrer(dir) {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entrada.name);
        if (entrada.isDirectory()) recorrer(p);
        else if (entrada.name.endsWith(".js")) scripts.push(p);
    }
})(path.join(FRONT, "js"));

const hojas = fs.readdirSync(path.join(FRONT, "css")).filter((f) => f.endsWith(".css"));

/* Hay dos listas y no se pueden mezclar:
 *
 *  - declaradas: clases que aparecen de verdad en un atributo class="...",
 *    en un classList o en un class="a ${cond ? 'b' : 'c'}". Sobre esta lista
 *    se avisa si falta la definición en el CSS, así que no admite falsos
 *    positivos.
 *
 *  - posibles: cualquier texto corto en minúsculas dentro de un script.
 *    Sirve solo para no marcar como sobrante una regla que quizá se aplica
 *    desde código. Al ser amplia no genera avisos por sí sola.
 */
const declaradas = new Map(); // clase -> hojas donde tendría que existir
const posibles = new Set();

/* Solo cuentan los tokens que pueden ser una clase de verdad. Hace falta
 * porque hay plantillas del tipo:
 *     class="nav-item ${p.clave === activa ? "nav-item-activa" : ""}"
 * donde el class="..." se corta en el primer " y se traga la expresión
 * de JavaScript, con cosas como "===" o "?" que no son clases. */
const ES_CLASE = /^[A-Za-z_-][A-Za-z0-9_-]*$/;

function anotar(clase, hojas) {
    if (!ES_CLASE.test(clase)) return;
    if (!declaradas.has(clase)) declaradas.set(clase, new Set());
    hojas.forEach((h) => declaradas.get(clase).add(h));
}

for (const f of htmls) {
    const t = fs.readFileSync(path.join(FRONT, f), "utf8");
    const cargadas = [...t.matchAll(/href="css\/([^"]+)"/g)].map((m) => m[1]);
    for (const m of t.matchAll(/class="([^"]+)"/g)) {
        m[1].split(/\s+/).filter(Boolean).forEach((c) => anotar(c, cargadas));
    }
}

/* Los scripts generan clases al vuelo: se reparten entre todas las hojas
 * porque un mismo script sirve para varias páginas. */
const todasLasHojas = hojas;
for (const p of scripts) {
    const t = fs.readFileSync(p, "utf8");

/* class="algo" en el HTML y en las plantillas de los scripts.
     *
     * El recorte se detiene en el primer ", $, \n o { para no comerse la
     * expresión de una interpolación. En
     *     class="nav-item ${x ? "nav-item-activa" : ""}"
     * el $ corta antes de la comilla interna, así que el condicional se
     * resuelve aparte con `posibles`. */
    for (const m of t.matchAll(/class="([^"${\n]*)"/g)) {
        m[1].split(/\s+/).filter(Boolean).forEach((c) => anotar(c, todasLasHojas));
    }

    /* classList es exacto y sí puede ir a declaradas. */
    for (const m of t.matchAll(/classList\.(?:add|remove|toggle|contains)\(\s*["']([^"']+)["']/g)) {
        anotar(m[1], todasLasHojas);
    }

    /* "nav-item-activa", "peligro" y similares aparecen como textos
     * sueltos dentro de plantillas. Van a posibles porque desde un texto
     * suelto no se puede saber si será una clase o un id. */
    for (const m of t.matchAll(/["'`]([a-z][a-z0-9-]{2,})["'`]/g)) {
        posibles.add(m[1]);
    }
}

/* Clases definidas en el CSS. Se ignoran los estados que CSS define solo
 * paraorque el navegador los aplique (.hover:focus, @media, etc.). */
const definidas = new Map();

function registrar(css, hoja) {
    /* Se borran los comentarios: la nota del principio de base.css nombra
     * clases que ya no existen y el parser las tomaría por reglas. */
    const t = css.replace(/\/\*[\s\S]*?\*\//g, " ");

    for (const m of t.matchAll(/(^|\})\s*([^{}@/][^{}]*)\{/gm)) {
        m[2].split(",").forEach((selector) => {
            /* Se buscan clases en cualquier parte del selector, no solo al
             * principio: .badge.agotado o .seccion p.subtitulo también
             * definen las dos. */
            for (const c of selector.matchAll(/\.([A-Za-z_][\w-]*)/g)) {
                if (!definidas.has(c[1])) definidas.set(c[1], new Set());
                definidas.get(c[1]).add(hoja);
            }
        });
    }
}

for (const f of hojas) {
    registrar(fs.readFileSync(path.join(FRONT, "css", f), "utf8"), f);
}

/* La factura se abre en una pestaña aparte y no carga ninguna hoja del
 * sistema: lleva su CSS dentro de un <style>. Sin esto, sus clases
 * (.hoja, .totales, .encabezado...) aparecerían como clases sin definir. */
const EN_LINEA = "css incrustado";
for (const p of scripts) {
    const t = fs.readFileSync(p, "utf8");
    for (const m of t.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
        registrar(m[1], EN_LINEA);
    }
}

/* Para cada clase usada, tiene que existir en alguna de las hojas que esa
 * página carga (normalmente base.css más la específica). */
const sinDefinir = [];
for (const [clase, hojasPagina] of declaradas) {
    /* "css" no es una clase: sale de leer href="css/x.css" como selector. */
    if (clase === "css") continue;

    const donde = definidas.get(clase);
    /* El CSS incrustado cuenta siempre: la factura abre su propia pestaña y
     * no carga ninguna hoja, así que sus clases no pueden aparecer en la
     * lista <link> de ninguna página. */
    const sirve =
        donde && (donde.has(EN_LINEA) || [...hojasPagina].some((h) => donde.has(h)));
    if (!sirve) sinDefinir.push([clase, [...hojasPagina].join(", ")]);
}
sinDefinir.sort();

/* Una regla está sobrante solo si su clase no sale ni de un class="..." ni
 * de ningún texto suelto de los scripts. */
const sinUsar = [...definidas.keys()]
    .filter((c) => c !== "css" && !declaradas.has(c) && !posibles.has(c))
    .sort();

console.log(`declaradas: ${declaradas.size}   definidas: ${definidas.size}`);

if (sinDefinir.length) {
    console.log(`\nCLASES QUE SE USAN PERO NO ESTÁN DEFINIDAS (${sinDefinir.length}):`);
    sinDefinir.forEach(([c, h]) => console.log(`   .${c}  (pide ${h})`));
}

if (sinUsar.length) {
    console.log(`\nCLASES DEFINIDAS QUE NADIE USA (${sinUsar.length}):`);
    sinUsar.forEach((c) =>
        console.log("   ." + c + "   (" + [...definidas.get(c)].join(", ") + ")")
    );
}

console.log("\n" + "=".repeat(52));
if (sinDefinir.length || sinUsar.length) process.exit(1);
console.log("CSS LIMPIO");