// ==========================================
// 1. SELECCIÓN DE ELEMENTOS DEL DOM
// ==========================================
const vistaLogin = document.getElementById("loginVista");
const vistaAdmin = document.getElementById("adminVista");
const formLogin = document.getElementById("formLogin");
const formCrearUsuario = document.getElementById("formCrearUsuario");
const botonCerrarSesion = document.getElementById("botonCerrarSesion");
const usuarioAdminValor = document.getElementById("usuarioAdminValor");
const mensajeLogin = document.getElementById("mensajeLogin");
const circleAdmin = document.getElementById("circleAdmin");
const circulosUsuarios = document.getElementById("circulosUsuarios");
const btnAgregarUsuarioUnder = document.getElementById(
  "btnAgregarUsuarioUnder",
);
const modalLogin = document.getElementById("modalLogin");
const cerrarModalLogin = document.getElementById("cerrarModalLogin");
const formLoginModal = document.getElementById("formLoginModal");
const usuarioModalLogin = document.getElementById("usuarioModalLogin");
const claveModalLogin = document.getElementById("claveModalLogin");
const mensajeLoginModal = document.getElementById("mensajeLoginModal");
const cancelLoginModal = document.getElementById("cancelLoginModal");
const aggUsuario = document.getElementById("aggUsuario");
const modalCrearUsuario = document.getElementById("modalCrearUsuario");
const cerrarModalCrearUsuario = document.getElementById(
  "cerrarModalCrearUsuario",
);
const formCrearUsuarioModal = document.getElementById("formCrearUsuarioModal");
const btnCancelarCrearUsuario = document.getElementById(
  "btnCancelarCrearUsuario",
);
const inputNombreNuevo = document.getElementById("nombreNuevo");
const inputApellidosNuevo = document.getElementById("apellidosNuevo");
const inputCelularNuevo = document.getElementById("celularNuevo");
const inputDireccionNuevo = document.getElementById("direccionNuevo");
const inputUsuarioNuevo = document.getElementById("usuarioNuevo");
const inputClaveNuevaModal = document.getElementById("claveNuevaModal");
const inputConfirmarClaveModal = document.getElementById("confirmarClaveModal");
const inputAdminClaveCrear = document.getElementById("adminClaveCrear");
const botonAgregarProducto = document.getElementById("botonAgregarProducto");
const botonGenerarReporte = document.getElementById("botonGenerarReporte");
const botonAjustes = document.getElementById("botonAjustes");
const menuAjustes = document.getElementById("menuAjustes");
const cerrarSesionAjustes = document.getElementById("cerrarSesionAjustes");
const cambiarCuentaAjustes = document.getElementById("cambiarCuentaAjustes");
const eliminarCuentaAjustes = document.getElementById("eliminarCuentaAjustes");
const cambiarContrasenaAjustes = document.getElementById(
  "cambiarContrasenaAjustes",
);
const verPerfilesAjustes = document.getElementById("verPerfilesAjustes");
const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
const areaReporte = document.getElementById("areaReporte");
const areaFactura = document.getElementById("areaFactura");
const modalProducto = document.getElementById("modalProducto");
const modalPerfiles = document.getElementById("modalPerfiles");
const cerrarModalPerfiles = document.getElementById("cerrarModalPerfiles");
const listaPerfiles = document.getElementById("listaPerfiles");
const cerrarModalProducto = document.getElementById("cerrarModalProducto");
const formProducto = document.getElementById("formProducto");
const tituloModalProducto = document.getElementById("tituloModalProducto");
const inputProductoId = document.getElementById("productoId");
const inputNombreProducto = document.getElementById("nombreProducto");
const inputCodigoProducto = document.getElementById("codigoProducto");
const inputPrecioProducto = document.getElementById("precioProducto");
const inputStockProducto = document.getElementById("stockProducto");
const modalVenta = document.getElementById("modalVenta");
const cerrarModalVenta = document.getElementById("cerrarModalVenta");
const formVenta = document.getElementById("formVenta");
const ventaProductoNombre = document.getElementById("ventaProductoNombre");
const inputCantidadVenta = document.getElementById("cantidadVenta");

// ==========================================
// 2. CONFIGURACIÓN GLOBAL Y VARIABLES
// ==========================================
const LLAVE_PRODUCTOS = "productos_almacen";
let productoEnVenta = null;
let usuarioActual = "Admin";
let rolActual = "admin";

