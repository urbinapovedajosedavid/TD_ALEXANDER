PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Usuarios
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

-- Categorías
CREATE TABLE IF NOT EXISTS categorias (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE COLLATE NOCASE
);

-- Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre       TEXT NOT NULL,
    telefono     TEXT NOT NULL DEFAULT '',
    cedula       TEXT NOT NULL DEFAULT '',
    direccion    TEXT NOT NULL DEFAULT '',
    departamento TEXT NOT NULL DEFAULT ''
);

-- Productos
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

-- Ventas
CREATE TABLE IF NOT EXISTS ventas (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id        INTEGER NOT NULL REFERENCES usuarios (id),
    fecha             DATETIME DEFAULT CURRENT_TIMESTAMP,
    subtotal          REAL NOT NULL DEFAULT 0.0 CHECK (subtotal >= 0),
    total             REAL NOT NULL DEFAULT 0.0 CHECK (total >= 0),
    metodo_pago       TEXT NOT NULL DEFAULT 'efectivo'
        CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
    efectivo_recibido REAL DEFAULT NULL,
    vuelto            REAL DEFAULT NULL,
    estado            TEXT NOT NULL DEFAULT 'COMPLETADA'
        CHECK (estado IN ('COMPLETADA', 'ANULADA'))
);

-- Detalle de ventas
CREATE TABLE IF NOT EXISTS detalle_ventas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id        INTEGER NOT NULL REFERENCES ventas (id) ON DELETE CASCADE,
    producto_id     INTEGER REFERENCES productos (id) ON DELETE SET NULL,
    nombre_producto TEXT NOT NULL DEFAULT '',
    cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
    subtotal        REAL GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- Sesiones
