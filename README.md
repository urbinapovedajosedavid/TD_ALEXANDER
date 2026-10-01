# TiendaAlexander
para ejecutar el git y se suba solo ingrsem ala terminal de aqui y ejecuuten esto

 .\subir.bat





            <!-- VISTAS DINÁMICAS -->
<main class="tab-content">
    <!-- Pestaña 1: Inicio -->
    <section id="tabInicio" class="tab-pane tab-activa">
        <!-- Contenido de inicio -->
    </section>

    <!-- Pestaña 2: Inventario (Aquí debe estar integrado) -->
    <section id="tabInventario" class="tab-pane">
        <div class="tarjeta-inventario">
            <h1 class="titulo-inventario">Gestión de Inventario</h1>

            <div class="search-bar-pill">
                <span class="icono-buscar">🔍</span>
                <input type="text" id="inputBuscarProducto" placeholder="Buscar productos por ID, nombre, categoría, o ubicación..." />
            </div>

            <div class="tabla-panel">
                <table class="inventory-table">
                    <thead>
                        <tr>
                            <th>Nombre del Producto</th>
                            <th>Código</th>
                            <th>Precio</th>
                            <th>Stock</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tablaProductos"></tbody>
                </table>
                <div id="mensajeSinProductos" class="estado-vacio" style="display: none;">
                    No hay productos disponibles en el inventario.
                </div>
            </div>

            <div class="acciones-inventario-pills">
                <button type="button" id="botonAgregarProducto" class="btn-pill btn-pill-menta">Añadir Nuevo Producto</button>
                <button type="button" id="botonGenerarReporte" class="btn-pill btn-pill-menta">Generar Reporte de Stock</button>
                <button type="button" id="btnAlertasStock" class="btn-pill btn-pill-menta">Alertas de Stock Bajo</button>
                <button type="button" id="btnResumenCategoria" class="btn-pill btn-pill-oscuro">Ver Resumen por Categoría</button>
                <button type="button" id="btnGestionarTipos" class="btn-pill btn-pill-oscuro">Gestionar Tipos de Producto</button>
            </div>
        </div>
    </section>
    
    <!-- Resto de pestañas: Ventas, Reportes, Proveedores -->
</main>