// Reference dinamica para tablas según la vista activa
let tablaProductos = document.getElementById("tablaProductos");
let mensajeSinProductos = document.getElementById("mensajeSinProductos");

// ==========================================
// 3. PERSISTENCIA Y DATOS (LOCALSTORAGE)
// ==========================================
function leerProductos() {
  const datos = localStorage.getItem(LLAVE_PRODUCTOS);
  return datos ? JSON.parse(datos) : [];
}

function guardarProductos(productos) {
  localStorage.setItem(LLAVE_PRODUCTOS, JSON.stringify(productos));
}

function inicializarProductosBase() {
  const productos = leerProductos();
  if (!Array.isArray(productos) || productos.length === 0) {
    const datosSemilla = [
      {
        id: "prod-1",
        nombre: "Producto Ejemplo 1",
        codigo: "P-001",
        precio: 10.0,
        stock: 5,
      },
      {
        id: "prod-2",
        nombre: "Producto Ejemplo 2",
        codigo: "P-002",
        precio: 20.0,
        stock: 0,
      },
    ];
    guardarProductos(datosSemilla);
  }
}

// ==========================================
// 4. RENDERIZADO Y LÓGICA DE INVENTARIO
// ==========================================
function renderProductos() {
  tablaProductos = document.getElementById("tablaProductos");
  mensajeSinProductos = document.getElementById("mensajeSinProductos");

  if (!tablaProductos) return;

  const productos = leerProductos();
  tablaProductos.innerHTML = "";

  if (productos.length === 0) {
    if (mensajeSinProductos) mensajeSinProductos.style.display = "block";
    return;
  }
  if (mensajeSinProductos) mensajeSinProductos.style.display = "none";

  productos.forEach((producto) => {
    const estadoHTML =
      producto.stock > 0
        ? '<span class="status-disponible">Disponible</span>'
        : '<span class="status-agotado">Agotado</span>';

    const acciones = [
      `<button type="button" class="boton boton-secundario boton-accion" data-id="${producto.id}" data-accion="editar">Editar</button>`,
      `<button type="button" class="boton boton-secundario boton-accion" data-id="${producto.id}" data-accion="eliminar">Eliminar</button>`,
    ];

    if (rolActual === "admin") {
      acciones.splice(
        1,
        0,
        `<button type="button" class="boton boton-secundario boton-accion" data-id="${producto.id}" data-accion="vender">Vender</button>`,
      );
    }

    const fila = document.createElement("tr");
    fila.innerHTML = `
            <td><strong>${producto.nombre}</strong></td>
            <td>${producto.codigo}</td>
            <td>$${Number(producto.precio).toFixed(2)}</td>
            <td>${producto.stock}</td>
            <td>${estadoHTML}</td>
            <td class="acciones-tabla">${acciones.join(" ")}</td>
        `;
    tablaProductos.appendChild(fila);
  });
}

function eliminarProducto(id) {
  const productos = leerProductos();
  const filtrados = productos.filter((item) => item.id !== id);
  guardarProductos(filtrados);
  renderProductos();
  actualizarReporte();
}

function venderProducto(cantidad) {
  if (!productoEnVenta) return;
  const productos = leerProductos();
  const index = productos.findIndex((item) => item.id === productoEnVenta.id);
  if (index < 0) return;

  if (cantidad < 1 || cantidad > productos[index].stock) {
    alert("Cantidad no válida o no hay suficiente stock.");
    return;
  }
  productos[index].stock -= cantidad;
  guardarProductos(productos);
  renderProductos();
  actualizarReporte();
  mostrarFactura(productoEnVenta, cantidad);
  cerrarModalVentaFn();
}

function actualizarReporte() {
  if (!areaReporte) return;
  const productos = leerProductos();
  const totalProductos = productos.length;
  const valorInventario = productos.reduce(
    (suma, item) => suma + item.precio * item.stock,
    0,
  );

  areaReporte.innerHTML = `
        <div class="reporte-celda">
            <h5>Total productos</h5>
            <strong>${totalProductos}</strong>
        </div>
        <div class="reporte-celda">
            <h5>Valor inventario</h5>
            <strong>$${valorInventario.toFixed(2)}</strong>
        </div>
        <div class="reporte-celda">
            <h5>Productos con stock cero</h5>
            <strong>${productos.filter((item) => item.stock === 0).length}</strong>
        </div>
    `;
}

