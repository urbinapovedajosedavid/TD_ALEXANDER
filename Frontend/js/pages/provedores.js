/* Módulo de gestión de proveedores - Tienda Alexander. */

(function () {
    const $ = (id) => document.getElementById(id);

    const FILAS_VISIBLES = 5;

    let proveedores = [];

    function ajustarAlturaTabla() {
        App.ui.ajustarAlturaTabla(
            "contenedorTablaProveedores",
            "tablaProveedores",
            FILAS_VISIBLES
        );
    }

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
        const esAdmin = App.auth.esAdmin();

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
            (p) => {
                const btnEliminar = esAdmin
                    ? `<button class="btn-accion eliminar" data-eliminar="${p.id}">Eliminar</button>`
                    : "";
                return `
                    <td><strong>${App.fmt.texto(p.nombre)}</strong></td>
                    <td>${App.fmt.texto(p.telefono) || "N/A"}</td>
                    <td>${App.fmt.texto(p.cedula) || "N/A"}</td>
                    <td>${App.fmt.texto(p.direccion) || "N/A"}</td>
                    <td>${App.fmt.texto(p.departamento) || "N/A"}</td>
                    <td class="acciones-tabla">
                        <button class="btn-accion" data-editar="${p.id}">Modificar</button>
                        ${btnEliminar}
                    </td>`;
            }
        );

        ajustarAlturaTabla();
    }

    function abrirModalNuevo() {
        $("formProveedor").reset();
        if ($("proveedorId")) $("proveedorId").value = "";
        if ($("tituloModalProveedor")) {
            $("tituloModalProveedor").textContent = "Añadir Nuevo Proveedor";
        }
        App.ui.abrir("modalProveedor");
    }

    function abrirModalEditar(id) {
        const proveedor = proveedores.find((p) => p.id === id);
        if (!proveedor) return;

        if ($("proveedorId")) $("proveedorId").value = proveedor.id;
        $("nombreProveedor").value = proveedor.nombre || "";
        $("telefonoProveedor").value = proveedor.telefono || "";
        $("cedulaProveedor").value = proveedor.cedula || "";
        $("direccionProveedor").value = proveedor.direccion || "";
        $("departamentoProveedor").value = proveedor.departamento || "";
        if ($("tituloModalProveedor")) {
            $("tituloModalProveedor").textContent = "Editar Proveedor";
        }
        App.ui.abrir("modalProveedor");
    }

    async function guardar(evento) {
        evento.preventDefault();

        const id = $("proveedorId") ? $("proveedorId").value : "";
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
            if (id) {
                await App.api.actualizarProveedor(Number(id), cuerpo);
            } else {
                await App.api.crearProveedor(cuerpo);
            }
            evento.target.reset();
            App.ui.cerrar("modalProveedor");
            await cargar();
            App.ui.aviso(id ? "Proveedor actualizado." : "Proveedor registrado.");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

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
        if (!App.layout.montar()) return;

        $("inputBuscarProveedor").addEventListener("input", filtrar);
        $("formProveedor").addEventListener("submit", guardar);

        $("btnAbrirModalProveedor").addEventListener("click", abrirModalNuevo);

        $("cerrarModalProveedor").addEventListener("click", () => App.ui.cerrar("modalProveedor"));
        $("btnCancelarProveedor").addEventListener("click", () => App.ui.cerrar("modalProveedor"));

        App.ui.cerrarAlTocarFondo("modalProveedor");

        $("tablaProveedores").addEventListener("click", (evento) => {
            const btnEditar = evento.target.closest("[data-editar]");
            if (btnEditar) {
                abrirModalEditar(Number(btnEditar.dataset.editar));
                return;
            }
            const btnEliminar = evento.target.closest("[data-eliminar]");
            if (btnEliminar) {
                eliminar(Number(btnEliminar.dataset.eliminar));
            }
        });

        window.addEventListener("resize", ajustarAlturaTabla);

        await cargar();
    });
})();
