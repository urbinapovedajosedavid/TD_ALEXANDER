//PROBANDO EL GIT
const formUsuarioModal = document.getElementById('formUsuarioModal');
const mensajeModal = document.getElementById('mensajeModal');

function mostrarMensaje(texto, tipo = 'info') {
    mensajeModal.textContent = texto;
    mensajeModal.className = `mensaje ${tipo}`.trim();
}

formUsuarioModal.addEventListener('submit', function (evento) {
    evento.preventDefault();
    const usuario = document.getElementById('usuarioModal').value.trim();
    const clave = document.getElementById('claveModal').value;

    if (!usuario || !clave) {
        mostrarMensaje('Completa los campos.', 'error');
        return;
    }

    const usuarios = JSON.parse(localStorage.getItem('tiendaAlexanderUsuarios') || '[]');
    const existe = usuarios.some((item) => item.usuario.toLowerCase() === usuario.toLowerCase());

    if (existe) {
        mostrarMensaje('Ese usuario ya existe.', 'error');
        return;
    }

    usuarios.push({ usuario, clave, rol: 'usuario' });
    localStorage.setItem('tiendaAlexanderUsuarios', JSON.stringify(usuarios));
    parent.postMessage({ type: 'usuario-agregado', usuario, clave }, '*');
    mostrarMensaje(`Usuario ${usuario} agregado.`, 'exito');
    formUsuarioModal.reset();
});
