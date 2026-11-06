/* Panel principal de inicio - Tienda Alexander. */

(function () {
    const UMBRAL_STOCK_BAJO = 5;
    const $ = (id) => document.getElementById(id);

    async function cargarResumen() {
        try {
            const resumen = await App.api.resumenInventario();

            $("kpiProductos").textContent = App.fmt.entero(resumen.total_productos);
            if ($("kpiUnidadesTotales")) {
                $("kpiUnidadesTotales").textContent = App.fmt.entero(resumen.unidades_totales || 0);
            }
            $("kpiValorInventario").textContent = App.fmt.dinero(resumen.valor_inventario);
            if ($("kpiGananciaPotencial")) {
                $("kpiGananciaPotencial").textContent = App.fmt.dinero(resumen.ganancia_potencial || 0);
            }
            const bajos = Number(resumen.productos_stock_bajo || 0);
            const agotados = Number(resumen.productos_agotados || 0);
            $("kpiAgotados").textContent = `${bajos} / ${agotados}`;
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    async function cargarStockBajo() {
        let productos = [];
        try {
            productos = await App.api.productos();
        } catch (err) {
            App.ui.aviso(err.message);
            return;
        }

        const bajos = productos
            .filter((p) => p.stock <= UMBRAL_STOCK_BAJO)
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 8);

        App.ui.pintarTabla(
            "tablaStockBajo",
            "mensajeSinAlertas",
            bajos,
            (p) => {
                const estado =
                    p.stock === 0
                        ? '<span class="badge agotado">Agotado (0)</span>'
                        : `<span class="badge bajo">Bajo (${p.stock})</span>`;
                return `
                    <td><strong>${App.fmt.texto(p.nombre)}</strong></td>
                    <td>${App.fmt.texto(p.categoria_nombre)}</td>
                    <td>${App.fmt.dinero(p.precio)}</td>
                    <td>${App.fmt.entero(p.stock)}</td>
                    <td>${estado}</td>`;
            }
        );
    }

    document.addEventListener("DOMContentLoaded", async () => {
        if (!App.layout.montar()) return;

        $("btnIrInventario").addEventListener("click", () => {
            window.location.href = "almacen.html";
        });

        await cargarResumen();
        await cargarStockBajo();
    });
})();
