const API_URL = "http://127.0.0.1:5000/api";

let productosCache = [];
let categoriasCache = [];

document.addEventListener("DOMContentLoaded", () => {
    cargarCategorias();
    cargarProductos();

    document.getElementById("inputBuscarProducto").addEventListener("input", filtrarProductos);
    document.getElementById("botonAgregarProducto").addEventListener("click", abrirModalAgregar);
    document.getElementById("formProducto").addEventListener("submit", guardarProductoSubmit);
    document.getElementById("selectCategoria").addEventListener("change", manejarCambioCategoria);
});

// 1. Cargar Categorías desde Flask
async function cargarCategorias() {
    try {
        const res = await fetch(`${API_URL}/categorias`);
        categoriasCache = await res.json();
        
        const selectCat = document.getElementById("selectCategoria");
        selectCat.innerHTML = '<option value="">-- Seleccionar Categoría --</option>';
        
        categoriasCache.forEach(cat => {
            selectCat.innerHTML += `<option value="${cat.id}">${cat.nombre}</option>`;
        });

        // Opción para añadir una nueva categoría
        selectCat.innerHTML += '<option value="OTRO">Otro (Añadir nueva...)</option>';
    } catch (err) {
        console.error("Error al cargar categorías:", err);
    }
}

// Controlar visibilidad del campo para escribir nueva categoría
function manejarCambioCategoria() {
    const selectCat = document.getElementById("selectCategoria");
    const contenedorOtra = document.getElementById("contenedorOtraCategoria");
    const inputOtra = document.getElementById("inputOtraCategoria");

    if (selectCat.value === "OTRO") {
        contenedorOtra.style.display = "flex";
        inputOtra.required = true;
        inputOtra.focus();
    } else {
        contenedorOtra.style.display = "none";
        inputOtra.required = false;
        inputOtra.value = "";
    }
}

// 2. Cargar y Renderizar Productos
async function cargarProductos() {
    try {
        const res = await fetch(`${API_URL}/productos`);
        productosCache = await res.json();
        renderizarTabla(productosCache);
    } catch (err) {
        console.error("Error al cargar productos:", err);
    }
}

function renderizarTabla(productos) {
    const tbody = document.getElementById("tablaProductos");
    const mensajeVacio = document.getElementById("mensajeSinProductos");
    tbody.innerHTML = "";

    if (productos.length === 0) {
        mensajeVacio.style.display = "block";
        return;
    }

    mensajeVacio.style.display = "none";

    productos.forEach(prod => {
        const tr = document.createElement("tr");
        const estadoBadge = prod.stock > 0 
            ? `<span class="badge disponible">Disponible</span>`
            : `<span class="badge agotado">Agotado</span>`;

        tr.innerHTML = `
            <td>
                <strong>${prod.nombre}</strong><br>
                <small style="color: #6b7280; font-weight: 600;">📁 ${prod.categoria_nombre}</small>
            </td>
            <td>${prod.codigo || 'N/A'}</td>
            <td>$${parseFloat(prod.precio).toFixed(2)}</td>
            <td>${prod.stock} / 64</td>
            <td>${estadoBadge}</td>
            <td class="acciones-tabla">
                <button class="btn-accion" onclick="editarProducto(${prod.id})">Modificar</button>
                <button class="btn-accion eliminar" onclick="eliminarProducto(${prod.id})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarProductos() {
    const texto = document.getElementById("inputBuscarProducto").value.toLowerCase();
    const filtrados = productosCache.filter(p => 
        p.nombre.toLowerCase().includes(texto) ||
        (p.codigo && p.codigo.toLowerCase().includes(texto)) ||
        p.categoria_nombre.toLowerCase().includes(texto)
    );
    renderizarTabla(filtrados);
}

function abrirModalAgregar() {
    document.getElementById("formProducto").reset();
    document.getElementById("productoId").value = "";
    document.getElementById("tituloModal").textContent = "Añadir Nuevo Producto";
    manejarCambioCategoria();
    document.getElementById("modalProducto").classList.remove("modal-oculto");
    document.getElementById("modalProducto").classList.add("modal-activo");
}

function cerrarModal() {
    document.getElementById("modalProducto").classList.add("modal-oculto");
    document.getElementById("modalProducto").classList.remove("modal-activo");
}

// Confirmación antes de Modificar
function editarProducto(id) {
    const confirmacion = confirm("¿Estás seguro de que quieres modificar este producto?\n\n[SI = Aceptar]   [NO = Cancelar]");
    if (!confirmacion) return;

    const p = productosCache.find(item => item.id === id);
    if (!p) return;

    document.getElementById("productoId").value = p.id;
    document.getElementById("prodNombre").value = p.nombre;
    document.getElementById("prodCodigo").value = p.codigo || "";
    document.getElementById("prodPrecio").value = p.precio;
    document.getElementById("prodStock").value = p.stock;
    document.getElementById("selectCategoria").value = p.categoria_id || "";

    manejarCambioCategoria();

    document.getElementById("tituloModal").textContent = "Editar Producto";
    document.getElementById("modalProducto").classList.remove("modal-oculto");
    document.getElementById("modalProducto").classList.add("modal-activo");
}

// Guardar / Actualizar con validación de Stock Máximo (64)
async function guardarProductoSubmit(e) {
    e.preventDefault();

    const stockInput = parseInt(document.getElementById("prodStock").value);
    
    // Validación del límite de stock a 64
    if (stockInput > 64) {
        alert("El stock máximo permitido es de 64 unidades.");
        return;
    }

    const id = document.getElementById("productoId").value;
    let categoriaId = document.getElementById("selectCategoria").value;

    if (categoriaId === "OTRO") {
        const nuevaCatTexto = document.getElementById("inputOtraCategoria").value.trim();
        if (!nuevaCatTexto) {
            alert("Escriba el nombre de la nueva categoría.");
            return;
        }

        try {
            const resCat = await fetch(`${API_URL}/categorias`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: nuevaCatTexto })
            });

            const dataCat = await resCat.json();
            if (resCat.ok) {
                categoriaId = dataCat.id;
                await cargarCategorias();
            } else {
                alert("Error al guardar la categoría: " + dataCat.mensaje);
                return;
            }
        } catch (err) {
            console.error("Error al crear categoría:", err);
            return;
        }
    }

    const body = {
        nombre: document.getElementById("prodNombre").value,
        codigo: document.getElementById("prodCodigo").value,
        precio: parseFloat(document.getElementById("prodPrecio").value),
        stock: stockInput,
        categoria_id: categoriaId ? parseInt(categoriaId) : null
    };

    const url = id ? `${API_URL}/productos/${id}` : `${API_URL}/productos`;
    const method = id ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            cerrarModal();
            cargarProductos();
        } else {
            alert("Error al guardar el producto");
        }
    } catch (err) {
        console.error("Error al enviar producto:", err);
    }
}

// Confirmación antes de Eliminar
async function eliminarProducto(id) {
    const confirmacion = confirm("¿Estás seguro de que quieres eliminar este producto?\n\n[SI = Aceptar]   [NO = Cancelar]");
    if (!confirmacion) return;

    try {
        const res = await fetch(`${API_URL}/productos/${id}`, { method: "DELETE" });
        if (res.ok) {
            cargarProductos();
        } else {
            alert("Error al eliminar el producto");
        }
    } catch (err) {
        console.error("Error al eliminar:", err);
    }
}