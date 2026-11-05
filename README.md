# Tienda Alexander — Sistema de Gestión y Ventas

Sistema web de facturación, inventario y ventas desarrollado con **Python (Flask)** y **SQLite** en el backend, y **HTML, CSS y JavaScript** en el frontend.

## Características Principales

- **Autenticación y Sesiones:** Inicio de sesión respaldado en SQLite con cookies `HttpOnly` y control de roles (`ADMIN` y `VENDEDOR`).
- **Gestión de Usuarios (`ADMIN`):** Creación, activación/desactivación, desbloqueo y restablecimiento de contraseñas.
- **Inventario y Stock:** Gestión de productos, categorías, proveedores y recarga de stock con cálculo de margen.
- **Facturación y Ventas:** Punto de venta con cálculo de subtotal, IVA (15%), total, vuelto y anulación de facturas con devolución de stock.
- **Reportes y Copias de Seguridad:** Consulta de ventas por rango de fechas/vendedor y descarga/restauración de respaldos de la base de datos.

---

## Inicio Rápido

1. Ejecuta **`iniciar.bat`** (o corre `python app.py` en la terminal).
2. El sistema verifica las dependencias (`Flask`, `Flask-Cors`), inicializa la base de datos `database/tienda_alexander.db` en modo WAL y abre el navegador en `http://127.0.0.1:5000/`.

---

## Estructura del Proyecto

```
TD_ALEXANDER/
├── app.py                      # Servidor principal Flask (API y rutas del Frontend)
├── iniciar.bat                 # Script de inicio en Windows
├── requirements.txt            # Dependencias de Python
├── backend/
│   ├── config.py               # Configuración general y variables de entorno
│   ├── db.py                   # Conexión SQLite (modo WAL) e inicialización
│   ├── schemas.py              # Validación de datos de entrada
│   └── api/                    # Rutas de la API REST (/api)
│       ├── auth.py             # Login, logout y sesión actual
│       ├── usuarios.py         # Gestión de usuarios
│       ├── productos.py        # Productos, categorías y recarga de stock
│       ├── ventas.py           # Registro y anulación de ventas
│       ├── proveedores.py      # Gestión de proveedores
│       ├── reportes.py         # Reportes e indicadores de ventas
│       ├── respaldos.py        # Descarga y restauración de la base de datos
│       └── utils.py            # Funciones auxiliares de la API
├── seguridad/                  # Autenticación, hash de contraseñas y decoradores de rol
├── database/
│   └── esquema.sql             # Esquema SQL de las tablas e índices
└── Frontend/                   # Interfaz web (HTML, CSS y JS)
```
