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
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        );
    """)
    
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
    
    # Insertar categorías iniciales si no existen
    cursor.execute("SELECT COUNT(*) FROM categorias")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO categorias (nombre) VALUES (?)",
            [('Electrodomésticos',), ('Electrónica',)]
        )

    conn.commit()
    conn.close()

inicializar_db()

# ----------------- ENDPOINTS -----------------

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

@app.route('/api/categorias', methods=['POST'])
def guardar_categoria():
    datos = request.json
    nombre = datos.get('nombre')
    if not nombre:
        return jsonify({"exito": False, "mensaje": "El nombre es obligatorio"}), 400
    try:
        conn = conectar_db()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO categorias (nombre) VALUES (?)", (nombre,))
        id_nuevo = cursor.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"exito": True, "id": id_nuevo, "nombre": nombre}), 201
    except Exception as e:
        return jsonify({"exito": False, "mensaje": str(e)}), 500

@app.route('/api/productos/<int:id>', methods=['DELETE'])
def eliminar_producto(id):
    try:
        conn = conectar_db()
        cursor = conn.cursor()
        
        # Verificar si el producto existe antes de borrar
        cursor.execute("SELECT id FROM productos WHERE id = ?", (id,))
        producto = cursor.fetchone()
        
        if not producto:
            conn.close()
            return jsonify({"exito": False, "mensaje": "Producto no encontrado"}), 404

        # Eliminar producto
        cursor.execute("DELETE FROM productos WHERE id = ?", (id,))
        conn.commit()
        conn.close()
        
        return jsonify({"exito": True, "mensaje": "Producto eliminado correctamente"}), 200
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

@app.route('/api/productos', methods=['POST'])
def guardar_producto():
    datos = request.json
    nombre = datos.get('nombre')
    precio = datos.get('precio')
    stock = datos.get('stock')
    codigo = datos.get('codigo')
    categoria_id = datos.get('categoria_id')

    try:
        conn = conectar_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO productos (codigo_barra, nombre, precio, stock, categoria_id)
            VALUES (?, ?, ?, ?, ?)
        """, (codigo if codigo else None, nombre, float(precio), int(stock), categoria_id if categoria_id else None))
        conn.commit()
        conn.close()
        return jsonify({"exito": True, "mensaje": "Producto guardado"}), 201
    except Exception as e:
        return jsonify({"exito": False, "mensaje": str(e)}), 500
    
@app.route('/api/productos/<int:id>', methods=['PUT'])
def actualizar_producto(id):
    datos = request.json
    nombre = datos.get('nombre')
    codigo = datos.get('codigo')
    precio = datos.get('precio')
    stock = datos.get('stock')
    categoria_id = datos.get('categoria_id')

    # Límite en el Backend
    if stock is not None and int(stock) > 64:
        return jsonify({"exito": False, "mensaje": "El stock no puede superar las 64 unidades"}), 400

    try:
        conn = conectar_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE productos 
            SET codigo_barra = ?, nombre = ?, precio = ?, stock = ?, categoria_id = ?
            WHERE id = ?
        """, (codigo if codigo else None, nombre, float(precio), int(stock), categoria_id if categoria_id else None, id))
        
        conn.commit()
        conn.close()
        return jsonify({"exito": True, "mensaje": "Producto actualizado correctamente"}), 200
    except Exception as e:
        return jsonify({"exito": False, "mensaje": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)