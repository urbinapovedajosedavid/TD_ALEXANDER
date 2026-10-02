-- ==========================================
-- Tienda Alexander - Esquema único de la BD
-- ==========================================
-- Este archivo es la ÚNICA fuente de verdad del DDL.
-- Backend/db.py lo ejecuta al arrancar el servidor; no se repite
-- ningún CREATE TABLE dentro del código Python.
-- Todas las tablas usan CREATE TABLE IF NOT EXISTS, por lo que
-- ejecutarlo varias veces es seguro.

PRAGMA foreign_keys = ON;

-- 1. Usuarios del sistema
CREATE TABLE IF NOT EXISTS usuarios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre        TEXT NOT NULL,
    usuario       TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol           TEXT NOT NULL CHECK (rol IN ('ADMIN', 'VENDEDOR')) DEFAULT 'VENDEDOR',
    creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre   TEXT NOT NULL,
    telefono TEXT,
    email    TEXT,
    direccion TEXT
);

-- 3. Categorías de productos
CREATE TABLE IF NOT EXISTS categorias (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE
);

-- 4. Productos (inventario)
CREATE TABLE IF NOT EXISTS productos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_barra TEXT UNIQUE,
    nombre       TEXT NOT NULL,
    categoria_id INTEGER REFERENCES categorias (id) ON DELETE SET NULL,
    precio       REAL NOT NULL CHECK (precio >= 0),
    stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0 AND stock <= 64)
);

-- 5. Encabezado de ventas (facturas)
CREATE TABLE IF NOT EXISTS ventas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id   INTEGER REFERENCES clientes (id) ON DELETE SET NULL,
    usuario_id   INTEGER NOT NULL REFERENCES usuarios (id),
    fecha        DATETIME DEFAULT CURRENT_TIMESTAMP,
    total        REAL NOT NULL DEFAULT 0.0 CHECK (total >= 0),
    metodo_pago  TEXT NOT NULL DEFAULT 'efectivo'
        CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia'))
);

-- 6. Detalle de venta (relación N:M entre ventas y productos)
--
-- producto_id queda como referencia floja (ON DELETE SET NULL) a propósito:
-- un producto que ya se vendió se puede eliminar del inventario y la venta
-- antigua tiene que seguir mostrando lo que se cobró, no una línea vacía.
--
-- Por eso el nombre va copiado aquí. El precio_unitario ya era una foto del
-- momento de la venta, y el nombre va por el mismo camino: si el producto
-- se renombra o se borra, la factura vieja no cambia. Es la misma razón por
-- la que ventas.cliente_id usa SET NULL.
CREATE TABLE IF NOT EXISTS detalle_ventas (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id         INTEGER NOT NULL REFERENCES ventas (id) ON DELETE CASCADE,
    producto_id      INTEGER REFERENCES productos (id) ON DELETE SET NULL,
    nombre_producto  TEXT NOT NULL DEFAULT '',
    cantidad         INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario  REAL NOT NULL CHECK (precio_unitario >= 0),
    subtotal         REAL GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- 7. Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT NOT NULL,
    telefono        TEXT,
    cedula          TEXT,
    direccion       TEXT,
    departamento    TEXT
);

-- 8. Sesiones activas (tokens de autenticación)
-- Un token por sesión iniciada desde el navegador. Guardar el token en la
-- BD (en vez de solo firmarlo) permite revocarlo: cerrar sesión o cambiar
-- la contraseña invalidan de inmediato todo lo que estaba abierto.
CREATE TABLE IF NOT EXISTS sesiones (
    token      TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    creado_en  DATETIME DEFAULT CURRENT_TIMESTAMP,
    expira_en  DATETIME NOT NULL
);

-- Índices para las consultas de reportes y del historial de ventas
CREATE INDEX IF NOT EXISTS idx_ventas_fecha      ON ventas (fecha);
CREATE INDEX IF NOT EXISTS idx_detalle_venta     ON detalle_ventas (venta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_producto  ON detalle_ventas (producto_id);
CREATE INDEX IF NOT EXISTS idx_productos_cat     ON productos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario  ON sesiones (usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira   ON sesiones (expira_en);
