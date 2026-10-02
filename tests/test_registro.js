/* Prueba del alta de cuentas sin servidor.
 *
 * Ejecuta core.js, demo.js, registro.js y login.js con los almacenes y un
 * DOM simulados, y recorre el camino completo: crear una cuenta desde la
 * pantalla de alta (a la que se entra sin sesión) y usarla para iniciar
 * sesión, tanto con el servidor caído como con el servidor encendido.
 *
 * Lo que se comprueba aquí es justamente lo que fallaba: la pantalla de
 * alta pedía sesión con App.auth.exigir() y el botón del login rebotaba
 * al login, así que el alta era imposible de completar.
 *
 * Uso:  node tests/test_registro.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.resolve(__dirname, "..");
const JS = path.join(RAIZ, "Frontend", "js");

/* ---------- Almacenes en memoria ---------- */

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

/* ---------- DOM mínimo ---------- */

function elemento(id) {
    return {
        id,
        value: "",
        textContent: "",
        className: "",
        hidden: false,
        style: {},
        listeners: {},
        addEventListener(tipo, fn) {
            (this.listeners[tipo] = this.listeners[tipo] || []).push(fn);
        },
        reset() {
            this.value = "";
        },
        focus() {},
        querySelectorAll: () => [],
    };
}

const IDS = [
    "formUsuarioModal", "usuarioModal", "claveModal", "mensajeModal",
    "btnVolverLogin", "btnEntrarNuevo",
    "formLogin", "usuarioLogin", "claveLogin", "mensajeLogin", "btnIrRegistro",
];

/* btnEntrarNuevo nace con el atributo hidden en el HTML: el DOM simulado
 * tiene que reflejarlo o el test daría por bueno un botón visible. */
const OCULTOS_AL_NACER = new Set(["btnEntrarNuevo"]);

const nodos = {};
IDS.forEach((id) => {
    nodos[id] = elemento(id);
    nodos[id].hidden = OCULTOS_AL_NACER.has(id);
});

const errores = [];

