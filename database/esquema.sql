PRAGMA foreign_keys = ON;

-- 1. Usuarios del sistema
CREATE TABLE IF NOT EXISTS usuarios (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre            TEXT NOT NULL,
    apellido          TEXT NOT NULL DEFAULT '',
    telefono          TEXT NOT NULL DEFAULT '',
    usuario           TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash     TEXT NOT NULL,
    rol               TEXT NOT NULL CHECK (rol IN ('ADMIN', 'VENDEDOR')) DEFAULT 'VENDEDOR',
    activo            INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
    intentos_fallidos INTEGER NOT NULL DEFAULT 0,
    bloqueado         INTEGER NOT NULL DEFAULT 0,
    tiempo_bloqueo    DATETIME DEFAULT NULL,
    nivel_bloqueo     INTEGER NOT NULL DEFAULT 0,
    creado_en         DATETIME DEFAULT CURRENT_TIMESTAMP,
    debe_cambiar_clave INTEGER NOT NULL DEFAULT 0 CHECK (debe_cambiar_clave IN (0, 1))
);

-- 2. Categorías de productos
CREATE TABLE IF NOT EXISTS categorias (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE COLLATE NOCASE
);

-- 3. Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre       TEXT NOT NULL,
    telefono     TEXT NOT NULL DEFAULT '',
    cedula       TEXT NOT NULL DEFAULT '',
    direccion    TEXT NOT NULL DEFAULT '',
    departamento TEXT NOT NULL DEFAULT ''
);

-- 4. Productos (inventario sin tope artificial de 64 unidades)
CREATE TABLE IF NOT EXISTS productos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_barra  TEXT UNIQUE,
    nombre        TEXT NOT NULL,
    categoria_id  INTEGER REFERENCES categorias (id) ON DELETE SET NULL,
    proveedor_id  INTEGER REFERENCES proveedores (id) ON DELETE SET NULL,
    precio        REAL NOT NULL CHECK (precio >= 0),
    costo_entrada REAL NOT NULL DEFAULT 0.0 CHECK (costo_entrada >= 0),
    stock         INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

-- 5. Encabezado de ventas (facturas)
CREATE TABLE IF NOT EXISTS ventas (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id        INTEGER NOT NULL REFERENCES usuarios (id),
    fecha             DATETIME DEFAULT CURRENT_TIMESTAMP,
    subtotal          REAL NOT NULL DEFAULT 0.0 CHECK (subtotal >= 0),
    impuesto          REAL NOT NULL DEFAULT 0.0 CHECK (impuesto >= 0),
    total             REAL NOT NULL DEFAULT 0.0 CHECK (total >= 0),
    metodo_pago       TEXT NOT NULL DEFAULT 'efectivo'
        CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
    efectivo_recibido REAL DEFAULT NULL,
    vuelto            REAL DEFAULT NULL,
    estado            TEXT NOT NULL DEFAULT 'COMPLETADA'
        CHECK (estado IN ('COMPLETADA', 'ANULADA'))
);

-- 6. Detalle de venta
CREATE TABLE IF NOT EXISTS detalle_ventas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id        INTEGER NOT NULL REFERENCES ventas (id) ON DELETE CASCADE,
    producto_id     INTEGER REFERENCES productos (id) ON DELETE SET NULL,
    nombre_producto TEXT NOT NULL DEFAULT '',
    cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
    subtotal        REAL GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- 7. Sesiones activas (tokens de autenticación respaldados en servidor)
CREATE TABLE IF NOT EXISTS sesiones (
    token      TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    creado_en  DATETIME DEFAULT CURRENT_TIMESTAMP,
    expira_en  DATETIME NOT NULL
);

-- Índices para consultas de reportes, inventario y sesiones
CREATE INDEX IF NOT EXISTS idx_ventas_fecha      ON ventas (fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_usuario    ON ventas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_ventas_estado     ON ventas (estado);
CREATE INDEX IF NOT EXISTS idx_detalle_venta     ON detalle_ventas (venta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_producto  ON detalle_ventas (producto_id);
CREATE INDEX IF NOT EXISTS idx_productos_cat     ON productos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_prov    ON productos (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario  ON sesiones (usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira   ON sesiones (expira_en);
