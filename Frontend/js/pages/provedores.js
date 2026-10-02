/* Módulo de proveedores.
 *
 * Antes leía y escribía en localStorage con sus propios helpers
 * (leerProveedores/guardarProveedores). Ahora usa la tabla `proveedores`
 * a través de la API, sin código de persistencia en el navegador.
 */

(function () {
    const $ = (id) => document.getElementById(id);

    let proveedores = [];

    async function cargar() {
        try {
            proveedores = await App.api.proveedores();
        } catch (err) {
            App.ui.aviso(err.message);
            return;
        }
        filtrar();
    }

    function filtrar() {
        const texto = ($("inputBuscarProveedor").value || "").trim().toLowerCase();

        const filtrados = texto
            ? proveedores.filter(
                  (p) =>
                      (p.nombre || "").toLowerCase().includes(texto) ||
                      (p.cedula || "").toLowerCase().includes(texto) ||
                      (p.departamento || "").toLowerCase().includes(texto) ||
                      (p.telefono || "").toLowerCase().includes(texto)
              )
            : proveedores;

        App.ui.pintarTabla(
            "tablaProveedores",
            "mensajeSinProveedores",
            filtrados,
            (p) => `
                <td><strong>${App.fmt.texto(p.nombre)}</strong></td>
                <td>${App.fmt.texto(p.telefono) || "N/A"}</td>
                <td>${App.fmt.texto(p.cedula) || "N/A"}</td>
                <td>${App.fmt.texto(p.direccion) || "N/A"}</td>
                <td>${App.fmt.texto(p.departamento) || "N/A"}</td>
                <td class="acciones-tabla">
                    <button class="btn-accion eliminar" data-eliminar="${p.id}">Eliminar</button>
                </td>`
        );
    }

    async function guardar(evento) {
        evento.preventDefault();

        const cuerpo = {
            nombre: $("nombreProveedor").value.trim(),
            telefono: $("telefonoProveedor").value.trim(),
            cedula: $("cedulaProveedor").value.trim(),
            direccion: $("direccionProveedor").value.trim(),
            departamento: $("departamentoProveedor").value.trim(),
        };

        if (!cuerpo.nombre) {
            App.ui.aviso("El nombre del proveedor es obligatorio.");
            return;
        }

        try {
            await App.api.crearProveedor(cuerpo);
            evento.target.reset();
            App.ui.cerrar("modalProveedor");
            await cargar();
            App.ui.aviso("Proveedor registrado.");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

/* Borrar desde la tabla. El modal por nombre se quitó: pedía escribir el
     * nombre exacto, lo que es más fácil de equivocar que el botón de la
     * fila, y hacía lo mismo que este. */
    async function eliminar(id) {
        const proveedor = proveedores.find((p) => p.id === id);
        if (!proveedor) return;

        if (!App.ui.confirmar(`¿Eliminar a "${proveedor.nombre}"?`)) return;

        try {
            await App.api.eliminarProveedor(id);
            await cargar();
            App.ui.aviso("Proveedor eliminado.");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        if (!App.auth.exigir()) return;
    App.layout.montar();

$("inputBuscarProveedor").addEventListener("input", filtrar);
        $("formProveedor").addEventListener("submit", guardar);

        $("btnAbrirModalProveedor").addEventListener("click", () =>
            App.ui.abrir("modalProveedor")
        );

        $("cerrarModalProveedor").addEventListener("click", () => App.ui.cerrar("modalProveedor"));
        $("btnCancelarProveedor").addEventListener("click", () => App.ui.cerrar("modalProveedor"));

        App.ui.cerrarAlTocarFondo("modalProveedor");

        $("tablaProveedores").addEventListener("click", (evento) => {
            const boton = evento.target.closest("[data-eliminar]");
            if (boton) eliminar(Number(boton.dataset.eliminar));
        });

        await cargar();
    });
})();
