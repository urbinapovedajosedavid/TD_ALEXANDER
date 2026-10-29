(function () {
    const STOCK_MAXIMO = 64;
    const FILAS_VISIBLES = 5;
    const MARGEN_PORCENTAJE = 0.05; // 5%

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
                        <button class="btn-accion" data-accion="recargar" data-id="${p.id}">Recargar</button>
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
        $("stockProdActual").value = producto.stock;
        $("stockProdPrecioActual").value = producto.precio;
        $("stockProdCantidad").value = "";
        $("stockProdPrecioEntrada").value = "";
        $("tituloModalStock").textContent = `Recargar stock: ${producto.nombre}`;

        App.ui.abrir("modalStock");
        $("stockProdCantidad").focus();
    }

    function redondearPrecio(valor) {
        // Igual que el resto del sistema: 2 decimales, half-up
        return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
    }

    async function guardarRecarga(evento) {
        evento.preventDefault();

        const id = $("stockProductoId").value;
        const cantidadAgregar = parseInt($("stockProdCantidad").value, 10);
        const precioEntrada = parseFloat($("stockProdPrecioEntrada").value);

        if (!Number.isInteger(cantidadAgregar) || cantidadAgregar <= 0) {
            App.ui.aviso("Ingresa una cantidad mayor a 0 para sumar al stock.");
            return;
        }

        if (!Number.isFinite(precioEntrada) || precioEntrada < 0) {
            App.ui.aviso("Ingresa un precio de entrada válido (0 o mayor).");
            return;
        }

        const productoActual = productos.find((p) => p.id === Number(id));
        if (!productoActual) return;

        const nuevoStock = productoActual.stock + cantidadAgregar;

        if (nuevoStock > STOCK_MAXIMO) {
            App.ui.aviso(
                `No se puede superar el máximo de ${STOCK_MAXIMO}. ` +
                    `Stock actual: ${productoActual.stock}. ` +
                    `Puedes agregar como máximo ${STOCK_MAXIMO - productoActual.stock}.`
            );
            return;
        }

        // Si el precio de entrada es más caro que el actual,
        // el nuevo precio de venta = precio de entrada + 5%
        let nuevoPrecio = productoActual.precio;
        let precioActualizado = false;

        if (precioEntrada > productoActual.precio) {
            nuevoPrecio = redondearPrecio(precioEntrada * (1 + MARGEN_PORCENTAJE));
            precioActualizado = true;
        }

        try {
            await App.api.actualizarProducto(id, {
                nombre: productoActual.nombre,
                codigo: productoActual.codigo,
                precio: nuevoPrecio,
                stock: nuevoStock,
                categoria_id: productoActual.categoria_id,
            });

            App.ui.cerrar("modalStock");
            await cargarStockCritico();

            let mensaje =
                `Stock actualizado: ${productoActual.stock} + ${cantidadAgregar} = ${nuevoStock}.`;
            if (precioActualizado) {
                mensaje +=
                    ` Precio actualizado: ${App.fmt.dinero(productoActual.precio)} → ${App.fmt.dinero(nuevoPrecio)} (entrada + 5%).`;
            } else {
                mensaje += ` Precio sin cambios (${App.fmt.dinero(productoActual.precio)}).`;
            }
            App.ui.aviso(mensaje);
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
