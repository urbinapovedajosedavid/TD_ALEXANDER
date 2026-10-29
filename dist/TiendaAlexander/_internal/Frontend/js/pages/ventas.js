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
    let totalActual = 0;

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

    /* ---------- Pago en efectivo y vuelto ---------- */

    function efectivoRecibido() {
        const valor = Number($("inputEfectivoRecibido").value);
        return Number.isFinite(valor) && valor > 0 ? valor : 0;
    }

    /* Recalcula el vuelto en vivo y colorea el panel según el monto. */
    function actualizarVuelto() {
        const recibido = efectivoRecibido();
        const vuelto = Math.round((recibido - totalActual) * 100) / 100;
        const panel = $("vueltoPanel");
        const alerta = $("alertaPago");

        $("vueltoValor").textContent = App.fmt.dinero(vuelto > 0 ? vuelto : 0);
        panel.classList.remove("ok", "insuficiente");
        alerta.classList.remove("visible");
        alerta.textContent = "";

        if (totalActual === 0 || recibido === 0) return;

        if (recibido < totalActual) {
            const faltante = Math.round((totalActual - recibido) * 100) / 100;
            panel.classList.add("insuficiente");
            alerta.textContent = `Faltan ${App.fmt.dinero(faltante)} para cubrir el total.`;
            alerta.classList.add("visible");
        } else {
            panel.classList.add("ok");
        }
    }

    /* El monto en efectivo solo aplica al método "efectivo". */
    function actualizarPanelPago() {
        const esEfectivo = $("selectMetodoPago").value === "efectivo";
        $("panelPagoEfectivo").classList.toggle("oculto", !esEfectivo);
    }

    function limpiarPago() {
        $("inputEfectivoRecibido").value = "";
        actualizarVuelto();
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
        totalActual = Math.round((subtotal + impuesto) * 100) / 100;

        $("subtotalVentaValor").textContent = App.fmt.dinero(subtotal);
        $("impuestoVentaValor").textContent = App.fmt.dinero(impuesto);
        $("totalVentaValor").textContent = App.fmt.dinero(subtotal + impuesto);

        actualizarVuelto();
    }

    /* ---------- Confirmación "¿Estás seguro?" con Sí / No ----------
     * Se construye en JavaScript y reutiliza los estilos de modal y
     * botones píldora que ya están en base.css. Devuelve una promesa
     * que resuelve true (Sí) o false (No / cerrar / clic fuera).
     */
    function pedirConfirmacion(mensaje) {
        let modal = $("modalConfirmarVenta");

        if (!modal) {
            modal = document.createElement("div");
            modal.id = "modalConfirmarVenta";
            modal.className = "modal modal-oculto";
            modal.setAttribute("role", "dialog");
            modal.setAttribute("aria-modal", "true");
            modal.innerHTML = `
                <div class="modal-contenido">
                    <div class="modal-cabecera">
                        <h3>¿Estás seguro?</h3>
                        <button type="button" class="boton-cerrar" data-no aria-label="Cerrar">&times;</button>
                    </div>
                    <p data-mensaje style="color: var(--texto-suave); font-size: 0.9rem; line-height: 1.5; margin-bottom: 4px;"></p>
                    <div class="modal-acciones">
                        <button type="button" class="btn-pill btn-pill-oscuro" data-no>No</button>
                        <button type="button" class="btn-pill btn-pill-menta" data-si>Sí, cobrar</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        }

        modal.querySelector("[data-mensaje]").textContent = mensaje;

        return new Promise((resolver) => {
            const responder = (respuesta) => {
                modal.removeEventListener("click", alTocar);
                App.ui.cerrar("modalConfirmarVenta");
                resolver(respuesta);
            };

            const alTocar = (evento) => {
                if (evento.target.closest("[data-si]")) responder(true);
                else if (evento.target.closest("[data-no]") || evento.target === modal) responder(false);
            };

            modal.addEventListener("click", alTocar);
            App.ui.abrir("modalConfirmarVenta");
        });
    }

    async function completarVenta() {
        if (carrito.length === 0) {
            App.ui.aviso("Agrega al menos un producto antes de cobrar.");
            return;
        }

        const usuario = App.auth.actual();

        if ($("selectMetodoPago").value === "efectivo" && efectivoRecibido() < totalActual) {
            App.ui.aviso("El efectivo recibido no alcanza para cubrir el total.");
            $("inputEfectivoRecibido").focus();
            return;
        }

        const confirmado = await pedirConfirmacion(
            `Se registrará la venta por ${App.fmt.dinero(totalActual)} y se vaciará el carrito.`
        );
        if (!confirmado) return;

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
            limpiarPago();
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
        limpiarPago();
        renderCarrito();
    }

    document.addEventListener("DOMContentLoaded", async () => {
        if (!App.auth.exigir()) return;
    App.layout.montar();

        $("inputBuscarVentaProducto").addEventListener("input", filtrarProductos);
        $("btnCompletarVenta").addEventListener("click", completarVenta);
        $("btnCancelarVenta").addEventListener("click", cancelarVenta);
        $("inputEfectivoRecibido").addEventListener("input", actualizarVuelto);
        $("selectMetodoPago").addEventListener("change", actualizarPanelPago);

        document.querySelector(".montos-rapidos").addEventListener("click", (evento) => {
            const chip = evento.target.closest(".chip-monto");
            if (!chip) return;
            const input = $("inputEfectivoRecibido");
            if (chip.dataset.exacto) {
                input.value = totalActual > 0 ? totalActual.toFixed(2) : "";
            } else {
                // Suma acumulativa: pulsar billetes seguidos cuenta el efectivo.
                input.value = (efectivoRecibido() + Number(chip.dataset.monto)).toFixed(2);
            }
            actualizarVuelto();
        });

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
        actualizarPanelPago();
        renderCarrito();
    });
})();
