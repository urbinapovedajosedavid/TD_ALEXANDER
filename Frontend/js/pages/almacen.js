(function () {
    const FILAS_VISIBLES = 5;

    const $ = (id) => document.getElementById(id);

    let productos = [];
    let categorias = [];
    let proveedores = [];
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

    async function cargarProveedores() {
        try {
            proveedores = await App.api.proveedores();
        } catch (err) {
            proveedores = [];
        }

        const select = $("selectProveedor");
        if (select) {
            select.innerHTML =
                '<option value="">-- Sin proveedor asignado --</option>' +
                proveedores
                    .map(
                        (pr) =>
                            `<option value="${pr.id}">${App.fmt.texto(pr.nombre)}</option>`
                    )
                    .join("");
        }
    }

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
        const esAdmin = App.auth.esAdmin();

        let filtrados = productos.filter(
            (p) =>
                !texto ||
                p.nombre.toLowerCase().includes(texto) ||
                (p.codigo || "").toLowerCase().includes(texto) ||
                (p.categoria_nombre || "").toLowerCase().includes(texto) ||
                (p.proveedor_nombre || "").toLowerCase().includes(texto)
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

        const iconoCarpeta = (App.iconos && App.iconos.folder) || "";
        const iconoProveedor = (App.iconos && App.iconos.truckSmall) || "";

        App.ui.pintarTabla(
            "tablaProductos",
            "mensajeSinProductos",
            filtrados,
            (p) => {
                const estado =
                    p.stock > 0
                        ? '<span class="badge disponible">Disponible</span>'
                        : '<span class="badge agotado">Agotado</span>';

                const btnEliminar = esAdmin
                    ? `<button class="btn-accion eliminar" data-accion="eliminar" data-id="${p.id}">Eliminar</button>`
                    : "";

                const etiquetaProveedor = p.proveedor_nombre
                    ? ` <span class="separador-meta">·</span> <span class="meta-item">${iconoProveedor} ${App.fmt.texto(p.proveedor_nombre)}</span>`
                    : "";

                return `
                    <td>
                        <strong>${App.fmt.texto(p.nombre)}</strong><br>
                        <small class="sub-categoria">
                            <span class="meta-item">${iconoCarpeta} ${App.fmt.texto(p.categoria_nombre)}</span>${etiquetaProveedor}
                        </small>
                    </td>
                    <td>${App.fmt.texto(p.codigo) || "N/A"}</td>
                    <td>${App.fmt.dinero(p.precio)}</td>
                    <td>${App.fmt.entero(p.stock)}</td>
                    <td>${estado}</td>
                    <td class="acciones-tabla">
                        <button class="btn-accion" data-accion="editar" data-id="${p.id}">Modificar</button>
                        ${btnEliminar}
                    </td>`;
            }
        );

        ajustarAlturaTabla();
    }

    function ajustarAlturaTabla() {
        App.ui.ajustarAlturaTabla(
            "contenedorTablaProductos",
            "tablaProductos",
            FILAS_VISIBLES
        );
    }

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

    function abrirModalAgregar() {
        $("formProducto").reset();
        $("productoId").value = "";
        if ($("selectProveedor")) $("selectProveedor").value = "";
        $("tituloModal").textContent = "Añadir Nuevo Producto";
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
        if ($("selectProveedor")) {
            $("selectProveedor").value = producto.proveedor_id || "";
        }

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

        let categoriaId = $("selectCategoria").value;

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

        const proveedorId = $("selectProveedor") ? $("selectProveedor").value : "";

        const cuerpo = {
            nombre: $("prodNombre").value.trim(),
            codigo: $("prodCodigo").value.trim(),
            precio: parseFloat($("prodPrecio").value),
            stock: stock,
            categoria_id: categoriaId === "OTRO" ? null : categoriaId || null,
            proveedor_id: proveedorId || null,
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

    document.addEventListener("DOMContentLoaded", async () => {
        if (!App.layout.montar()) return;

        $("inputBuscarProducto").addEventListener("input", filtrarProductos);
        $("botonAgregarProducto").addEventListener("click", abrirModalAgregar);
        $("formProducto").addEventListener("submit", guardar);
        $("selectCategoria").addEventListener("change", manejarCambioCategoria);

        $("cerrarModalProducto").addEventListener("click", () => App.ui.cerrar("modalProducto"));
        $("btnCancelarProducto").addEventListener("click", () => App.ui.cerrar("modalProducto"));
        App.ui.cerrarAlTocarFondo("modalProducto");

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

        document.addEventListener("click", (evento) => {
            if (!evento.target.closest(".filtros-wrapper")) cerrarFiltros();
        });
        document.addEventListener("keydown", (evento) => {
            if (evento.key === "Escape") cerrarFiltros();
        });

        window.addEventListener("resize", ajustarAlturaTabla);

        $("tablaProductos").addEventListener("click", (evento) => {
            const boton = evento.target.closest("[data-accion]");
            if (!boton) return;
            const id = Number(boton.dataset.id);
            if (boton.dataset.accion === "editar") abrirModalEditar(id);
            if (boton.dataset.accion === "eliminar") eliminar(id);
        });

        await Promise.all([cargarCategorias(), cargarProveedores()]);
        await cargarProductos();
    });
})();
