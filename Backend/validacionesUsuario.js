// Este archivo valida el login y crea el usuario admin por defecto.
const LLAVE_USUARIOS = 'tiendaAlexanderUsuarios';

function leerUsuarios() {
    const datos = localStorage.getItem(LLAVE_USUARIOS);
    return datos ? JSON.parse(datos) : [];
}

function guardarUsuarios(usuarios) {
    localStorage.setItem(LLAVE_USUARIOS, JSON.stringify(usuarios));
}

function validarCredenciales(usuario, clave) {
    const usuarios = leerUsuarios();
    console.log("Usuarios cargados en localStorage:", usuarios); // Depuración
    
    return usuarios.some(function (item) {
        return item.usuario.toLowerCase() === usuario.toLowerCase() && item.clave === clave;
    });
}

function validarNuevoUsuario(usuario, clave) {
    const errores = [];
    if (!usuario || usuario.trim().length < 3) {
        errores.push('El usuario debe tener al menos 3 caracteres.');
    }
    if (!clave || clave.length < 4) {
        errores.push('La clave debe tener al menos 4 caracteres.');
    }
    return errores;
}

function registrarUsuario(usuario, clave, extra) {
    const errores = validarNuevoUsuario(usuario, clave);
    if (errores.length > 0) {
        return { ok: false, errores: errores };
    }
    const usuarios = leerUsuarios();
    const existe = usuarios.some(function (item) {
        return item.usuario.toLowerCase() === usuario.toLowerCase();
    });
    if (existe) {
        return { ok: false, errores: ['Ese usuario ya existe, ingrese otro usuario'] };
    }
    const perfil = {
        usuario: usuario.trim(),
        clave: clave,
        rol: 'usuario',
        nombre: extra && extra.nombre ? extra.nombre.trim() : '',
        apellidos: extra && extra.apellidos ? extra.apellidos.trim() : '',
        celular: extra && extra.celular ? extra.celular.trim() : '',
        direccion: extra && extra.direccion ? extra.direccion.trim() : '',
        avatar: extra && extra.avatar ? extra.avatar : ''
    };
    usuarios.push(perfil);
    guardarUsuarios(usuarios);
    return { ok: true };
}

function obtenerUsuarioPorNombre(usuario) {
    const usuarios = leerUsuarios();
    return usuarios.find(function (item) { return item.usuario.toLowerCase() === (usuario || '').toLowerCase(); });
}

function inicializarUsuariosBase() {
    const usuarios = leerUsuarios();
    if (usuarios.length === 0) {
        guardarUsuarios([{ usuario: 'admin', clave: 'admin', rol: 'admin' }]);
        console.log("Usuario admin por defecto creado.");
    }
}

// Inicializar al cargar el script
inicializarUsuariosBase();