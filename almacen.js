(function () {
    const STOCK_MAXIMO = 64;
    const FILAS_VISIBLES = 5;

    const $ = (id) => document.getElementById(id);

    let productos = [];
    let categorias = [];
    let filtroCategoria = "";
    let ordenPrecio = "";

    async function cargarCategorias() {
        try {
            categorias = await App.api.categorias();
        } catch (err) {
            App.ui.aviso(err.message);
            return;
        }

        const select = $("selectCategoria");
        if (select) {
            select.innerHTML =
                '<option value="">-- Seleccionar Categoría --</option>' +
                categorias
                    .map(
                        (c) =>
                            `<option value="${c.id}">${App.fmt.texto(c.nombre)}</option>`
                    )
                    .join("") +
                '<option value="OTRO">Otro (Añadir nueva...)</option>';
        }

        poblarFiltroCategorias();
    }

    /* Rellena el selector de categoría del panel de filtros. */
    function poblarFiltroCategorias() {
        const filtro = $("filtroCategoria");
        if (!filtro) return;

        filtro.innerHTML =
            '<option value="">Todas las categorías</option>' +
            categorias
                .map(
                    (c) =>
                        `<option value="${c.id}">${App.fmt.texto(c.nombre)}</option>`
                )
                .join("");

        const sigueExistiendo = categorias.some(
            (c) => String(c.id) === String(filtroCategoria)
        );
        filtro.value = sigueExistiendo ? filtroCategoria : "";
        filtroCategoria = filtro.value;
    }

    /* Muestra u oculta el campo para crear una categoría nueva. */
    function manejarCambioCategoria() {
        const select = $("selectCategoria");
        const contenedor = $("contenedorOtraCategoria");
        const input = $("inputOtraCategoria");
        if (!select || !contenedor || !input) return;

        const esNueva = select.value === "OTRO";
        contenedor.style.display = esNueva ? "flex" : "none";
        input.required = esNueva;
        input.value = "";
        if (esNueva) input.focus();
    }

    async function cargarProductos() {
        try {
            productos = await App.api.productos();
        } catch (err) {
            App.ui.aviso(err.message);
            return;
        }
        filtrarProductos();
    }

    function filtrarProductos() {
        const entrada = $("inputBuscarProducto");
        const texto = entrada ? entrada.value.trim().toLowerCase() : "";

        let filtrados = productos.filter(
            (p) =>
                !texto ||
                p.nombre.toLowerCase().includes(texto) ||
                (p.codigo || "").toLowerCase().includes(texto) ||
                (p.categoria_nombre || "").toLowerCase().includes(texto)
        );

        if (filtroCategoria) {
            filtrados = filtrados.filter(
                (p) => String(p.categoria_id) === String(filtroCategoria)
            );
        }

        if (ordenPrecio === "asc") {
            filtrados = filtrados.slice().sort((a, b) => a.precio - b.precio);
        } else if (ordenPrecio === "desc") {
            filtrados = filtrados.slice().sort((a, b) => b.precio - a.precio);
        }

        App.ui.pintarTabla(
            "tablaProductos",
            "mensajeSinProductos",
            filtrados,
            (p) => {
                const estado =
                    p.stock > 0
                        ? '<span class="badge disponible">Disponible</span>'
                        : '<span class="badge agotado">Agotado</span>';

                return `
                    <td>
                        <strong>${App.fmt.texto(p.nombre)}</strong><br>
                        <small class="sub-categoria">📁 ${App.fmt.texto(
                            p.categoria_nombre
                        )}</small>
                    </td>
                    <td>${App.fmt.texto(p.codigo) || "N/A"}</td>
                    <td>${App.fmt.dinero(p.precio)}</td>
                    <td>${App.fmt.entero(p.stock)} / ${STOCK_MAXIMO}</td>
                    <td>${estado}</td>
                    <td class="acciones-tabla">
                        <button class="btn-accion" data-accion="editar" data-id="${p.id}">Modificar</button>
                        <button class="btn-accion eliminar" data-accion="eliminar" data-id="${p.id}">Eliminar</button>
                    </td>`;
            }
        );

        ajustarAlturaTabla();
    }

    /* La tabla muestra máximo 5 filas visibles (helper compartido). */
    function ajustarAlturaTabla() {
        App.ui.ajustarAlturaTabla(
            "contenedorTablaProductos",
            "tablaProductos",
            FILAS_VISIBLES
        );
    }

    /* ---------- Panel de filtros ---------- */

    function alternarFiltros() {
        const panel = $("panelFiltros");
        const boton = $("btnAbrirFiltros");
        if (!panel || !boton) return;

        const abierto = !panel.classList.toggle("oculto");
        boton.setAttribute("aria-expanded", String(abierto));
    }

    function cerrarFiltros() {
        const panel = $("panelFiltros");
        const boton = $("btnAbrirFiltros");
        if (!panel || panel.classList.contains("oculto")) return;

        panel.classList.add("oculto");
        if (boton) boton.setAttribute("aria-expanded", "false");
    }

    function marcarOrdenActivo() {
        document.querySelectorAll(".chip-orden").forEach((chip) => {
            chip.classList.toggle("activo", chip.dataset.orden === ordenPrecio);
        });
    }

    /* ---------- Modal ---------- */

    function abrirModalAgregar() {
        $("formProducto").reset();
        $("productoId").value = "";
        $("tituloModal").textContent = "Añadir Nuevo Producto";
        $("prodStock").max = STOCK_MAXIMO;
        manejarCambioCategoria();
        App.ui.abrir("modalProducto");
    }

    function abrirModalEditar(id) {
        const producto = productos.find((p) => p.id === id);
        if (!producto) return;

        $("productoId").value = producto.id;
        $("prodNombre").value = producto.nombre;
        $("prodCodigo").value = producto.codigo || "";
        $("prodPrecio").value = producto.precio;
        $("prodStock").value = producto.stock;
        $("selectCategoria").value = producto.categoria_id || "";

        $("tituloModal").textContent = "Editar Producto";
        manejarCambioCategoria();
        App.ui.abrir("modalProducto");
    }

    async function guardar(evento) {
        evento.preventDefault();

        const stock = parseInt($("prodStock").value, 10);
        if (!Number.isInteger(stock) || stock < 0) {
            App.ui.aviso("El stock debe ser un número entero igual o mayor a 0.");
            return;
        }
        if (stock > STOCK_MAXIMO) {
            App.ui.aviso(`El stock máximo permitido es de ${STOCK_MAXIMO} unidades.`);
            return;
        }

        let categoriaId = $("selectCategoria").value;

        // "OTRO" crea la categoría antes de guardar el producto.
        if (categoriaId === "OTRO") {
            const nombre = $("inputOtraCategoria").value.trim();
            if (!nombre) {
                App.ui.aviso("Escriba el nombre de la nueva categoría.");
                return;
            }
            try {
                const nueva = await App.api.crearCategoria(nombre);
                categoriaId = nueva.id;
                await cargarCategorias();
            } catch (err) {
                App.ui.aviso(err.message);
                return;
            }
        }

        const cuerpo = {
            nombre: $("prodNombre").value.trim(),
            codigo: $("prodCodigo").value.trim(),
            precio: parseFloat($("prodPrecio").value),
            stock: stock,
            categoria_id: categoriaId === "OTRO" ? null : categoriaId || null,
        };

        const id = $("productoId").value;

        try {
            if (id) {
                await App.api.actualizarProducto(id, cuerpo);
            } else {
                await App.api.crearProducto(cuerpo);
            }
            App.ui.cerrar("modalProducto");
            await cargarProductos();
            App.ui.aviso(id ? "Producto actualizado." : "Producto agregado.");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    async function eliminar(id) {
        if (!App.ui.confirmar("¿Eliminar este producto del inventario?")) return;

        try {
            await App.api.eliminarProducto(id);
            await cargarProductos();
            App.ui.aviso("Producto eliminado.");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    /* ---------- Arranque ---------- */

    document.addEventListener("DOMContentLoaded", async () => {
        if (!App.auth.exigir()) return;
        App.layout.montar();

        $("inputBuscarProducto").addEventListener("input", filtrarProductos);
        $("botonAgregarProducto").addEventListener("click", abrirModalAgregar);
        $("formProducto").addEventListener("submit", guardar);
        $("selectCategoria").addEventListener("change", manejarCambioCategoria);

        $("cerrarModalProducto").addEventListener("click", () => App.ui.cerrar("modalProducto"));
        $("btnCancelarProducto").addEventListener("click", () => App.ui.cerrar("modalProducto"));
        App.ui.cerrarAlTocarFondo("modalProducto");

        // Panel de filtros: categoría, orden por precio y limpieza.
        $("btnAbrirFiltros").addEventListener("click", alternarFiltros);
        $("filtroCategoria").addEventListener("change", () => {
            filtroCategoria = $("filtroCategoria").value;
            filtrarProductos();
        });
        document.querySelectorAll(".chip-orden").forEach((chip) => {
            chip.addEventListener("click", () => {
                ordenPrecio =
                    ordenPrecio === chip.dataset.orden ? "" : chip.dataset.orden;
                marcarOrdenActivo();
                filtrarProductos();
            });
        });
        $("btnLimpiarFiltros").addEventListener("click", () => {
            filtroCategoria = "";
            ordenPrecio = "";
            $("filtroCategoria").value = "";
            marcarOrdenActivo();
            filtrarProductos();
        });

        // Cierra el dropdown al hacer clic fuera o presionar Escape.
        document.addEventListener("click", (evento) => {
            if (!evento.target.closest(".filtros-wrapper")) cerrarFiltros();
        });
        document.addEventListener("keydown", (evento) => {
            if (evento.key === "Escape") cerrarFiltros();
        });

        window.addEventListener("resize", ajustarAlturaTabla);

        // Delegación: las filas se regeneran en cada render.
        $("tablaProductos").addEventListener("click", (evento) => {
            const boton = evento.target.closest("[data-accion]");
            if (!boton) return;
            const id = Number(boton.dataset.id);
            if (boton.dataset.accion === "editar") abrirModalEditar(id);
            if (boton.dataset.accion === "eliminar") eliminar(id);
        });

        await cargarCategorias();
        await cargarProductos();
    });
})();
