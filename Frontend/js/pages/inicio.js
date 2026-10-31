/* Panel principal de inicio - Tienda Alexander. */

(function () {
    const UMBRAL_STOCK_BAJO = 5;
    const $ = (id) => document.getElementById(id);

    async function cargarResumen() {
        try {
            const resumen = await App.api.resumenInventario();

            $("kpiProductos").textContent = App.fmt.entero(resumen.total_productos);
            $("kpiValorInventario").textContent = App.fmt.dinero(resumen.valor_inventario);
            $("kpiAgotados").textContent = App.fmt.entero(resumen.productos_agotados);
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
                        : `<span class="badge" style="color: #fd7e14; font-weight: bold;">Bajo (${p.stock})</span>`;
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
