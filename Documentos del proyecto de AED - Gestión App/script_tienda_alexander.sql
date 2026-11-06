PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

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


-- =====================================================================
-- DATOS DE PRUEBA PARA TIENDA ALEXANDER (MANAGUA, NICARAGUA)
-- =====================================================================

-- 1. Inserción de usuarios del sistema (1 Administrador y 2 Vendedores)
INSERT INTO usuarios (id, nombre, apellido, telefono, usuario, password_hash, rol, activo, debe_cambiar_clave) VALUES
(1, 'Edgard', 'Castro Valverde', '88451230', 'admin', 'pbkdf2:sha256:600000$TiendaAlex$9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c', 'ADMIN', 1, 0),
(2, 'Braulio', 'Rodríguez', '87124590', 'braulio', 'pbkdf2:sha256:600000$TiendaAlex$1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d', 'VENDEDOR', 1, 0),
(3, 'José David', 'Urbina Poveda', '85609123', 'jose', 'pbkdf2:sha256:600000$TiendaAlex$5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c', 'VENDEDOR', 1, 0);

-- 2. Inserción de categorías del catálogo
INSERT INTO categorias (id, nombre) VALUES
(1, 'Celulares y Smartphones'),
(2, 'Accesorios para Celular'),
(3, 'Electrodomésticos de Cocina'),
(4, 'Ventilación y Hogar');

-- 3. Inserción de proveedores comerciales
INSERT INTO proveedores (id, nombre, telefono, cedula, direccion, departamento) VALUES
(1, 'Distribuidora MovilNica S.A.', '22504120', '001-120488-0041A', 'Mercado Oriental, de donde fue el Novillo 2c. al sur', 'Managua'),
(2, 'ElectroHogar Mayorista', '22789012', '001-250885-0019B', 'Km 4.5 Carretera Norte, frente a ENABAS', 'Managua'),
(3, 'Importaciones Tecnológicas Masaya', '25223410', '401-150990-0008M', 'Parque Central 1c. al oeste', 'Masaya'),
(4, 'Comercial del Norte León', '23114580', '281-040282-0014L', 'Costado norte de la Terminal de Buses', 'León');

-- 4. Inserción de productos (Celulares, Accesorios y Electrodomésticos en C$)
INSERT INTO productos (id, codigo_barra, nombre, categoria_id, proveedor_id, precio, costo_entrada, stock) VALUES
(1, '750100100101', 'Samsung Galaxy A15 128GB', 1, 1, 6450.00, 5600.00, 12),
(2, '750100100102', 'Xiaomi Redmi Note 13 256GB', 1, 1, 7800.00, 6850.00, 8),
(3, '750100100103', 'Cargador Rápido Tipo-C 25W Original', 2, 3, 450.00, 280.00, 35),
(4, '750100100104', 'Audífonos Inalámbricos Bluetooth TWS', 2, 3, 620.00, 390.00, 4),
(5, '750100100105', 'Licuadora Oster 2 Velocidades Vaso Vidrio', 3, 2, 2450.00, 1950.00, 15),
(6, '750100100106', 'Arrocera Black+Decker 1.8 Litros', 3, 2, 1380.00, 1050.00, 10),
(7, '750100100107', 'Plancha a Vapor Antiadherente Oster', 4, 2, 920.00, 680.00, 3),
(8, '750100100108', 'Abanico de Pedestal Samuelson 18 Pulgadas', 4, 4, 1650.00, 1280.00, 18),
(9, '750100100109', 'Cafetera Eléctrica 12 Tazas Programable', 3, 4, 1250.00, 940.00, 0);

-- 5. Inserción de encabezados de ventas (facturas con IVA del 15%)
INSERT INTO ventas (id, usuario_id, fecha, subtotal, impuesto, total, metodo_pago, efectivo_recibido, vuelto, estado) VALUES
(1, 1, '2026-11-05 09:15:00', 6900.00, 1035.00, 7935.00, 'efectivo', 8000.00, 65.00, 'COMPLETADA'),
(2, 2, '2026-11-05 11:40:00', 4100.00, 615.00, 4715.00, 'transferencia', NULL, NULL, 'COMPLETADA'),
(3, 3, '2026-11-05 14:22:00', 2760.00, 414.00, 3174.00, 'tarjeta', NULL, NULL, 'COMPLETADA'),
(4, 2, '2026-11-05 15:10:00', 920.00, 138.00, 1058.00, 'efectivo', 1100.00, 42.00, 'ANULADA');

-- 6. Inserción del detalle de líneas por cada venta
INSERT INTO detalle_ventas (venta_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES
(1, 1, 'Samsung Galaxy A15 128GB', 1, 6450.00),
(1, 3, 'Cargador Rápido Tipo-C 25W Original', 1, 450.00),
(2, 5, 'Licuadora Oster 2 Velocidades Vaso Vidrio', 1, 2450.00),
(2, 8, 'Abanico de Pedestal Samuelson 18 Pulgadas', 1, 1650.00),
(3, 6, 'Arrocera Black+Decker 1.8 Litros', 2, 1380.00),
(4, 7, 'Plancha a Vapor Antiadherente Oster', 1, 920.00);
