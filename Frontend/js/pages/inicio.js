/* Panel de inicio.
 *
 * La página estaba vacía: solo el sidebar y la cabecera, sin contenido.
 * Ahora resume el estado del negocio con los endpoints existentes.
 */

(function () {
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
            .filter((p) => p.stock <= 5)
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 8);

        App.ui.pintarTabla(
            "tablaStockBajo",
            "mensajeSinAlertas",
            bajos,
            (p) => {
                const estado =
                    p.stock === 0
                        ? '<span class="badge agotado">Agotado</span>'
                        : '<span class="badge disponible">Bajo</span>';
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
        if (!App.auth.exigir()) return;
    App.layout.montar();

        $("btnIrInventario").addEventListener("click", () => {
            window.location.href = "almacen.html";
        });

        await cargarResumen();
        await cargarStockBajo();
    });
})();