const sandbox = {
    localStorage: local,
    sessionStorage: sesion,
    document: {
        body: { appendChild() {} },
        createElement: () => elemento("creado"),
        getElementById: (id) => nodos[id] || null,
        addEventListener: (tipo, fn) => {
            if (tipo === "DOMContentLoaded") sandbox.__listeners.push(fn);
        },
    },
    location: { href: "", replace: (d) => (sandbox.location.href = d) },
    setTimeout,
    clearTimeout,
    console,
    Math,
    Date,
    JSON,
    Number,
    String,
    Promise,
    AbortController,
    __listeners: [],
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

/* El servidor se simula con un fetch que responde 401 a todo: es el caso
 * que rompía el alta, con el servidor encendido y sin sesión. */
let servidorEncendido = false;

sandbox.fetch = async (url) => {
    if (!servidorEncendido) {
        throw new Error("ECONNREFUSED");
    }
    return {
        ok: false,
        status: 401,
        json: async () => ({ mensaje: "Usuario o contraseña incorrectos." }),
    };
};

vm.createContext(sandbox);

for (const archivo of ["core.js", "demo.js", "pages/registro.js", "pages/login.js"]) {
    vm.runInContext(fs.readFileSync(path.join(JS, archivo), "utf8"), sandbox, {
        filename: archivo,
    });
}

const App = sandbox.window.App;

/* Dispara el DOMContentLoaded de las dos pantallas. */
function abrirPantallas() {
    sandbox.__listeners.slice().forEach((fn) => fn());
}

/* ---------- Aserciones ---------- */

let fallos = 0;
const checks = [];

function check(nombre, condicion, detalle) {
    checks.push({ nombre, condicion: Boolean(condicion), detalle });
    if (!condicion) fallos++;
}

function errorDe(fn) {
    try {
        fn();
        return null;
    } catch (e) {
        return e.message;
    }
}

/* Envía el formulario. Si no hay nadie escuchando devuelve false en vez de
 * reventar: una pantalla que registró mal el evento es un fallo del test,
 * no una excepción que deba tumbar la corrida entera. */
async function enviar(nodo) {
    const oyentes = (nodo.listeners.submit || []);
    if (!oyentes.length) return false;
    await oyentes[0]({ preventDefault() {}, target: nodo });
    return true;
}

async function main() {
    /* --- 1. La pantalla de alta se abre sin sesión --- */

    sesion.removeItem("tiendaAlexanderSesion");
    abrirPantallas();

    check("sin sesión, la pantalla de alta no manda al login",
        sandbox.location.href === "",
        `href quedó en "${sandbox.location.href}"`);

    check('sin sesión, el botón "Ir a iniciar sesión" sigue oculto',
        nodos.btnEntrarNuevo.hidden === true);

    check("el formulario de alta quedó escuchando el submit",
        (nodos.formUsuarioModal.listeners.submit || []).length > 0,
        "nadie se suscribió: la pantalla no funciona");
    check("el formulario de login quedó escuchando el submit",
        (nodos.formLogin.listeners.submit || []).length > 0,
        "nadie se suscribió: la pantalla no funciona");

    /* --- 2. Validaciones del alta --- */

    nodos.usuarioModal.value = "ab";
    nodos.claveModal.value = "1234";
    await enviar(nodos.formUsuarioModal);
    check("rechaza usuario de menos de 3 caracteres",
        /al menos 3 caracteres/.test(nodos.mensajeModal.textContent),
        nodos.mensajeModal.textContent);

    nodos.usuarioModal.value = "carla";
    nodos.claveModal.value = "123";
    await enviar(nodos.formUsuarioModal);
    check("rechaza contraseña de menos de 4 caracteres",
        /al menos 4 caracteres/.test(nodos.mensajeModal.textContent),
        nodos.mensajeModal.textContent);

    /* --- 3. Alta correcta con el servidor apagado --- */

    servidorEncendido = false;
    App.demo.marcarCaido();

    nodos.usuarioModal.value = "carla";
    nodos.claveModal.value = "clave123";
    await enviar(nodos.formUsuarioModal);

    check("crea la cuenta sin servidor", /creado/i.test(nodos.mensajeModal.textContent),
        nodos.mensajeModal.textContent);
    check("mensaje de éxito", /mensaje exito/.test(nodos.mensajeModal.className),
        nodos.mensajeModal.className);
    check("aparece el botón para ir a iniciar sesión",
        nodos.btnEntrarNuevo.hidden === false);

    const guardada = App.cuentas.buscar("carla");
    check("la cuenta queda guardada", Boolean(guardada));
    check("la cuenta no trae la contraseña", guardada && guardada.clave === undefined,
        JSON.stringify(guardada));
    check("la cuenta nace como VENDEDOR", guardada && guardada.rol === "VENDEDOR",
        guardada && guardada.rol);

    /* --- 4. No se puede repetir el mismo usuario --- */

    nodos.usuarioModal.value = "carla";
    nodos.claveModal.value = "otra123";
    await enviar(nodos.formUsuarioModal);
    check("rechaza usuario repetido", /ya existe/i.test(nodos.mensajeModal.textContent),
        nodos.mensajeModal.textContent);

    /* La comparación ignora mayúsculas: CARLA es la misma cuenta. */
    nodos.usuarioModal.value = "CARLA";
    nodos.claveModal.value = "otra123";
    await enviar(nodos.formUsuarioModal);
    check("el usuario repetido se detecta sin importar las mayúsculas",
        /ya existe/i.test(nodos.mensajeModal.textContent),
        nodos.mensajeModal.textContent);

    /* --- 5. Entrar con la cuenta recién creada, servidor apagado --- */

    sesion.removeItem("tiendaAlexanderSesion");
    sesion.removeItem("tiendaAlexanderDemo");

    nodos.usuarioLogin.value = "carla";
    nodos.claveLogin.value = "clave123";
    await enviar(nodos.formLogin);

    check("inicia sesión con la cuenta creada",
        Boolean(App.auth.actual()) && App.auth.actual().usuario === "carla",
        JSON.stringify(App.auth.actual()));
    check("la sesión local se marca como local", App.auth.esLocal() === true);

    /* Con sesión local, las peticiones van a la demo y no a un servidor
     * que rechazaría el token "local". */
    const productos = await App.api.productos();
    check("con sesión local la API responde con la demo",
        Array.isArray(productos) && productos.length > 0,
        `${productos && productos.length} productos`);

    /* --- 6. Clave incorrecta no entra --- */

    sesion.removeItem("tiendaAlexanderSesion");
    sesion.removeItem("tiendaAlexanderDemo");

    nodos.usuarioLogin.value = "carla";
    nodos.claveLogin.value = "equivocada";
    await enviar(nodos.formLogin);

    check("una clave incorrecta no abre sesión", App.auth.actual() === null);
    check("avisa del error en la pantalla",
        /incorrect/i.test(nodos.mensajeLogin.textContent),
        nodos.mensajeLogin.textContent);

    /* --- 7. Con el servidor ENCENDIDO y sin conocer la cuenta --- */

    servidorEncendido = true;

    /* Que no se cuele el atajo de "el servidor está caído": hay que esperar
     * a que expire la marca que dejaron los pasos anteriores. Se adelanta el
     * reloj en vez de esperar de verdad. */
    const ahoraReal = Date.now;
    Date.now = () => ahoraReal() + 60 * 60 * 1000;

    check("el atajo de servidor caído está expirado",
        App.demo.sinServidor() === false,
        `sinServidor=${App.demo.sinServidor()}`);

    nodos.usuarioLogin.value = "carla";
    nodos.claveLogin.value = "clave123";
    await enviar(nodos.formLogin);

    check("con servidor encendido también entra la cuenta local",
        Boolean(App.auth.actual()) && App.auth.actual().usuario === "carla",
        JSON.stringify(App.auth.actual()));
    check("esa sesión queda marcada como local", App.auth.esLocal() === true);

    /* Y con el servidor ya levantado, la sesión local no manda un token
     * inventado al servidor: sigue hablando con la demo. */
    const productos2 = await App.api.productos();
    check("con servidor encendido la sesión local sigue en la demo",
        Array.isArray(productos2) && productos2.length > 0,
        `${productos2 && productos2.length} productos`);

    Date.now = ahoraReal;

    /* --- 8. Las cuentas del admin de la demo siguen entrando --- */

    sesion.removeItem("tiendaAlexanderSesion");
    sesion.removeItem("tiendaAlexanderDemo");
    App.demo.marcarCaido();

    nodos.usuarioLogin.value = "admin";
    nodos.claveLogin.value = "admin";
    await enviar(nodos.formLogin);

    check("el admin de la demo sigue entrando",
        Boolean(App.auth.actual()) && App.auth.actual().rol === "ADMIN",
        JSON.stringify(App.auth.actual()));

    /* --- 9. Borrar las cuentas locales --- */

    check("hay 1 cuenta local", App.cuentas.lista().length === 1,
        JSON.stringify(App.cuentas.lista()));

    App.cuentas.borrarTodas();
    check("borrarTodas deja la lista vacía", App.cuentas.lista().length === 0);
    check("tras borrar, buscar no encuentra la cuenta", App.cuentas.buscar("carla") === null);

    /* --- 10. Almacenamiento corrupto --- */

    local.setItem("tiendaAlexanderCuentasLocales", "{no es json");
    check("aguanta un localStorage corrupto en vez de romperse",
        App.cuentas.lista().length === 0);

    /* --- Resumen --- */

    console.log("");
    for (const c of checks) {
        if (!c.condicion) {
            console.log(`  FALLA  ${c.nombre}${c.detalle ? "  -> " + c.detalle : ""}`);
        }
    }
    console.log("\n" + "=".repeat(52));
    console.log(fallos
        ? `${fallos} de ${checks.length} comprobaciones fallaron`
        : `TODAS LAS PRUEBAS DEL ALTA PASARON (${checks.length})`);
    process.exit(fallos ? 1 : 0);
}

main().catch((e) => {
    console.error("La prueba reventó:", e);
    process.exit(1);
});