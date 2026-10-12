import os
import sqlite3
from flask import Flask, jsonify, render_template, request

app = Flask(__name__, template_folder="templates", static_folder="static")
DB_NAME = "tienda_alexander.db"


def obtener_conexion():
  conn = sqlite3.connect(DB_NAME)
  conn.row_factory = sqlite3.Row
  return conn


def inicializar_bd():
  """Inicializa la base de datos usando el esquema oficial"""
  if not os.path.exists(DB_NAME):
    conn = obtener_conexion()
    with open("esquema.sql", "r", encoding="utf-8") as f:
      conn.executescript(f.read())
    conn.commit()
    conn.close()


# ================= RUTAS DE NAVEGACIÓN =================


@app.route("/")
def index():
  return render_template("inicio.html")


@app.route("/productos")
def productos():
  return render_template("almacen.html")


@app.route("/reportes")
def reportes():
  return render_template("reporte.html")


@app.route("/proveedores")
def proveedores():
  return render_template("proveedor.html")


@app.route("/copias")
def copias():
  return render_template("copia_seguridad.html")


# ================= ENDPOINTS DE LA API (STOCK Y PRODUCTOS) =================


@app.route("/api/productos", methods=["GET"])
def api_listar_productos():
  conn = obtener_conexion()
  cursor = conn.cursor()
  cursor.execute("""
        p.id, p.codigo_barra, p.nombre, c.nombre as categoria, p.precio, p.stock 
        FROM productos p 
        LEFT JOIN categorias c ON p.categoria_id = c.id
    """)
  filas = cursor.fetchall()
  conn.close()
  return jsonify([dict(fila) for fila in filas])


@app.route("/api/recargar_stock", methods=["POST"])
def api_recargar_stock():
  data = request.json
  producto_id = data.get("producto_id")
  cantidad = data.get("cantidad", 0)

  if not producto_id or cantidad <= 0:
    return (
        jsonify({"exito": False, "mensaje": "Datos incompletos o inválidos"}),
        400,
    )

  conn = obtener_conexion()
  cursor = conn.cursor()
  try:
    # Validar stock máximo permitido por regla de negocio (máximo 64 unidades según esquema)
    cursor.execute("SELECT stock FROM productos WHERE id = ?", (producto_id,))
    prod = cursor.fetchone()
    if not prod:
      return (
          jsonify({"exito": False, "mensaje": "Producto no encontrado"}),
          404,
      )

    nuevo_stock = prod["stock"] + int(cantidad)
    if nuevo_stock > 64:
      return (
          jsonify({
              "exito": False,
              "mensaje": "El stock supera el límite máximo permitido (64)",
          }),
          400,
      )

    cursor.execute(
        "UPDATE productos SET stock = ? WHERE id = ?", (nuevo_stock, producto_id)
    )
    conn.commit()
    return jsonify({
        "exito": True,
        "mensaje": "Stock recargado y sincronizado correctamente",
        "nuevo_stock": nuevo_stock,
    })
  except Exception as e:
    conn.rollback()
    return jsonify({"exito": False, "mensaje": str(e)}), 500
  finally:
    conn.close()


if __name__ == "__main__":
  inicializar_bd()
  app.run(debug=True, port=5000)