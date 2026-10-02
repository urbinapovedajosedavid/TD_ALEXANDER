from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os

os.makedirs('database', exist_ok=True)
DB_PATH = 'database/tienda_alexander.db'

app = Flask(__name__)
CORS(app)

def conectar_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def inicializar_db():
    conn = conectar_db()
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # 1. Usuarios
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            usuario TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            rol TEXT CHECK(rol IN ('ADMIN', 'VENDEDOR')) DEFAULT 'VENDEDOR',
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    # 2. Clientes
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            telefono TEXT,
            email TEXT,
            direccion TEXT
        );
    """)

    # 3. Categorías
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        );
    """)
    
    # 4. Productos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_barra TEXT UNIQUE,
            nombre TEXT NOT NULL,
            categoria_id INTEGER,
            precio REAL NOT NULL CHECK(precio >= 0),
            stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
            FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
        );
    """)

    # 5. Ventas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER,
            usuario_id INTEGER NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            total REAL NOT NULL DEFAULT 0.0 CHECK(total >= 0),
            metodo_pago TEXT DEFAULT 'efectivo',
            FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        );
    """)

    # 6. Detalle de Ventas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS detalle_ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venta_id INTEGER NOT NULL,
            producto_id INTEGER NOT NULL,
            cantidad INTEGER NOT NULL CHECK(cantidad > 0),
            precio_unitario REAL NOT NULL CHECK(precio_unitario >= 0),
            subtotal REAL GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
            FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        );
    """)

    # Usuario por defecto si no existe
    cursor.execute("SELECT COUNT(*) FROM usuarios")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?, ?, ?, ?)",
            ('Administrador', 'admin', 'admin123', 'ADMIN')
        )

    conn.commit()
    conn.close()

inicializar_db()

# ----------------- ENDPOINTS PRODUCTOS Y CATEGORÍAS -----------------

@app.route('/api/categorias', methods=['GET'])
def obtener_categorias():
    try:
        conn = conectar_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM categorias ORDER BY id ASC")
        filas = cursor.fetchall()
        conn.close()
        return jsonify([{"id": f["id"], "nombre": f["nombre"]} for f in filas]), 200
    except Exception as e:
        return jsonify({"exito": False, "mensaje": str(e)}), 500

@app.route('/api/productos', methods=['GET'])
def obtener_productos():
    try:
        conn = conectar_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id, p.codigo_barra, p.nombre, p.precio, p.stock, p.categoria_id, c.nombre AS categoria_nombre 
            FROM productos p 
            LEFT JOIN categorias c ON p.categoria_id = c.id
        """)
        filas = cursor.fetchall()
        conn.close()

        productos = [
            {
                "id": f["id"],
                "codigo": f["codigo_barra"],
                "nombre": f["nombre"],
                "precio": f["precio"],
                "stock": f["stock"],
                "categoria_id": f["categoria_id"],
                "categoria_nombre": f["categoria_nombre"] or "Sin Categoría"
            } for f in filas
        ]
        return jsonify(productos), 200
    except Exception as e:
        return jsonify({"exito": False, "mensaje": str(e)}), 500

# ----------------- ENDPOINT PROCESAR VENTA -----------------

@app.route('/api/ventas', methods=['POST'])
def registrar_venta():
    """
    Procesa y registra una venta en la base de datos:
    - Valida existencia de productos y disponibilidad de stock.
    - Crea el registro maestro en 'ventas'.
    - Crea los detalles en 'detalle_ventas'.
    - Descuenta las unidades vendidas del 'stock' de cada producto.
    """
    datos = request.json
    usuario_id = datos.get('usuario_id', 1)  # ID por defecto (ej. Admin)
    cliente_id = datos.get('cliente_id')
    metodo_pago = datos.get('metodo_pago', 'efectivo')
    items = datos.get('items', [])

    if not items:
        return jsonify({"exito": False, "mensaje": "El carrito de ventas está vacío."}), 400

    conn = conectar_db()
    cursor = conn.cursor()

    try:
        # Iniciar transacción
        cursor.execute("BEGIN TRANSACTION;")

        total_venta = 0.0

        # 1. Verificar stock y calcular total
        for item in items:
            prod_id = item.get('id')
            cant_solicitada = int(item.get('cantidad', 0))

            if cant_solicitada <= 0:
                conn.rollback()
                conn.close()
                return jsonify({"exito": False, "mensaje": f"Cantidad inválida para el producto ID {prod_id}."}), 400

            cursor.execute("SELECT id, nombre, precio, stock FROM productos WHERE id = ?", (prod_id,))
            prod = cursor.fetchone()

            if not prod:
                conn.rollback()
                conn.close()
                return jsonify({"exito": False, "mensaje": f"El producto con ID {prod_id} no existe."}), 404

            if prod['stock'] < cant_solicitada:
                conn.rollback()
                conn.close()
                return jsonify({
                    "exito": False, 
                    "mensaje": f"Stock insuficiente para '{prod['nombre']}'. Disponible: {prod['stock']}"
                }), 400

            subtotal = prod['precio'] * cant_solicitada
            total_venta += subtotal

        # 2. Registrar encabezado de venta
        cursor.execute("""
            INSERT INTO ventas (cliente_id, usuario_id, total, metodo_pago)
            VALUES (?, ?, ?, ?)
        """, (cliente_id if cliente_id else None, usuario_id, total_venta, metodo_pago))

        venta_id = cursor.lastrowid

        # 3. Registrar los detalles y actualizar el stock
        for item in items:
            prod_id = item.get('id')
            cant = int(item.get('cantidad'))
            
            cursor.execute("SELECT precio FROM productos WHERE id = ?", (prod_id,))
            precio = cursor.fetchone()['precio']

            # Insertar en detalle_ventas
            cursor.execute("""
                INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario)
                VALUES (?, ?, ?, ?)
            """, (venta_id, prod_id, cant, precio))

            # Actualizar stock del producto
            cursor.execute("""
                UPDATE productos
                SET stock = stock - ?
                WHERE id = ?
            """, (cant, prod_id))

        # Confirmar transacción
        conn.commit()
        conn.close()

        return jsonify({
            "exito": True,
            "mensaje": "Venta realizada con éxito.",
            "venta_id": venta_id,
            "total": total_venta
        }), 201

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"exito": False, "mensaje": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)