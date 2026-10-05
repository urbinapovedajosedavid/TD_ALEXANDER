/* Terminal de ventas.
 *
 * El archivo Backend/ventas.js estaba vacío aunque la página ya tenía
 * toda la interfaz. Este script la conecta con POST /api/ventas, que
 * descuenta el stock en el servidor dentro de una transacción.
 */

(function () {
    const $ = (id) => document.getElementById(id);
    const IVA = 0.15;

    let productos = [];
    let carrito = [];

    async function cargarProductos() {
        try {
            productos = await App.api.productos();
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    function filtrarProductos() {
        const texto = ($("inputBuscarVentaProducto").value || "").trim().toLowerCase();

        const filtrados = texto
            ? productos.filter(
                  (p) =>
                      p.nombre.toLowerCase().includes(texto) ||
                      (p.codigo || "").toLowerCase().includes(texto)
              )
            : productos;

        App.ui.pintarTabla(
            "tablaBusquedaProductosVenta",
            "mensajeSinProductosVenta",
            filtrados,
            (p) => `
                <td>${App.fmt.texto(p.codigo) || "N/A"}</td>
                <td><strong>${App.fmt.texto(p.nombre)}</strong></td>
                <td>${App.fmt.dinero(p.precio)}</td>
                <td>${App.fmt.entero(p.stock)}</td>
                <td class="acciones-tabla">
                    <button class="btn-accion" data-agregar="${p.id}"
                            ${p.stock === 0 ? "disabled" : ""}>
                        ${p.stock === 0 ? "Agotado" : "Agregar"}
                    </button>
                </td>`
        );
    }

    function agregarAlCarrito(id) {
        const producto = productos.find((p) => p.id === id);
        if (!producto) return;

        const item = carrito.find((i) => i.id === id);
        const cantidadActual = item ? item.cantidad : 0;

        if (cantidadActual >= producto.stock) {
            App.ui.aviso(`Solo hay ${producto.stock} unidades de "${producto.nombre}".`);
            return;
        }

        if (item) {
            item.cantidad += 1;
        } else {
            carrito.push({
                id: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                cantidad: 1,
                stock: producto.stock,
            });
        }

        renderCarrito();
    }

    function cambiarCantidad(id, delta) {
        const item = carrito.find((i) => i.id === id);
        if (!item) return;

        const nueva = item.cantidad + delta;
        if (nueva <= 0) {
            carrito = carrito.filter((i) => i.id !== id);
        } else if (nueva > item.stock) {
            App.ui.aviso(`Solo hay ${item.stock} unidades disponibles.`);
            return;
        } else {
            item.cantidad = nueva;
        }

        renderCarrito();
    }

    function renderCarrito() {
        App.ui.pintarTabla(
            "tablaCarritoVentas",
            "mensajeCarritoVacio",
            carrito,
            (item) => `
                <td><strong>${App.fmt.texto(item.nombre)}</strong></td>
                <td class="celda-cantidad">
                    <button class="btn-cantidad" data-id="${item.id}" data-delta="-1">&minus;</button>
                    <span>${item.cantidad}</span>
                    <button class="btn-cantidad" data-id="${item.id}" data-delta="1">+</button>
                </td>
                <td>${App.fmt.dinero(item.precio)}</td>
                <td>${App.fmt.dinero(item.precio * item.cantidad)}</td>
                <td class="acciones-tabla">
                    <button class="btn-accion eliminar" data-quitar="${item.id}">Quitar</button>
                </td>`
        );

        const subtotal = carrito.reduce(
            (suma, item) => suma + item.precio * item.cantidad,
            0
        );
        const impuesto = Math.round(subtotal * IVA * 100) / 100;

        $("subtotalVentaValor").textContent = App.fmt.dinero(subtotal);
        $("impuestoVentaValor").textContent = App.fmt.dinero(impuesto);
        $("totalVentaValor").textContent = App.fmt.dinero(subtotal + impuesto);
    }

    async function completarVenta() {
        if (carrito.length === 0) {
            App.ui.aviso("Agrega al menos un producto antes de cobrar.");
            return;
        }

        const usuario = App.auth.actual();
        const cuerpo = {
            usuario_id: usuario ? usuario.id : null,
            metodo_pago: $("selectMetodoPago").value,
            items: carrito.map((i) => ({ id: i.id, cantidad: i.cantidad })),
        };

try {
            const venta = await App.api.registrarVenta(cuerpo);

            $("subtotalVentaValor").textContent = App.fmt.dinero(venta.subtotal);
            $("impuestoVentaValor").textContent = App.fmt.dinero(venta.impuesto);
            $("totalVentaValor").textContent = App.fmt.dinero(venta.total);

            App.ui.aviso(`Venta #${venta.venta_id} registrada por ${App.fmt.dinero(venta.total)}.`);
            // La factura se arma con el detalle que devolvió el servidor, que
            // es lo que quedó guardado: el carrito se vacía justo después.
            App.factura.imprimir({
                venta_id: venta.venta_id,
                fecha: venta.fecha,
                metodo_pago: venta.metodo_pago,
                vendedor: usuario ? usuario.nombre : "",
                subtotal: venta.subtotal,
                impuesto: venta.impuesto,
                total: venta.total,
                items: venta.items,
            });

            carrito = [];
            renderCarrito();
            await cargarProductos();
            filtrarProductos();
        } catch (err) {
            App.ui.aviso(err.message);
        }
    }

    
    function cancelarVenta() {
        if (carrito.length === 0) return;
        if (!App.ui.confirmar("¿Vaciar el carrito y cancelar la venta?")) return;
        carrito = [];
        renderCarrito();
    }

    document.addEventListener("DOMContentLoaded", async () => {
        if (!App.auth.exigir()) return;
    App.layout.montar();

        $("inputBuscarVentaProducto").addEventListener("input", filtrarProductos);
        $("btnCompletarVenta").addEventListener("click", completarVenta);
        $("btnCancelarVenta").addEventListener("click", cancelarVenta);

        $("tablaBusquedaProductosVenta").addEventListener("click", (evento) => {
            const boton = evento.target.closest("[data-agregar]");
            if (boton) agregarAlCarrito(Number(boton.dataset.agregar));
        });

        $("tablaCarritoVentas").addEventListener("click", (evento) => {
            const cantidad = evento.target.closest("[data-delta]");
            if (cantidad) {
                cambiarCantidad(Number(cantidad.dataset.id), Number(cantidad.dataset.delta));
                return;
            }
            const quitar = evento.target.closest("[data-quitar]");
            if (quitar) {
                carrito = carrito.filter((i) => i.id !== Number(quitar.dataset.quitar));
                renderCarrito();
            }
        });

        await cargarProductos();
        filtrarProductos();
        renderCarrito();
    });
})();