CREATE TABLE IF NOT EXISTS sesiones (
    token      TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    creado_en  DATETIME DEFAULT CURRENT_TIMESTAMP,
    expira_en  DATETIME NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ventas_fecha      ON ventas (fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_usuario    ON ventas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_ventas_estado     ON ventas (estado);
CREATE INDEX IF NOT EXISTS idx_detalle_venta     ON detalle_ventas (venta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_producto  ON detalle_ventas (producto_id);
CREATE INDEX IF NOT EXISTS idx_productos_cat     ON productos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_prov    ON productos (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario  ON sesiones (usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira   ON sesiones (expira_en);


-- Datos de prueba

-- Usuarios iniciales
INSERT INTO usuarios (id, nombre, apellido, telefono, usuario, password_hash, rol, activo, debe_cambiar_clave) VALUES
(1, 'Edgard', 'Castro Valverde', '88451230', 'admin', 'pbkdf2:sha256:600000$TiendaAlex$9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c', 'ADMIN', 1, 0),
(2, 'Braulio', 'Rodríguez', '87124590', 'braulio', 'pbkdf2:sha256:600000$TiendaAlex$1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d', 'VENDEDOR', 1, 0),
(3, 'José David', 'Urbina Poveda', '85609123', 'jose', 'pbkdf2:sha256:600000$TiendaAlex$5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c', 'VENDEDOR', 1, 0);

-- Categorías iniciales
INSERT INTO categorias (id, nombre) VALUES
(1, 'Celulares y Smartphones'),
(2, 'Accesorios para Celular'),
(3, 'Electrodomésticos de Cocina'),
(4, 'Ventilación y Hogar');

-- Proveedores iniciales
INSERT INTO proveedores (id, nombre, telefono, cedula, direccion, departamento) VALUES
(1, 'Distribuidora MovilNica S.A.', '22504120', '001-120488-0041A', 'Mercado Oriental, de donde fue el Novillo 2c. al sur', 'Managua'),
(2, 'ElectroHogar Mayorista', '22789012', '001-250885-0019B', 'Km 4.5 Carretera Norte, frente a ENABAS', 'Managua'),
(3, 'Importaciones Tecnológicas Masaya', '25223410', '401-150990-0008M', 'Parque Central 1c. al oeste', 'Masaya'),
(4, 'Comercial del Norte León', '23114580', '281-040282-0014L', 'Costado norte de la Terminal de Buses', 'León');

-- Productos iniciales (30 productos)
INSERT INTO productos (id, codigo_barra, nombre, categoria_id, proveedor_id, precio, costo_entrada, stock) VALUES
(1, '750100100101', 'Samsung Galaxy A15 128GB', 1, 1, 5850.00, 5100.00, 8),
(2, '750100100102', 'Xiaomi Redmi Note 13 256GB', 1, 1, 6900.00, 6050.00, 6),
(3, '750100100103', 'Samsung Galaxy A05 64GB', 1, 1, 3950.00, 3400.00, 10),
(4, '750100100104', 'Xiaomi Redmi 13C 128GB', 1, 1, 4450.00, 3850.00, 9),
(5, '750100100105', 'Honor X6a Plus 128GB', 1, 1, 4600.00, 3980.00, 5),
(6, '750100100106', 'Motorola Moto G24 128GB', 1, 1, 4800.00, 4150.00, 7),
(7, '750100100201', 'Vidrio Templado 9D (Glass Universal)', 2, 3, 120.00, 45.00, 45),
(8, '750100100202', 'Vidrio Templado Privacidad (Glass Anti-Espía)', 2, 3, 180.00, 75.00, 30),
(9, '750100100203', 'Cargador Rápido Tipo-C 25W', 2, 3, 380.00, 230.00, 25),
(10, '750100100204', 'Cable USB a Tipo-C Reforzado 1m', 2, 3, 150.00, 65.00, 40),
(11, '750100100205', 'Cable USB a Lightning para iPhone', 2, 3, 160.00, 70.00, 28),
(12, '750100100206', 'Audífonos Inalámbricos Bluetooth TWS', 2, 3, 480.00, 310.00, 4),
(13, '750100100207', 'Audífonos de Cable con Micrófono 3.5mm', 2, 3, 140.00, 60.00, 32),
(14, '750100100208', 'Cover de Silicona Antigolpes para Celular', 2, 3, 180.00, 80.00, 35),
(15, '750100100209', 'Memoria MicroSD Kingston 64GB Clase 10', 2, 3, 320.00, 210.00, 18),
(16, '750100100210', 'Power Bank Batería Portátil 10000mAh', 2, 3, 650.00, 460.00, 11),
(17, '750100100301', 'Licuadora Oster 2 Velocidades Vaso de Vidrio', 3, 2, 2250.00, 1780.00, 10),
(18, '750100100302', 'Licuadora Black+Decker 10 Velocidades Vaso Plástico', 3, 2, 1450.00, 1120.00, 12),
(19, '750100100303', 'Arrocera Black+Decker 1.8 Litros con Vaporera', 3, 2, 1350.00, 1020.00, 9),
(20, '750100100304', 'Cafetera Eléctrica Programable 12 Tazas', 3, 4, 1180.00, 890.00, 0),
(21, '750100100305', 'Sandwichera Eléctrica Antiadherente 2 Panes', 3, 2, 780.00, 560.00, 14),
(22, '750100100306', 'Tostadora de Pan 2 Ranuras 7 Niveles', 3, 2, 850.00, 620.00, 8),
(23, '750100100307', 'Cocina de Mesa a Gas 2 Quemadores', 3, 4, 1250.00, 940.00, 7),
(24, '750100100308', 'Horno Microondas 0.7 Pies Cúbicos 700W', 3, 2, 3450.00, 2850.00, 5),
(25, '750100100401', 'Abanico de Pedestal Samuelson 18 Pulgadas', 4, 4, 1550.00, 1200.00, 15),
(26, '750100100402', 'Abanico de Mesa 12 Pulgadas 3 Velocidades', 4, 4, 890.00, 650.00, 12),
(27, '750100100403', 'Abanico de Pared Oscilante 16 Pulgadas', 4, 4, 1280.00, 960.00, 10),
(28, '750100100404', 'Plancha a Vapor Antiadherente Black+Decker', 4, 2, 880.00, 640.00, 3),
(29, '750100100405', 'Regleta Protector de Voltaje 6 Tomas', 4, 4, 340.00, 210.00, 22),
(30, '750100100406', 'Bocina Portátil Bluetooth Recargable FM/USB', 4, 3, 750.00, 520.00, 14);

-- Ventas iniciales
INSERT INTO ventas (id, usuario_id, fecha, subtotal, total, metodo_pago, efectivo_recibido, vuelto, estado) VALUES
(1, 1, '2026-11-05 09:15:00', 6230.00, 6230.00, 'efectivo', 6500.00, 270.00, 'COMPLETADA'),
(2, 2, '2026-11-05 11:40:00', 3800.00, 3800.00, 'transferencia', NULL, NULL, 'COMPLETADA'),
(3, 3, '2026-11-05 14:22:00', 2700.00, 2700.00, 'tarjeta', NULL, NULL, 'COMPLETADA'),
(4, 2, '2026-11-05 15:10:00', 880.00, 880.00, 'efectivo', 1000.00, 120.00, 'ANULADA');

-- Detalle de ventas iniciales
INSERT INTO detalle_ventas (venta_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES
(1, 1, 'Samsung Galaxy A15 128GB', 1, 5850.00),
(1, 9, 'Cargador Rápido Tipo-C 25W', 1, 380.00),
(2, 17, 'Licuadora Oster 2 Velocidades Vaso de Vidrio', 1, 2250.00),
(2, 25, 'Abanico de Pedestal Samuelson 18 Pulgadas', 1, 1550.00),
(3, 19, 'Arrocera Black+Decker 1.8 Litros con Vaporera', 2, 1350.00),
(4, 28, 'Plancha a Vapor Antiadherente Black+Decker', 1, 880.00);
