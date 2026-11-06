(function () {
    const UMBRAL_STOCK_BAJO = 5;
    const FILAS_VISIBLES = 5;

    const $ = (id) => document.getElementById(id);

    let productos = [];
    let soloCriticos = true;

    async function cargarProductosStock() {
        try {
            productos = await App.api.productos();
        } catch (err) {
            App.ui.aviso(err.message);
            return;
        }
        renderizarTablaStock();
    }

    function renderizarTablaStock() {
        const inputBuscar = $("inputBuscarStock");
        const texto = inputBuscar ? inputBuscar.value.trim().toLowerCase() : "";

        let lista = productos;
        if (soloCriticos && !texto) {
            lista = lista.filter((p) => p.stock <= UMBRAL_STOCK_BAJO);
        }

        if (texto) {
            lista = lista.filter(
                (p) =>
                    p.nombre.toLowerCase().includes(texto) ||
                    (p.codigo || "").toLowerCase().includes(texto) ||
                    (p.categoria_nombre || "").toLowerCase().includes(texto)
            );
        }

        const iconoCarpeta = (App.iconos && App.iconos.folder) || "";

        App.ui.pintarTabla(
            "tablaStock",
            "mensajeSinStock",
            lista,
            (p) => {
                let estado = '<span class="badge disponible">Disponible</span>';
                if (p.stock === 0) {
                    estado = '<span class="badge agotado">Agotado (0)</span>';
                } else if (p.stock <= UMBRAL_STOCK_BAJO) {
                    estado = `<span class="badge bajo">Bajo (${p.stock})</span>`;
                }

                return `
                    <td>
                        <strong>${App.fmt.texto(p.nombre)}</strong><br>
                        <small class="sub-categoria"><span class="meta-item">${iconoCarpeta} ${App.fmt.texto(p.categoria_nombre)}</span></small>
                    </td>
                    <td>${App.fmt.texto(p.codigo) || "N/A"}</td>
                    <td>${App.fmt.dinero(p.precio)}</td>
                    <td>${App.fmt.dinero(p.costo_entrada || 0)}</td>
                    <td>${App.fmt.entero(p.stock)}</td>
                    <td>${estado}</td>
                    <td class="acciones-tabla">
                        <button class="btn-accion" data-accion="recargar" data-id="${p.id}">Recargar</button>
                    </td>`;
            }
        );

        App.ui.ajustarAlturaTabla("contenedorTablaStock", "tablaStock", FILAS_VISIBLES);
    }

    function cambiarModoFiltro(criticos) {
        soloCriticos = criticos;
        const btnCritico = $("btnFiltroCritico");
        const btnTodos = $("btnFiltroTodosStock");
        if (btnCritico) {
            btnCritico.classList.toggle("btn-pill-menta", criticos);
            btnCritico.classList.toggle("btn-pill-oscuro", !criticos);
        }
        if (btnTodos) {
            btnTodos.classList.toggle("btn-pill-menta", !criticos);
            btnTodos.classList.toggle("btn-pill-oscuro", criticos);
        }
        renderizarTablaStock();
    }

    function abrirModalRecarga(id) {
        const producto = productos.find((p) => p.id === id);
        if (!producto) return;

        $("stockProductoId").value = producto.id;
        $("stockProdNombre").value = producto.nombre;
        $("stockProdActual").value = producto.stock;
        $("stockProdPrecioActual").value = producto.precio;
        $("stockProdCantidad").value = "";
        $("stockProdPrecioEntrada").value = producto.costo_entrada > 0 ? producto.costo_entrada : "";
        $("tituloModalStock").textContent = `Recargar stock: ${producto.nombre}`;

        App.ui.abrir("modalStock");
        $("stockProdCantidad").focus();
    }

    async function guardarRecarga(evento) {
        evento.preventDefault();

        const id = Number($("stockProductoId").value);
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

        try {
            const r = await App.api.recargarStock(id, cantidadAgregar, precioEntrada);
            App.ui.cerrar("modalStock");
            await cargarProductosStock();
            App.ui.aviso(r.mensaje || "Stock recargado correctamente.");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        if (!App.layout.montar()) return;

        const btnCerrar = $("cerrarModalStock");
        const btnCancelar = $("btnCancelarStock");
        const form = $("formStock");
        const inputBuscar = $("inputBuscarStock");
        const btnCritico = $("btnFiltroCritico");
        const btnTodos = $("btnFiltroTodosStock");

        if (btnCerrar) btnCerrar.addEventListener("click", () => App.ui.cerrar("modalStock"));
        if (btnCancelar) btnCancelar.addEventListener("click", () => App.ui.cerrar("modalStock"));
        if (form) form.addEventListener("submit", guardarRecarga);
        if (inputBuscar) inputBuscar.addEventListener("input", renderizarTablaStock);
        if (btnCritico) btnCritico.addEventListener("click", () => cambiarModoFiltro(true));
        if (btnTodos) btnTodos.addEventListener("click", () => cambiarModoFiltro(false));

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

        await cargarProductosStock();
    });
})();
