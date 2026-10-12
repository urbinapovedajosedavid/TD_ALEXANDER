(function () {
    const STOCK_MAXIMO = 64;
    const FILAS_VISIBLES = 5;

    const $ = (id) => document.getElementById(id);

    let productos = [];
    let categorias = [];

    async function cargarCategorias() {
        try {
            categorias = await App.api.categorias();
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    async function cargarStockCritico() {
        try {
            productos = await App.api.productos();
        } catch (err) {
            App.ui.aviso(err.message);
            return;
        }

        // Filtrar exclusivamente productos con stock de 0 a 5 (agotados y bajos)
        const productosBajos = productos.filter((p) => p.stock <= 5);

        App.ui.pintarTabla(
            "tablaStock",
            "mensajeSinStock",
            productosBajos,
            (p) => {
                const estado =
                    p.stock > 0
                        ? `<span class="badge" style="color: #fd7e14; font-weight: bold;">Bajo (${p.stock})</span>`
                        : '<span class="badge agotado">Agotado (0)</span>';

                return `
                    <td>
                        <strong>${App.fmt.texto(p.nombre)}</strong><br>
                        <small class="sub-categoria">📁 ${App.fmt.texto(p.categoria_nombre)}</small>
                    </td>
                    <td>${App.fmt.texto(p.codigo) || "N/A"}</td>
                    <td>${App.fmt.dinero(p.precio)}</td>
                    <td>${App.fmt.entero(p.stock)} / ${STOCK_MAXIMO}</td>
                    <td>${estado}</td>
                    <td class="acciones-tabla">
                        <button class="btn-accion" data-accion="recargar" data-id="${p.id}">Recargar / Modificar</button>
                    </td>`;
            }
        );

        App.ui.ajustarAlturaTabla("contenedorTablaStock", "tablaStock", FILAS_VISIBLES);
    }

    function abrirModalRecarga(id) {
        const producto = productos.find((p) => p.id === id);
        if (!producto) return;

        $("stockProductoId").value = producto.id;
        $("stockProdNombre").value = producto.nombre;
        $("stockProdCantidad").value = producto.stock;
        $("tituloModalStock").textContent = `Recargar / Ajustar Stock: ${producto.nombre}`;
        
        App.ui.abrir("modalStock");
    }

    async function guardarRecarga(evento) {
        evento.preventDefault();

        const id = $("stockProductoId").value;
        const nuevoStock = parseInt($("stockProdCantidad").value, 10);

        if (!Number.isInteger(nuevoStock) || nuevoStock < 0) {
            App.ui.aviso("El stock debe ser un número entero igual o mayor a 0.");
            return;
        }
        if (nuevoStock > STOCK_MAXIMO) {
            App.ui.aviso(`El stock máximo permitido es de ${STOCK_MAXIMO} unidades.`);
            return;
        }

        const productoActual = productos.find((p) => p.id === Number(id));
        if (!productoActual) return;

        // Calculamos la diferencia o enviamos el nuevo stock según el backend
        const cantidadACambiar = nuevoStock - productoActual.stock;

        try {
            // Si el servidor usa un endpoint de recarga sumando o actualizando directamente
            await App.api.actualizarProducto(id, {
                nombre: productoActual.nombre,
                codigo: productoActual.codigo,
                precio: productoActual.precio,
                stock: nuevoStock,
                categoria_id: productoActual.categoria_id
            });

            App.ui.cerrar("modalStock");
            await cargarStockCritico();
            App.ui.aviso("Stock actualizado y sincronizado correctamente.");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        if (!App.auth.exigir()) return;
        App.layout.montar();

        const btnCerrar = $("cerrarModalStock");
        const btnCancelar = $("btnCancelarStock");
        const form = $("formStock");

        if (btnCerrar) btnCerrar.addEventListener("click", () => App.ui.cerrar("modalStock"));
        if (btnCancelar) btnCancelar.addEventListener("click", () => App.ui.cerrar("modalStock"));
        if (form) form.addEventListener("submit", guardarRecarga);
        
        App.ui.cerrarAlTocarFondo("modalStock");

        const tabla = $("tablaStock");
        if (tabla) {
            tabla.addEventListener("click", (evento) => {
                const boton = evento.target.closest("[data-accion]");
                if (!boton) return;
                const id = Number(boton.dataset.id);
                if (boton.dataset.accion === "recargar") abrirModalRecarga(id);
            });
        }

        await cargarCategorias();
        await cargarStockCritico();
    });
})();