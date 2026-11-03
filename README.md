# Tienda Alexander — Sistema de Gestión y Ventas

Sistema de facturación, inventario y ventas desarrollado con **Flask** y **SQLite** en el backend, e interfaz web sin dependencias externas en el frontend.

## Características Principales

- **Autenticación Respaldada en Servidor:** Sesiones con cookies `HttpOnly` y `SameSite=Lax` verificadas en tiempo real contra la tabla `sesiones` de SQLite (revocación inmediata al cerrar sesión, cambiar contraseña, desactivar cuenta o restaurar copia de seguridad).
- **Clave Secreta Autogenerada:** Si no existe `SECRET_KEY` en `.env`, el sistema genera automáticamente una clave criptográfica aleatoria única de 256 bits en el primer arranque.
- **Protección contra Fuerza Bruta con Decaimiento:** Bloqueo escalonado automático (3 intentos fallidos $\rightarrow$ 1 minuto, $+2$ minutos adicionales por reincidencia inmediata, y decaimiento automático tras el período de enfriamiento) con cuenta regresiva en vivo.
- **Gestión de Usuarios para ADMIN:** Consulta perfiles, activa/desactiva y elimina cuentas sin ventas vinculadas. Crear cuentas requiere confirmar la contraseña actual del administrador. El restablecimiento exige la misma reautenticación, emite una clave temporal aleatoria que se muestra una sola vez y obliga al usuario a definir y confirmar su propia contraseña antes de acceder al sistema.
- **Lógica de Negocio Sólida:**
  - Inventario sin topes artificiales de stock y con registro de costo de entrada.
  - Recarga atómica de stock en el servidor con ajuste automático de margen mínimo ($+5\%$).
  - Facturación con persistencia de subtotal neto, IVA ($15\%$), total, efectivo recibido y vuelto.
  - Anulación de ventas con restitución automática de inventario.
  - Permisos diferenciados entre `ADMIN` y `VENDEDOR`.

---

## 🚀 Inicio Rápido con 1 Solo Clic

1. Haz doble clic en **`iniciar.bat`**.
2. El script verifica Python, instala las dependencias, inicializa y migra la base de datos `database/tienda_alexander.db`, genera la `SECRET_KEY` en `.env` si aún no existe, levanta el servidor local en `http://127.0.0.1:5000/` y abre el navegador automáticamente.

---

## 📦 Generar Ejecutable Independiente (.EXE)

Haz doble clic en **`compilar_exe.bat`**, el cual utiliza `TiendaAlexander.spec` para generar:
```
dist\TiendaAlexander\TiendaAlexander.exe
```
*(El ejecutable no incrusta archivos `.env` ni credenciales dentro del binario; genera su propia configuración en el directorio donde se ejecute).*

---

## 🔐 Configuración Inicial y contraseñas temporales

Puedes definir un archivo `.env` en la raíz del proyecto antes del primer arranque:

```env
ADMIN_NOMBRE=Administrador
ADMIN_USUARIO=admin
# Opcional: define una clave temporal propia antes del primer inicio.
# Si se omite, el sistema genera una clave aleatoria y la muestra una sola vez
# en la consola al crear la base de datos.
# SECRET_KEY se genera automáticamente en el primer inicio si se omite
```

En una instalación nueva, inicia sesión con el usuario `admin` (o el valor de `ADMIN_USUARIO`) y la clave temporal mostrada en la consola. El sistema exige cambiarla y confirmar la nueva clave antes de permitir el acceso al resto de la aplicación; el servidor también comprueba que ambas nuevas claves coincidan. Guarda la clave temporal antes de cerrar esa consola: no se almacena en texto legible ni se puede recuperar.

Al restablecer la clave de otra cuenta desde **Gestión de usuarios**, la clave temporal se genera en ese momento, aparece una sola vez en el cuadro de confirmación y debe entregarse al usuario por un canal seguro. No existe una clave temporal fija que pueda escribirse en este README. Al iniciar sesión con su usuario y clave temporal, la persona debe introducir la clave temporal, definir una contraseña nueva y repetirla para confirmarla; después podrá usar esa nueva contraseña normalmente y cambiarla cuando quiera desde **Ajustes**.

### Recuperación local de la cuenta ADMIN en Windows

Ejecuta `seguridad\olvidastes_tu_contrasena.bat`. Windows solicitará elevación como Administrador; no hay una contraseña maestra fija ni una clave de desarrollador guardada en el proyecto. El menú ofrece:

1. Generar una contraseña temporal aleatoria para una cuenta ADMIN seleccionada, limpiar el bloqueo y revocar sus sesiones. La clave aparece una sola vez en la consola; se exige cambiarla y confirmar la nueva al iniciar sesión.
2. Comprobar la integridad de SQLite y el estado general de las cuentas ADMIN.
3. Crear una copia consistente en `database\copias_seguridad\`.
4. Salir.

La elevación de Windows protege el acceso local al proceso de recuperación. Mantén protegida la cuenta de Windows y entrega las claves temporales únicamente por un canal seguro. No se muestran contraseñas temporales en la pantalla pública de login.

---

## 🧪 Pruebas Automatizadas (Aisladas en Base Temporal)

Las suites de pruebas se ejecutan sobre bases de datos temporales aisladas, sin modificar `database/tienda_alexander.db`:

```bash
python tests\test_api.py            # Registro, roles, inventario, recarga +5%, ventas, anulación y reportes
python tests\test_fuerza_bruta.py   # Bloqueo escalonado y decaimiento
python tests\test_sesion_cookie.py  # Sesiones HttpOnly y revocación en SQLite
```

---

## 📁 Estructura del Proyecto

```
TD_ALEXANDER/
├── app.py                      # Punto de entrada principal (Flask, API y Frontend)
├── iniciar.bat                 # Lanzador de 1 clic
├── compilar_exe.bat            # Empaquetador Windows (.exe) vía TiendaAlexander.spec
├── TiendaAlexander.spec        # Especificación de compilación PyInstaller
├── requirements.txt            # Dependencias del proyecto
├── backend/
│   ├── __init__.py
│   ├── config.py               # Configuración central, rutas, .env y SECRET_KEY autogenerada
│   ├── db.py                   # Conexión SQLite, inicialización y migraciones automáticas
│   ├── schemas.py              # Validación de esquemas de entrada
│   └── api/                    # Blueprint RESTful (/api)
│       ├── utils.py            # Utilidades compartidas y constantes financieras (IVA, redondeo)
│       ├── auth.py             # Autenticación, sesiones y registro
│       ├── usuarios.py         # Gestión, desbloqueo y activación/desactivación de usuarios
│       ├── productos.py        # Inventario, categorías y recarga atómica de stock
│       ├── ventas.py           # Punto de venta, emisión y anulación de facturas
│       ├── proveedores.py      # Creación, edición y baja de proveedores
│       ├── reportes.py         # KPIs financieros y reportes por vendedor sin consultas N+1
│       └── respaldos.py        # Descarga y restauración segura con migración automática
├── seguridad/                  # Capa de seguridad
│   ├── autenticacion.py        # Hashing PBKDF2-SHA256, sesiones y bloqueo escalonado
│   ├── decoradores.py          # @requiere_login y @requiere_rol
│   └── modelos.py              # Sembrado inicial de usuario administrador
├── database/
│   ├── esquema.sql             # Esquema DDL oficial de SQLite
│   └── tienda_alexander.db     # Base de datos persistente
├── frontend/                   # Interfaz de usuario (HTML, CSS, JS modular)
└── tests/                      # Suites de pruebas automatizadas aisladas
```
