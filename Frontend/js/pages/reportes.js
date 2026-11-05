/* Módulo de analítica, reportes de ventas, historial por vendedor e inventario. */

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

    const MESES = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];

    const FILAS_VISIBLES = 5;

    let periodoActual = "hoy";
    let ultimoReporte = null;

    let usuariosReporte = [];
    let ventasPorUsuario = [];
    let diasPorUsuario = [];
    let usuarioReporteActivo = null;
    let diaDetalle = null;
    let modoDetalle = "facturas";

    function ajustarAlturaTabla() {
        App.ui.ajustarAlturaTabla(
            "contenedorTablaReporte",
            "tablaVentasReporte",
            FILAS_VISIBLES
        );
    }

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
        await cargarReporteUsuario(Number(select.value));
    }

    async function cargarReporteUsuario(idUsuario) {
        if (!idUsuario) {
            ventasPorUsuario = [];
            diasPorUsuario = [];
            usuarioReporteActivo = null;
            diaDetalle = null;
            renderizarHistorialUsuario([], null);
            const detalle = $("detalleReporteUsuario");
            if (detalle) detalle.classList.add("oculto");
            return;
        }

        const selectCategoria = $("filtroCategoriaReporte");
        const categoriaId = selectCategoria ? selectCategoria.value : "";

        try {
            const reporte = await App.api.reportesPorUsuario(idUsuario, categoriaId);
            ventasPorUsuario = reporte.ventas || [];
            diasPorUsuario = reporte.dias || [];
            usuarioReporteActivo = reporte.usuario || { id: idUsuario, nombre: "", rol: "" };
            if (diaDetalle && !diasPorUsuario.includes(diaDetalle)) {
                diaDetalle = null;
            }

            renderizarHistorialUsuario(diasPorUsuario, usuarioReporteActivo);
            renderizarDetalleUsuario();
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    function renderizarHistorialUsuario(dias, usuario) {
        const contenedor = $("contenedorHistorialUsuario");
        if (!contenedor) return;
        contenedor.innerHTML = "";

        if (!usuario) {
            contenedor.innerHTML =
                '<div class="estado-vacio">Selecciona un usuario para ver su historial de ventas.</div>';
            return;
        }

        if (!dias.length) {
            contenedor.innerHTML = `<div class="estado-vacio">El usuario ${App.fmt.texto(
                usuario.nombre
            )} no tiene ventas registradas con este filtro.</div>`;
            return;
        }

        dias.forEach((dia) => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "btn-pill " + (dia === diaDetalle ? "btn-pill-menta" : "btn-pill-oscuro");
            boton.dataset.dia = dia;
            boton.textContent = diaTexto(dia);
            boton.addEventListener("click", () => {
                diaDetalle = dia;
                contenedor.querySelectorAll("button[data-dia]").forEach((b) => {
                    const activo = b.dataset.dia === diaDetalle;
                    b.classList.toggle("btn-pill-menta", activo);
                    b.classList.toggle("btn-pill-oscuro", !activo);
                });
                renderizarDetalleUsuario();
                mostrarVistaDetalle(modoDetalle || "facturas");
            });
            contenedor.appendChild(boton);
        });
    }

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

    function ventasDelDiaSeleccionadas() {
        return ventasPorUsuario.filter(
            (v) => (v.dia || String(v.fecha || "").slice(0, 10)) === diaDetalle
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

    function mostrarVistaDetalle(vista) {
        modoDetalle = vista;

        const contenedorFacturas = $("contenedorDetalleFacturas");
        const contenedorInventario = $("contenedorDetalleInventario");
        const btnFactura = $("btnVistaFactura");
        const btnInventario = $("btnVistaInventario");

        if (contenedorFacturas) contenedorFacturas.classList.toggle("oculto", vista !== "facturas");
        if (contenedorInventario) contenedorInventario.classList.toggle("oculto", vista !== "inventario");

        if (btnFactura) {
            btnFactura.classList.toggle("btn-pill-menta", vista === "facturas");
            btnFactura.classList.toggle("btn-pill-oscuro", vista !== "facturas");
        }
        if (btnInventario) {
            btnInventario.classList.toggle("btn-pill-menta", vista === "inventario");
            btnInventario.classList.toggle("btn-pill-oscuro", vista !== "inventario");
        }

        if (vista === "facturas") renderizarFacturasDelDia(ventasDelDiaSeleccionadas());
        else renderizarInventarioDelDia(ventasDelDiaSeleccionadas());
    }

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

    function mostrarVistaReporte(tipo) {
        const mostrarGeneral = tipo === "";

        const tarjeta = document.querySelector(".tarjeta");
        if (tarjeta) {
            const bloques = [
                tarjeta.querySelector(".filtro-fechas"),
                tarjeta.querySelector("#kpiVentasHoy")?.closest(".kpi-grid"),
                $("btnReporteHoy")?.closest(".acciones-inventario-pills"),
                $("contenedorTablaReporte"),
                $("btnExportarExcel")?.closest(".acciones-inventario-pills"),
            ].filter(Boolean);

            bloques.forEach((bloque) => bloque.classList.toggle("oculto", !mostrarGeneral));
        }

        const panelUsuario = $("panelReporteVentasUsuario");
        const panelInventario = $("panelReporteInventario");
        if (panelUsuario) panelUsuario.classList.toggle("oculto", tipo !== "ventas_usuario");
        if (panelInventario) panelInventario.classList.toggle("oculto", tipo !== "inventario");
    }

    async function manejarCambioTipoReporte(tipo) {
        mostrarVistaReporte(tipo);

        if (tipo === "ventas_usuario") {
            await Promise.all([
                cargarCategoriasReporte(),
                cargarUsuariosReporte(),
            ]);
        } else if (tipo === "inventario") {
            await cargarInventarioTotal();
        }
    }

    function pintarReporte(reporte) {
        ultimoReporte = reporte;
        const esAdmin = App.auth.esAdmin();

        const k = reporte.kpis;
        $("kpiVentasHoy").textContent = App.fmt.dinero(k.total_vendido);
        $("kpiCantidadVentasHoy").textContent = App.fmt.entero(k.cantidad_ventas);
        $("kpiProductosVendidosHoy").textContent = App.fmt.entero(k.productos_vendidos);
        $("kpiTicketPromedio").textContent = App.fmt.dinero(k.ticket_promedio || 0);

        App.ui.pintarTabla(
            "tablaVentasReporte",
            "mensajeSinReportes",
            reporte.ventas,
            (v) => {
                const btnAnular = esAdmin
                    ? `<button class="btn-accion eliminar" data-anular="${v.id}">Anular</button>`
                    : "";
                const subtotal = v.subtotal !== undefined ? v.subtotal : v.total / 1.15;
                return `
                    <td>${App.fmt.fechaHora(v.fecha)}</td>
                    <td>#${v.id}</td>
                    <td>${App.fmt.texto(v.metodo_pago)}</td>
                    <td>${App.fmt.dinero(subtotal)}</td>
                    <td><strong>${App.fmt.dinero(v.total)}</strong></td>
                    <td class="acciones-tabla">
                        <button class="btn-accion" data-factura="${v.id}">Factura</button>
                        ${btnAnular}
                    </td>`;
            }
        );

        ajustarAlturaTabla();
    }

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

    function escaparCSV(valor) {
        const texto = String(valor ?? "").replace(/"/g, '""');
        return `"${texto}"`;
    }

    function exportar(ventas, nombre) {
        if (ventas.length === 0) {
            App.ui.aviso("No hay ventas en este período para exportar.");
            return;
        }

        const cabecera = "ID,Fecha,Metodo de pago,Vendedor,Subtotal,IVA,Total";
        const filas = ventas.map((v) => {
            const sub = v.subtotal !== undefined ? v.subtotal : "";
            const iva = v.impuesto !== undefined ? v.impuesto : "";
            return [
                v.id,
                escaparCSV(v.fecha),
                escaparCSV(v.metodo_pago),
                escaparCSV(v.vendedor),
                sub,
                iva,
                v.total,
            ].join(",");
        });

        const contenido = "\uFEFF" + [cabecera, ...filas].join("\n");
        App.ui.descargar(
            new Blob([contenido], { type: "text/csv;charset=utf-8;" }),
            nombre
        );

        App.ui.aviso(`Se exportaron ${ventas.length} ventas.`);
    }

    async function verFactura(id) {
        try {
            const venta = await App.api.venta(id);
            App.factura.imprimir(venta);
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    async function anularVenta(id) {
        if (
            !App.ui.confirmar(
                `¿Anular la venta #${id}? Las unidades vendidas se devolverán automáticamente al stock.`
            )
        ) {
            return;
        }

        try {
            const r = await App.api.anularVenta(id);
            App.ui.aviso(r.mensaje || `Venta #${id} anulada.`);
            if (periodoActual.includes("_a_")) {
                await cargarPorFechas();
            } else {
                await cargar(periodoActual);
            }
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (!App.layout.montar()) return;

        const contenedorTipoReporte = $("contenedorTipoReporte");
        const panelReporteVentasUsuario = $("panelReporteVentasUsuario");
        const panelReporteInventario = $("panelReporteInventario");
        const tipoSelect = $("selectTipoReporte");
        const selectUsuario = $("selectUsuarioReporte");
        const filtroCategoria = $("filtroCategoriaReporte");
        const btnVistaFactura = $("btnVistaFactura");
        const btnVistaInventario = $("btnVistaInventario");

        if (tipoSelect) {
            tipoSelect.addEventListener("change", (evento) => {
                manejarCambioTipoReporte(evento.target.value);
            });
        }

        if (selectUsuario) {
            selectUsuario.addEventListener("change", (evento) => {
                cargarReporteUsuario(Number(evento.target.value));
            });
        }

        if (filtroCategoria) {
            filtroCategoria.addEventListener("change", () => {
                const idUsuario = selectUsuario ? Number(selectUsuario.value) : 0;
                cargarReporteUsuario(idUsuario);
            });
        }

        if (btnVistaFactura) {
            btnVistaFactura.addEventListener("click", () => mostrarVistaDetalle("facturas"));
        }

        if (btnVistaInventario) {
            btnVistaInventario.addEventListener("click", () => mostrarVistaDetalle("inventario"));
        }

        if (App.auth.esAdmin()) {
            manejarCambioTipoReporte(tipoSelect ? tipoSelect.value || "" : "");
        } else {
            if (contenedorTipoReporte) contenedorTipoReporte.classList.add("oculto");
            if (panelReporteVentasUsuario) panelReporteVentasUsuario.classList.add("oculto");
            if (panelReporteInventario) panelReporteInventario.classList.add("oculto");
        }

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
            const btnFactura = evento.target.closest("[data-factura]");
            if (btnFactura) {
                verFactura(Number(btnFactura.dataset.factura));
                return;
            }
            const btnAnular = evento.target.closest("[data-anular]");
            if (btnAnular) {
                anularVenta(Number(btnAnular.dataset.anular));
            }
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
