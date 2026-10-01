
const LLAVE_PROVEEDORES = "proveedores_sistema";

document.addEventListener("DOMContentLoaded", function () {
    inicializarProveedoresBase();
    renderProveedores();

    const formProveedor = document.getElementById("formProveedor");
    if (formProveedor) {
        formProveedor.addEventListener("submit", guardarProveedor);
    }
});

function leerProveedores() {
    const datos = localStorage.getItem(LLAVE_PROVEEDORES);
    return datos ? JSON.parse(datos) : [];
}

function guardarProveedores(proveedores) {
    localStorage.setItem(LLAVE_PROVEEDORES, JSON.stringify(proveedores));
}

function inicializarProveedoresBase() {
    const proveedores = leerProveedores();
    if (!Array.isArray(proveedores) || proveedores.length === 0) {
        const datosSemilla = [
            {
                id: "prov-1",
                nombre: "Distribuidora Alexander S.A.",
                contacto: "Juan Pérez",
                telefono: "8888-8888",
                correo: "ventas@alexander.com"
            }
        ];
        guardarProveedores(datosSemilla);
    }
}

function renderProveedores() {
    const tablaProveedores = document.getElementById("tablaProveedores");
    if (!tablaProveedores) return;

    const proveedores = leerProveedores();
    tablaProveedores.innerHTML = "";

    if (proveedores.length === 0) {
        tablaProveedores.innerHTML = `<tr><td colspan="5" style="text-align: center;">No hay proveedores registrados.</td></tr>`;
        return;
    }

    proveedores.forEach((prov) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td><strong>${prov.nombre}</strong></td>
            <td>${prov.contacto}</td>
            <td>${prov.telefono}</td>
            <td>${prov.correo}</td>
            <td class="acciones-tabla">
                <button type="button" class="boton boton-secundario" onclick="eliminarProveedor('${prov.id}')">Eliminar</button>
            </td>
        `;
        tablaProveedores.appendChild(fila);
    });
}

function guardarProveedor(evento) {
    evento.preventDefault();
    const nombre = document.getElementById("nombreProveedor")?.value.trim();
    const contacto = document.getElementById("contactoProveedor")?.value.trim();
    const telefono = document.getElementById("telefonoProveedor")?.value.trim();
    const correo = document.getElementById("correoProveedor")?.value.trim();

    if (!nombre) {
        alert("El nombre del proveedor es obligatorio.");
        return;
    }

    const proveedores = leerProveedores();
    const nuevoProveedor = {
        id: `prov-${Date.now()}`,
        nombre,
        contacto: contacto || "N/A",
        telefono: telefono || "N/A",
        correo: correo || "N/A"
    };

    proveedores.push(nuevoProveedor);
    guardarProveedores(proveedores);
    renderProveedores();
    evento.target.reset();
}

function eliminarProveedor(id) {
    const proveedores = leerProveedores();
    const filtrados = proveedores.filter((item) => item.id !== id);
    guardarProveedores(filtrados);
    renderProveedores();
}