function mostrarFactura(producto, cantidad) {
  if (!areaFactura) return;
  const total = producto.precio * cantidad;
  areaFactura.innerHTML = `
        <div class="factura-celda">
            <h5>Factura de venta</h5>
            <p>Producto: <strong>${producto.nombre}</strong></p>
            <p>Código: <strong>${producto.codigo}</strong></p>
            <p>Cantidad vendida: <strong>${cantidad}</strong></p>
            <p>Precio unitario: <strong>$${producto.precio.toFixed(2)}</strong></p>
            <p>Total: <strong>$${total.toFixed(2)}</strong></p>
        </div>
    `;
}

function obtenerProductoPorId(id) {
  const productos = leerProductos();
  return productos.find((item) => item.id === id);
}

function validarProducto(nombre, codigo, precio, stock) {
  const errores = [];
  if (!nombre || nombre.trim().length < 2)
    errores.push("El nombre debe tener al menos 2 caracteres.");
  if (!codigo || codigo.trim().length < 2)
    errores.push("El código es obligatorio.");
  if (isNaN(precio) || precio <= 0)
    errores.push("El precio debe ser mayor que 0.");
  if (!Number.isInteger(stock) || stock < 0)
    errores.push("El stock debe ser un número entero igual o mayor a 0.");
  return errores;
}

function guardarProducto(evento) {
  evento.preventDefault();
  const id = inputProductoId.value;
  const nombre = inputNombreProducto.value.trim();
  const codigo = inputCodigoProducto.value.trim();
  const precio = parseFloat(inputPrecioProducto.value);
  const stock = parseInt(inputStockProducto.value, 10);

  const errores = validarProducto(nombre, codigo, precio, stock);
  if (errores.length > 0) {
    alert(errores.join("\n"));
    return;
  }

  const productos = leerProductos();
  if (id) {
    const index = productos.findIndex((item) => item.id === id);
    if (index >= 0) {
      productos[index] = { id, nombre, codigo, precio, stock };
    }
  } else {
    const nuevoProducto = {
      id: `prod-${Date.now()}`,
      nombre,
      codigo,
      precio,
      stock,
    };
    productos.push(nuevoProducto);
  }

  guardarProductos(productos);
  cerrarModalProductoFn();
  renderProductos();
  actualizarReporte();
}

// ==========================================
// 5. GESTIÓN DE MODALES
// ==========================================
function abrirModalProducto(producto) {
  if (!modalProducto) return;
  modalProducto.classList.add("modal-activo");
  modalProducto.setAttribute("aria-hidden", "false");

  if (producto) {
    inputProductoId.value = producto.id;
    inputNombreProducto.value = producto.nombre;
    inputCodigoProducto.value = producto.codigo;
    inputPrecioProducto.value = producto.precio;
    inputStockProducto.value = producto.stock;
    if (tituloModalProducto)
      tituloModalProducto.textContent = "Editar producto";
  } else {
    inputProductoId.value = "";
    if (formProducto) formProducto.reset();
    if (tituloModalProducto)
      tituloModalProducto.textContent = "Agregar producto";
  }
}

function cerrarModalProductoFn() {
  if (!modalProducto) return;
  modalProducto.classList.remove("modal-activo");
  modalProducto.setAttribute("aria-hidden", "true");
}

function abrirModalVenta(producto) {
  if (!modalVenta || !ventaProductoNombre) return;
  productoEnVenta = producto;
  ventaProductoNombre.textContent = producto.nombre;
  if (inputCantidadVenta) inputCantidadVenta.value = 1;
  modalVenta.classList.add("modal-activo");
  modalVenta.setAttribute("aria-hidden", "false");
}

function cerrarModalVentaFn() {
  if (!modalVenta) return;
  modalVenta.classList.remove("modal-activo");
  modalVenta.setAttribute("aria-hidden", "true");
  productoEnVenta = null;
}

function abrirModalLogin(prefillUser) {
  if (!modalLogin) return;
  modalLogin.classList.add("modal-activo");
  modalLogin.setAttribute("aria-hidden", "false");
  if (usuarioModalLogin) usuarioModalLogin.value = prefillUser || "";
  if (claveModalLogin) claveModalLogin.value = "";
  if (mensajeLoginModal) mensajeLoginModal.textContent = "";
}

function cerrarModalLoginFn() {
  if (!modalLogin) return;
  modalLogin.classList.remove("modal-activo");
  modalLogin.setAttribute("aria-hidden", "true");
}

