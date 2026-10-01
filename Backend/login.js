const formLogin = document.getElementById('formLogin');
const usuarioLogin = document.getElementById('usuarioLogin');
const claveLogin = document.getElementById('claveLogin');
const mensajeLogin = document.getElementById('mensajeLogin');
const btnIrRegistro = document.getElementById('btnIrRegistro');

function mostrarMensaje(texto) {
    if (mensajeLogin) {
        mensajeLogin.textContent = texto;
        mensajeLogin.style.color = 'red';
    }
}

// Redireccionar a la pantalla de registro si se presiona el botón crear cuenta
if (btnIrRegistro) {
    btnIrRegistro.addEventListener('click', function () {
        window.location.href = 'agregar_usuario.html'; 
    });
}

// Manejo del formulario de Login
if (formLogin) {
    formLogin.addEventListener('submit', function (evento) {
        evento.preventDefault();
        
        const usuario = usuarioLogin.value.trim();
        const clave = claveLogin.value;

        // Valida utilizando la función de validacionesUsuario.js
        if (validarCredenciales(usuario, clave)) {
            const datosUsuario = obtenerUsuarioPorNombre(usuario) || { usuario, rol: 'usuario' };
            
            // Guarda la sesión en el navegador
            sessionStorage.setItem('usuarioSesion', JSON.stringify(datosUsuario));
            localStorage.setItem('sesionActiva', 'true');
            localStorage.setItem('usuarioActual', usuario);

            // Redirección exitosa al panel principal
            window.location.href = 'inicio.html';
        } else {
            mostrarMensaje('Usuario o contraseña incorrectos.');
        }
    });
}