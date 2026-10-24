/* Reportes de ventas.
 *
 * Backend/reportes.js estaba vacío. Los KPIs y el listado salen de
 * GET /api/reportes, que calcula los totales en SQL. Además de los
 * accesos rápidos (hoy / 7 días / 30 días) la vista permite elegir un
 * rango de fechas exacto con fecha_inicio y fecha_fin.
 *
 * Además existen dos reportes nuevos (solo para administradores):
 *   - "Reporte de Ventas por Usuario": historial de un vendedor agrupado
 *     por fechas, con el detalle de las facturas del día y el resumen del
 *     inventario vendido.
 *   - "Inventario Total": resumen del inventario de la tienda.
 */

(function () {
    const $ = (id) => document.getElementById(id);

    const PERIODOS = {
        hoy: "Reporte de Ventas del Día Actual",
        semana: "Reporte de Ventas de los Últimos 7 Días",
        mes: "Reporte de Ventas de los Últimos 30 Días",
    };

    const BOTONES_PERIODO = [
        "btnReporteHoy",
        "btnReporteSemanal",
        "btnReporteMensual",
    ];

    let periodoActual = "hoy";
    let ultimoReporte = null;

    const FILAS_VISIBLES = 5;

    /* La tabla de ventas muestra máximo 5 filas visibles (helper compartido). */
    function ajustarAlturaTabla() {
        App.ui.ajustarAlturaTabla(
            "contenedorTablaReporte",
            "tablaVentasReporte",
            FILAS_VISIBLES
        );
    }

    /* ---------- Utilidades de fecha (AAAA-MM-DD, hora local) ---------- */

    function aISO(fecha) {
        const p = (n) => String(n).padStart(2, "0");
        return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
    }

    function diasAtras(dias) {
        return new Date(Date.now() - dias * 86400000);
    }

    function fechaLegible(iso) {
        const [a, m, d] = iso.split("-");
        return `${d}/${m}/${a}`;
    }

    /* Rango que representa cada acceso rápido, para precargar los campos. */
    function rangoDePeriodo(periodo) {
        const hoy = new Date();
        if (periodo === "semana") return { inicio: aISO(diasAtras(6)), fin: aISO(hoy) };
        if (periodo === "mes") return { inicio: aISO(diasAtras(29)), fin: aISO(hoy) };
        return { inicio: aISO(hoy), fin: aISO(hoy) };
    }

    function fijarFechas(inicio, fin) {
        $("inputFechaInicio").value = inicio;
        $("inputFechaFin").value = fin;
    }

    function marcarBotonActivo(idActivo) {
        BOTONES_PERIODO.forEach((id) => {
            const boton = $(id);
            if (!boton) return;
            boton.classList.toggle("btn-pill-menta", id === idActivo);
            boton.classList.toggle("btn-pill-oscuro", id !== idActivo);
        });
    }

    /* ---------- Nuevos reportes: ventas por usuario e inventario total ---------- */

    let usuariosReporte = [];
    let productosReporte = [];
    let ventasPorUsuario = [];
    let usuarioReporteActivo = null;
    let diaDetalle = null;
    let modoDetalle = "facturas";

    const MESES = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];

    /* "2026-05-18" -> "18 de mayo de 2026" */
    function diaTexto(iso) {
        const partes = String(iso || "").split("-");
        const anio = Number(partes[0]);
        const mes = MESES[Number(partes[1]) - 1] || "";
        const dia = Number(partes[2]);
        if (!anio) return String(iso || "");
        return `${String(dia).padStart(2, "0")} de ${mes} de ${anio}`;
    }

    async function cargarCategoriasReporte() {
        try {
            const categorias = await App.api.categorias();
            const select = $("filtroCategoriaReporte");
            if (!select) return;
            select.innerHTML =
                '<option value="">Todas las categorías</option>' +
                categorias
                    .map((c) => `<option value="${c.id}">${App.fmt.texto(c.nombre)}</option>`)
                    .join("");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    async function cargarProductosReporte() {
        try {
            productosReporte = await App.api.productos();
        } catch (err) {
            App.ui.aviso(err.message);
            productosReporte = [];
        }
    }

    async function cargarUsuariosReporte() {
        try {
            usuariosReporte = await App.api.usuarios();
        } catch (err) {
            App.ui.aviso(err.message);
            usuariosReporte = [];
        }

        const select = $("selectUsuarioReporte");
        if (!select) return;

        select.innerHTML =
            '<option value="">Seleccionar usuario</option>' +
            usuariosReporte
                .map(
                    (u) =>
                        `<option value="${u.id}">${App.fmt.texto(u.nombre)} (${App.fmt.texto(u.rol)})</option>`
                )
                .join("");

        if (!usuariosReporte.length) {
            select.value = "";
            return;
        }
        const valorActual = select.value;
        select.value = usuariosReporte.some((u) => String(u.id) === valorActual)
            ? valorActual
            : String(usuariosReporte[0].id);
        cargarReporteUsuario(Number(select.value));
    }

    async function cargarReporteUsuario(idUsuario) {
        if (!idUsuario) return;
        try {
            const reporte = await App.api.reportesPorUsuario(idUsuario);
            ventasPorUsuario = reporte.ventas || [];
            usuarioReporteActivo = reporte.usuario || { id: idUsuario, nombre: "", rol: "" };
            diaDetalle = null;

            renderizarHistorialUsuario(ventasPorUsuario, usuarioReporteActivo);
            const detalle = $("detalleReporteUsuario");
            if (detalle) detalle.classList.add("oculto");
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    /* Agrupa las ventas del usuario por día (fecha "AAAA-MM-DD ..."). */
    function agruparVentasPorDia(ventas) {
        const dias = {};
        (ventas || []).forEach((v) => {
            const dia = String(v.fecha || "").slice(0, 10);
            if (!dia) return;
            if (!dias[dia]) dias[dia] = [];
            dias[dia].push(v);
        });
        return Object.keys(dias).sort((a, b) => b.localeCompare(a));
    }

    /* Filtra las ventas por categoría de los artículos vendidos. */
    function filtrarVentasPorCategoria(ventas) {
        const select = $("filtroCategoriaReporte");
        const idCategoria = select ? String(select.value || "") : "";
        if (!idCategoria) return ventas;

        const mapa = {};
        productosReporte.forEach((p) => {
            mapa[String(p.id)] = p;
        });

        return (ventas || []).filter((v) => {
            const items = v.items || [];
            return items.some((i) => {
                const producto = mapa[String(i.id)];
                const categoriaId = producto ? String(producto.categoria_id || "") : "";
                return categoriaId === idCategoria;
            });
        });
    }

    /* Lista los días con ventas del usuario seleccionado. */
    function renderizarHistorialUsuario(ventas, usuario) {
        const contenedor = $("contenedorHistorialUsuario");
        if (!contenedor) return;
        contenedor.innerHTML = "";

        const lista = ventas || [];
        if (!usuario) {
            contenedor.innerHTML =
                '<div class="estado-vacio">Selecciona un usuario para ver su historial de ventas.</div>';
            return;
        }

        const dias = agruparVentasPorDia(lista);
        if (!dias.length) {
            contenedor.innerHTML = `<div class="estado-vacio">El usuario ${App.fmt.texto(
                usuario.nombre
            )} no tiene ventas registradas.</div>`;
            return;
        }

        dias.forEach((dia) => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "btn-pill btn-pill-oscuro";
            if (dia === diaDetalle) boton.classList.add("btn-pill-menta");
            boton.dataset.dia = dia;
            boton.textContent = diaTexto(dia);
            boton.addEventListener("click", () => {
                diaDetalle = dia;
                modoDetalle = "facturas";
                mostrarVistaDetalle("facturas");
            });
            contenedor.appendChild(boton);
        });
    }

    /* Tabla de "Facturas del día": fecha exacta y hora de cada factura. */
    function renderizarFacturasDelDia(ventas) {
        App.ui.pintarTabla(
            "tablaDetalleUsuario",
            "mensajeSinDetalleUsuario",
            ventas,
            (v) => `
                <td>${App.fmt.fechaHora(v.fecha)}</td>
                <td>#${v.id}</td>
                <td>${App.fmt.texto(v.metodo_pago)}</td>
                <td><strong>${App.fmt.dinero(v.total)}</strong></td>
                <td class="acciones-tabla">
                    <button class="btn-accion" data-factura="${v.id}">Factura</button>
                </td>`
        );
    }

    /* Resumen del "Inventario total vendido" del día seleccionado. */
    function renderizarInventarioDelDia(ventas) {
        const delDia = ventas || [];
        const total = delDia.reduce((s, v) => s + (Number(v.total) || 0), 0);
        const unidades = delDia.reduce(
            (s, v) => s + (v.items || []).reduce((x, i) => x + (Number(i.cantidad) || 0), 0),
            0
        );

        const kpiTotal = $("kpiInventarioTotal");
        const kpiUnidades = $("kpiInventarioUnidades");
        if (kpiTotal) kpiTotal.textContent = App.fmt.dinero(total);
        if (kpiUnidades) kpiUnidades.textContent = App.fmt.entero(unidades);
    }

    /* Ventas del usuario del día seleccionado, ya con categoría aplicada. */
    function ventasDelDiaSeleccionadas() {
        return filtrarVentasPorCategoria(ventasPorUsuario || "").filter(
            (v) => String(v.fecha || "").slice(0, 10) === diaDetalle
        );
    }

    function renderizarDetalleUsuario() {
        const contenedor = $("detalleReporteUsuario");
        if (!usuarioReporteActivo || !diaDetalle) {
            if (contenedor) contenedor.classList.add("oculto");
            return;
        }
        if (!contenedor) return;
        contenedor.classList.remove("oculto");

        const ventas = ventasDelDiaSeleccionadas();
        renderizarFacturasDelDia(ventas);
        renderizarInventarioDelDia(ventas);
    }

    /* Alterna entre "Facturas del día" y "Inventario total vendido". */
    function mostrarVistaDetalle(vista) {
        modoDetalle = vista;

        const contenedorFacturas = $("contenedorDetalleFacturas");
        const contenedorInventario = $("contenedorDetalleInventario");
        const btnFactura = $("btnVistaFactura");
        const btnInventario = $("btnVistaInventario");

        if (contenedorFacturas) contenedorFacturas.classList.toggle("oculto", vista !== "facturas");
        if (contenedorInventario) contenedorInventario.classList.toggle("oculto", vista !== "inventario");
        if (btnFactura) btnFactura.classList.toggle("btn-pill-menta", vista === "facturas");
        if (btnInventario) btnInventario.classList.toggle("btn-pill-oscuro", vista !== "facturas");

        if (vista === "facturas") renderizarFacturasDelDia(ventasDelDiaSeleccionadas());
        else renderizarInventarioDelDia(ventasDelDiaSeleccionadas());
    }

    /* Inventario total de toda la tienda (reporte de segunda opción). */
    async function cargarInventarioTotal() {
        try {
            const inventario = await App.api.resumenInventario();
            const kpiValor = $("kpiInvValor");
            const kpiProductos = $("kpiInvProductos");
            const kpiAgotados = $("kpiInvAgotados");
            if (kpiValor) kpiValor.textContent = App.fmt.dinero(inventario.valor_inventario);
            if (kpiProductos) kpiProductos.textContent = App.fmt.entero(inventario.total_productos);
            if (kpiAgotados) kpiAgotados.textContent = App.fmt.entero(inventario.productos_agotados);

            const productos = await App.api.productos();
            App.ui.pintarTabla(
                "tablaInventario",
                "mensajeSinInventario",
                productos,
                (p) => `
                    <td><strong>${App.fmt.texto(p.nombre)}</strong></td>
                    <td>${App.fmt.texto(p.categoria_nombre)}</td>
                    <td>${App.fmt.dinero(p.precio)}</td>
                    <td>${App.fmt.entero(p.stock)}</td>`
            );
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    /* Muestra u oculta los bloques según el tipo de reporte elegido. */
    function mostrarVistaReporte(tipo) {
        const mostrarLegacy = tipo === "";

        const tarjeta = document.querySelector(".tarjeta");
        if (tarjeta) {
            const bloques = [
                tarjeta.querySelector(".filtro-fechas"),
                tarjeta.querySelector(".kpi-grid"),
                ...Array.from(tarjeta.querySelectorAll(".acciones-inventario-pills")),
                document.getElementById("contenedorTablaReporte"),
            ].filter(Boolean);

            bloques.forEach((bloque) => bloque.classList.toggle("oculto", !mostrarLegacy));

            const exportar = document.getElementById("btnExportarExcel");
            const exportarBloque = exportar ? exportar.closest(".acciones-inventario-pills") : null;
            if (exportarBloque) exportarBloque.classList.toggle("oculto", !mostrarLegacy);
        }

        const panelUsuario = document.getElementById("panelReporteVentasUsuario");
        const panelInventario = document.getElementById("panelReporteInventario");
        if (panelUsuario) panelUsuario.classList.toggle("oculto", tipo !== "ventas_usuario");
        if (panelInventario) panelInventario.classList.toggle("oculto", tipo !== "inventario");
    }

    /* Cambia entre los dos reportes de la sección (dropdown). */
    async function manejarCambioTipoReporte(tipo) {
        mostrarVistaReporte(tipo);

        if (tipo === "ventas_usuario") {
            await Promise.all([cargarCategoriasReporte(), cargarUsuariosReporte(), cargarProductosReporte()]);
        } else if (tipo === "inventario") {
            await cargarInventarioTotal();
        }
    }

    /* ---------- Pintado del resumen y la tabla ---------- */

    function pintarReporte(reporte) {
        ultimoReporte = reporte;

        const k = reporte.kpis;
        $("kpiVentasHoy").textContent = App.fmt.dinero(k.total_vendido);
        $("kpiCantidadVentasHoy").textContent = App.fmt.entero(k.cantidad_ventas);
        $("kpiProductosVendidosHoy").textContent = App.fmt.entero(k.productos_vendidos);
        $("kpiTicketPromedio").textContent = App.fmt.dinero(k.ticket_promedio || 0);

        App.ui.pintarTabla(
            "tablaVentasReporte",
            "mensajeSinReportes",
            reporte.ventas,
            (v) => `
                <td>${App.fmt.fechaHora(v.fecha)}</td>
                <td>#${v.id}</td>
                <td>${App.fmt.texto(v.metodo_pago)}</td>
                <td><strong>${App.fmt.dinero(v.total)}</strong></td>
                <td class="acciones-tabla">
                    <button class="btn-accion" data-factura="${v.id}">Factura</button>
                </td>`
        );

        ajustarAlturaTabla();
    }

    /* ---------- Carga por período predefinido ---------- */

    async function cargar(periodo) {
        periodoActual = periodo;

        const rango = rangoDePeriodo(periodo);
        fijarFechas(rango.inicio, rango.fin);
        marcarBotonActivo(
            periodo === "semana" ? "btnReporteSemanal"
            : periodo === "mes" ? "btnReporteMensual"
            : "btnReporteHoy"
        );

        let reporte;
        try {
            reporte = await App.api.reportes(periodo);
        } catch (err) {
            App.ui.aviso(err.message);
            return;
        }

        $("tituloVistaReporte").textContent = PERIODOS[periodo];
        pintarReporte(reporte);
    }

    /* ---------- Carga por rango de fechas elegido ---------- */

    async function cargarPorFechas() {
        const inicio = $("inputFechaInicio").value;
        const fin = $("inputFechaFin").value;

        if (!inicio || !fin) {
            App.ui.aviso("Selecciona la fecha de inicio y la de fin.");
            return;
        }
        if (inicio > fin) {
            App.ui.aviso("La fecha de inicio no puede ser posterior a la de fin.");
            return;
        }

        let reporte;
        try {
            reporte = await App.api.reportesPorFechas(inicio, fin);
        } catch (err) {
            App.ui.aviso(err.message);
            return;
        }

        periodoActual = `${inicio}_a_${fin}`;
        marcarBotonActivo(null);
        $("tituloVistaReporte").textContent =
            `Reporte de Ventas del ${fechaLegible(inicio)} al ${fechaLegible(fin)}`;
        pintarReporte(reporte);
    }

    /* Exportación a CSV: funciona sin dependencias externas y Excel lo
     * abre directamente. El nombre del archivo lleva el período. */
    function exportar(ventas, nombre) {
        if (ventas.length === 0) {
            App.ui.aviso("No hay ventas en este período para exportar.");
            return;
        }

        const cabecera = "ID,Fecha,Metodo de pago,Vendedor,Total";
        const filas = ventas.map(
            (v) =>
                `${v.id},"${v.fecha}",${v.metodo_pago},"${v.vendedor}",${v.total}`
        );

        // BOM para que Excel reconozca UTF-8 y muestre bien los acentos.
        const contenido = "﻿" + [cabecera, ...filas].join("\n");
        App.ui.descargar(
            new Blob([contenido], { type: "text/csv;charset=utf-8;" }),
            nombre
        );

        App.ui.aviso(`Se exportaron ${ventas.length} ventas.`);
    }

    /* Reimprime una venta. El botón decía "Exportar" y lo que hacía era bajar
     * un CSV de una sola fila, sin productos ni subtotal: menos información
     * que la fila desde la que se hizo clic. Ahora trae la factura. */
    async function verFactura(id) {
        try {
            const venta = await App.api.venta(id);
            App.factura.imprimir(venta);
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (!App.auth.exigir()) return;
        App.layout.montar();

        /* ---------- Nuevos reportes: ventas por usuario e inventario total ---------- */

        const contenedorTipoReporte = document.getElementById("contenedorTipoReporte");
        const panelReporteVentasUsuario = document.getElementById("panelReporteVentasUsuario");
        const panelReporteInventario = document.getElementById("panelReporteInventario");

        function mostrarVistaReporte(tipo) {
            const mostrarLegacy = tipo === "";

            const tarjeta = document.querySelector(".tarjeta");
            if (tarjeta) {
                const bloques = [
                    tarjeta.querySelector(".filtro-fechas"),
                    tarjeta.querySelector(".kpi-grid"),
                    ...Array.from(tarjeta.querySelectorAll(".acciones-inventario-pills")),
                    document.getElementById("contenedorTablaReporte"),
                ].filter(Boolean);

                bloques.forEach((bloque) => bloque.classList.toggle("oculto", !mostrarLegacy));

                const exportar = document.getElementById("btnExportarExcel");
                const exportarBloque = exportar ? exportar.closest(".acciones-inventario-pills") : null;
                if (exportarBloque) exportarBloque.classList.toggle("oculto", !mostrarLegacy);
            }

            if (panelReporteVentasUsuario) panelReporteVentasUsuario.classList.toggle("oculto", tipo !== "ventas_usuario");
            if (panelReporteInventario) panelReporteInventario.classList.toggle("oculto", tipo !== "inventario");
        }

        function mostrarVistaDetalle(vista) {
            modoDetalle = vista;

            const contenedorFacturas = document.getElementById("contenedorDetalleFacturas");
            const contenedorInventario = document.getElementById("contenedorDetalleInventario");
            const btnFactura = document.getElementById("btnVistaFactura");
            const btnInventario = document.getElementById("btnVistaInventario");

            if (contenedorFacturas) contenedorFacturas.classList.toggle("oculto", vista !== "facturas");
            if (contenedorInventario) contenedorInventario.classList.toggle("oculto", vista !== "inventario");
            if (btnFactura) btnFactura.classList.toggle("btn-pill-menta", vista === "facturas");
            if (btnInventario) btnInventario.classList.toggle("btn-pill-oscuro", vista !== "facturas");

            if (vista === "facturas") renderizarFacturasDelDia(ventasDelDiaSeleccionadas());
            else renderizarInventarioDelDia(ventasDelDiaSeleccionadas());
        }

        async function manejarCambioTipoReporte(tipo) {
            mostrarVistaReporte(tipo);

            if (tipo === "ventas_usuario") {
                await Promise.all([cargarCategoriasReporte(), cargarUsuariosReporte()]);
            } else if (tipo === "inventario") {
                await cargarInventarioTotal();
            }
        }

        /* ---------- Acceso: estos reportes son solo del perfil ADMIN ---------- */

        const tipoSelect = document.getElementById("selectTipoReporte");
        if (tipoSelect) {
            tipoSelect.addEventListener("change", (evento) => {
                manejarCambioTipoReporte(evento.target.value);
            });
        }

        if (App.auth.esAdmin()) {
            manejarCambioTipoReporte(tipoSelect ? tipoSelect.value || "" : "");
        } else {
            if (contenedorTipoReporte) contenedorTipoReporte.classList.add("oculto");
            if (panelReporteVentasUsuario) panelReporteVentasUsuario.classList.add("oculto");
            if (panelReporteInventario) panelReporteInventario.classList.add("oculto");
        }

        /* ---------- Acceso: botones y tabla del reporte de ventas ---------- */

        $("btnReporteHoy").addEventListener("click", () => cargar("hoy"));
        $("btnReporteSemanal").addEventListener("click", () => cargar("semana"));
        $("btnReporteMensual").addEventListener("click", () => cargar("mes"));

        $("btnFiltrarFechas").addEventListener("click", cargarPorFechas);
        $("btnLimpiarFiltro").addEventListener("click", () => cargar("hoy"));

        $("btnExportarExcel").addEventListener("click", () => {
            if (!ultimoReporte) return;
            exportar(ultimoReporte.ventas, `ventas_${periodoActual}.csv`);
        });

        $("tablaVentasReporte").addEventListener("click", (evento) => {
            const boton = evento.target.closest("[data-factura]");
            if (!boton) return;
            verFactura(Number(boton.dataset.factura));
        });

        $("tablaDetalleUsuario").addEventListener("click", (evento) => {
            const boton = evento.target.closest("[data-factura]");
            if (!boton) return;
            verFactura(Number(boton.dataset.factura));
        });

        window.addEventListener("resize", ajustarAlturaTabla);

        cargar("hoy");
    });
})();