function cerrarModalCrearUsuarioFn() {
  if (!modalCrearUsuario) return;
  modalCrearUsuario.classList.remove("modal-activo");
  modalCrearUsuario.setAttribute("aria-hidden", "true");
}

// ==========================================
// 6. NAVEGACIÓN Y AUTENTICACIÓN
// ==========================================
function cambiarTab(tabId) {
  document
    .querySelectorAll(".tab-pane")
    .forEach((pane) => pane.classList.remove("tab-activa"));
  document
    .querySelectorAll(".sidebar-nav .nav-item")
    .forEach((item) => item.classList.remove("nav-item-activa"));

  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add("tab-activa");

  const boton = document.querySelector(
    `.sidebar-nav .nav-item[data-tab="${tabId}"]`,
  );
  if (boton) boton.classList.add("nav-item-activa");
}

function redirigirAlLogin() {
  window.location.href = "Login.html";
}

function obtenerParametroUrl(nombre) {
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre) || "";
}

function inicializarSesion() {
  const role = obtenerParametroUrl("role");
  const user = obtenerParametroUrl("user");
  if (role === "admin") {
    rolActual = "admin";
    usuarioActual = "Admin";
  } else if (role === "usuario" && user) {
    rolActual = "usuario";
    usuarioActual = user;
  }
}

// ==========================================
// 7. INICIALIZACIÓN Y EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
  inicializarSesion();
  inicializarProductosBase();
  renderProductos();
  actualizarReporte();

  // Navegación Sidebar (Gestión Inteligente de Redirección vs Tabs)
  if (navItems) {
    navItems.forEach((item) => {
      item.addEventListener("click", function () {
        const tabId = this.getAttribute("data-tab");
        const destinoMap = {
          tabInicio: "inicio.html",
          tabVentas: "ventas.html",
          tabInventario: "almacen.html",
          tabReportes: "reportes.html",
          tabProveedores: "proveedores.html",
        };

        // Si la pestaña existe en esta página la cambia, si no redirige a su archivo HTML
        if (document.getElementById(tabId)) {
          cambiarTab(tabId);
        } else if (destinoMap[tabId]) {
          window.location.href = destinoMap[tabId];
        }
      });
    });
  }
});

/* para que sirva el despliego del endrenaje de ajustes */
document.addEventListener("DOMContentLoaded", () => {
    const botonAjustes = document.getElementById("botonAjustes");
    const menuAjustes = document.getElementById("menuAjustes");

    if (botonAjustes && menuAjustes) {
        // Asegurar que comience oculto
        menuAjustes.classList.add("oculto");

        // Alternar visibilidad al hacer clic en el botón de ajustes
        botonAjustes.addEventListener("click", (e) => {
            e.stopPropagation();
            menuAjustes.classList.toggle("oculto");
        });

        // Ocultar el menú si se hace clic fuera de él
        document.addEventListener("click", (e) => {
            if (!menuAjustes.contains(e.target) && !botonAjustes.contains(e.target)) {
                menuAjustes.classList.add("oculto");
            }
        });
    }
});



// Event delegation para botones de acción en la tabla (Editar, Eliminar, Vender)
document.addEventListener("click", function (evento) {
  const boton = evento.target.closest("[data-accion]");
  if (!boton) return;

  const id = boton.getAttribute("data-id");
  const accion = boton.getAttribute("data-accion");
  const producto = obtenerProductoPorId(id);

  if (!producto) return;

  if (accion === "editar") abrirModalProducto(producto);
  if (accion === "eliminar") eliminarProducto(id);
  if (accion === "vender") abrirModalVenta(producto);
});

// listeners de Formularios y Modales
if (formProducto) formProducto.addEventListener("submit", guardarProducto);
if (botonAgregarProducto)
  botonAgregarProducto.addEventListener("click", () =>
    abrirModalProducto(null),
  );
if (cerrarModalProducto)
  cerrarModalProducto.addEventListener("click", cerrarModalProductoFn);

if (formVenta) {
  formVenta.addEventListener("submit", function (evento) {
    evento.preventDefault();
    const cantidad = parseInt(inputCantidadVenta.value, 10);
    venderProducto(cantidad);
  });
}
if (cerrarModalVenta)
  cerrarModalVenta.addEventListener("click", cerrarModalVentaFn);
if (botonGenerarReporte)
  botonGenerarReporte.addEventListener("click", actualizarReporte);
