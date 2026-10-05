/* Reportes de ventas.
 *
 * Backend/reportes.js estaba vacío. Los KPIs y el listado salen de
 * GET /api/reportes, que calcula los totales en SQL.
 */

(function () {
    const $ = (id) => document.getElementById(id);

    const PERIODOS = {
        hoy: "Reporte de Ventas del Día Actual",
        semana: "Reporte de Ventas de los Últimos 7 Días",
        mes: "Reporte de Ventas de los Últimos 30 Días",
    };

    let periodoActual = "hoy";
    let ultimoReporte = null;

    async function cargar(periodo) {
        periodoActual = periodo;

        try {
            ultimoReporte = await App.api.reportes(periodo);
        } catch (err) {
            App.ui.aviso(err.message);
            return;
        }

        $("tituloVistaReporte").textContent = PERIODOS[periodo];

        const k = ultimoReporte.kpis;
        $("kpiVentasHoy").textContent = App.fmt.dinero(k.total_vendido);
        $("kpiCantidadVentasHoy").textContent = App.fmt.entero(k.cantidad_ventas);
        $("kpiProductosVendidosHoy").textContent = App.fmt.entero(k.productos_vendidos);

        App.ui.pintarTabla(
            "tablaVentasReporte",
            "mensajeSinReportes",
            ultimoReporte.ventas,
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

$("btnExportarExcel").addEventListener("click", () => {
            if (!ultimoReporte) return;
            exportar(ultimoReporte.ventas, `ventas_${periodoActual}.csv`);
        });

$("tablaVentasReporte").addEventListener("click", (evento) => {
            const boton = evento.target.closest("[data-factura]");
            if (!boton) return;
            verFactura(Number(boton.dataset.factura));
        });

        cargar("hoy");
    });
})();

