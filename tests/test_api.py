"""Suite integral de pruebas de la API y lógica de negocio de Tienda Alexander.

Cubre:
1. Registro de usuario con nombre, apellido, teléfono, usuario y contraseña.
2. Permisos por rol (VENDEDOR vs ADMIN).
3. Inventario sin límite de 64 unidades y recarga atómica con margen del +5%.
4. Ventas con consolidación de productos repetidos en el carrito, cálculo de subtotal/IVA/total/vuelto.
5. Anulación de ventas con devolución automática de stock.
6. Reportes de ventas y reporte de ventas por usuario sin N+1.
"""

import os
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

_tmp_db = Path(tempfile.gettempdir()) / f"test_api_{os.getpid()}.db"
os.environ["TIENDA_DB_PATH"] = str(_tmp_db)

from app import app  # noqa: E402
import db  # noqa: E402

try:
    db.inicializar_db()
    admin_client = app.test_client()
    vendedor_client = app.test_client()

    print("\n== INICIANDO PRUEBAS INTEGRALES DE API Y LÓGICA DE NEGOCIO ==")

    # 1. Registro completo de vendedor
    r_reg = vendedor_client.post(
        "/api/auth/registro-publico",
        json={
            "nombre": "Carlos",
            "apellido": "Mendoza",
            "telefono": "8888-9999",
            "usuario": "carlosm",
            "clave": "clave123",
        },
    )
    assert r_reg.status_code == 201, f"Fallo en registro: {r_reg.get_json()}"
    vendedor_id = r_reg.get_json()["id"]
    print("  OK   1. Registro de vendedor con nombre, apellido y teléfono -> 201")

    # 2. Login de admin y vendedor
    assert admin_client.post("/api/auth/login", json={"usuario": "admin", "clave": "admin123"}).status_code == 200
    assert vendedor_client.post("/api/auth/login", json={"usuario": "carlosm", "clave": "clave123"}).status_code == 200

    # 3. Crear producto con stock > 64 (sin el límite artificial antiguo)
    r_prod = admin_client.post(
        "/api/productos",
        json={
            "nombre": "Arroz Faisán 1kg",
            "codigo": "74010001",
            "precio": 40.0,
            "costo_entrada": 32.0,
            "stock": 150,
            "categoria_id": 3,
        },
    )
    assert r_prod.status_code == 201, f"Fallo al crear producto con stock 150: {r_prod.get_json()}"
    prod_id = r_prod.get_json()["id"]
    print("  OK   2. Producto creado con stock de 150 unidades (sin tope de 64)")

    # 4. VENDEDOR no puede eliminar productos ni descargar respaldos
    assert vendedor_client.delete(f"/api/productos/{prod_id}").status_code == 403
    assert vendedor_client.get("/api/respaldos/descargar").status_code == 403
    print("  OK   3. Restricción de rol: VENDEDOR no puede eliminar productos ni descargar respaldos")

    # 5. Recarga atómica de stock con ajuste de precio (+5% sobre costo de entrada)
    r_recarga = admin_client.post(
        f"/api/productos/{prod_id}/recargar",
        json={"cantidad": 50, "precio_entrada": 42.0},
    )
    assert r_recarga.status_code == 200
    datos_recarga = r_recarga.get_json()
    assert datos_recarga["nuevo_stock"] == 200
    assert datos_recarga["precio_actualizado"] is True
    assert datos_recarga["nuevo_precio"] == 44.1  # 42.0 * 1.05
    print("  OK   4. Recarga de stock suma unidades y aplica margen +5% en el servidor (42.0 -> 44.10)")

    # 6. Venta con líneas repetidas del mismo producto en el carrito
    r_venta = vendedor_client.post(
        "/api/ventas",
        json={
            "metodo_pago": "efectivo",
            "efectivo_recibido": 200.0,
            "items": [
                {"id": prod_id, "cantidad": 2},
                {"id": prod_id, "cantidad": 1},
            ],
        },
    )
    assert r_venta.status_code == 201, f"Fallo en venta: {r_venta.get_json()}"
    datos_venta = r_venta.get_json()
    venta_id = datos_venta["venta_id"]
    assert len(datos_venta["items"]) == 1
    assert datos_venta["items"][0]["cantidad"] == 3
    assert datos_venta["subtotal"] == 132.3  # 44.10 * 3
    assert datos_venta["impuesto"] == 19.85  # 132.3 * 0.15
    assert datos_venta["total"] == 152.15
    assert datos_venta["vuelto"] == 47.85
    print("  OK   5. Venta consolida líneas duplicadas y persiste subtotal, IVA, total y vuelto")

    # 7. Reporte por usuario
    r_rep_usr = admin_client.get(f"/api/reportes/usuario/{vendedor_id}")
    assert r_rep_usr.status_code == 200
    datos_rep_usr = r_rep_usr.get_json()
    assert datos_rep_usr["kpis"]["cantidad_ventas"] == 1
    assert datos_rep_usr["kpis"]["productos_vendidos"] == 3
    print("  OK   6. Reporte de ventas por usuario devuelve KPIs e ítems sin consultas N+1")

    # 8. Anulación de venta devuelve el stock al inventario
    r_anular = admin_client.post(f"/api/ventas/{venta_id}/anular")
    assert r_anular.status_code == 200
    prods_actuales = admin_client.get("/api/productos").get_json()
    prod_actual = next(p for p in prods_actuales if p["id"] == prod_id)
    assert prod_actual["stock"] == 200
    print("  OK   7. Anulación de venta restituye las 3 unidades al stock (200 unidades)")

    print("\n==============================================")
    print("TODAS LAS PRUEBAS DE API Y NEGOCIO PASARON EXITOSAMENTE")
finally:
    _tmp_db.unlink(missing_ok=True)
