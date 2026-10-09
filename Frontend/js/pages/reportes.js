/* Reportes de ventas.
 *
 * Backend/reportes.js estaba vacío. Los KPIs y el listado salen de
 * GET /api/reportes, que calcula los totales en SQL. Además de los
 * accesos rápidos (hoy / 7 días / 30 días) la vista permite elegir un
 * rango de fechas exacto con fecha_inicio y fecha_fin.
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

        window.addEventListener("resize", ajustarAlturaTabla);

        cargar("hoy");
    });
})();
