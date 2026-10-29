# Tienda Alexander — Sistema de Gestión y Ventas Seguro

Sistema empresarial de facturación, inventario y ventas desarrollado con **Flask** y **SQLite** en el backend, e interfaz web moderna sin frameworks en el frontend.

Diseñado bajo estándares de alta seguridad:
- **Cero LocalStorage / Cero SessionStorage:** Ninguna credencial, contraseña ni token se almacena en el cliente.
- **Autenticación en Servidor:** Sesiones cifradas nativas de Flask con cookies `HttpOnly` y `SameSite`.
- **Protección contra Fuerza Bruta:** Bloqueo escalonado automático (3 intentos fallidos $\rightarrow$ 1 minuto, y $+2$ minutos adicionales por cada reincidencia) con cuenta regresiva en vivo.
- **Persistencia Total:** Base de datos SQLite independiente que se auto-reproduce en el primer arranque y persiste indefinidamente.

---

## 🚀 Inicio Rápido con 1 Solo Clic (Sin Compilar)

Si tienes Python instalado en tu computadora, puedes iniciar el sistema inmediatamente con **un solo clic**:

1. Haz doble clic en el archivo **`iniciar.bat`**.
2. El script:
   - Verifica Python e instala dependencias automáticamente.
   - Reproduce e inicializa la base de datos SQLite si aún no existe.
   - Crea el usuario Administrador por defecto.
   - Inicia el servidor Flask en `http://127.0.0.1:5000/`.
   - **Abre automáticamente tu navegador web** directamente en la pantalla de inicio de sesión.

---

## 📦 Generar Archivo Ejecutable (.EXE) de 1 Solo Clic

Para empaquetar todo el sistema (backend, frontend, base de datos y servidor) en un **ejecutable independiente de Windows (`.exe`)**:

### Método Automático (Recomendado)
Haz doble clic en el archivo **`compilar_exe.bat`**.

El script se encargará automáticamente de:
1. Instalar `pyinstaller` y las dependencias necesarias.
2. Empaquetar todo el código Python, el frontend estático (`Frontend/`), el esquema SQLite (`database/esquema.sql`) y las variables de entorno (`.env`).
3. Generar la carpeta distribuible lista para usar:
   ```
   dist\TiendaAlexander\TiendaAlexander.exe
   ```

### Método Manual con PyInstaller
Si prefieres compilar desde tu propia terminal de comandos (CMD o PowerShell):

```bash
# 1. Instalar PyInstaller
pip install pyinstaller -r requirements.txt

# 2. Compilar el proyecto
pyinstaller --noconfirm --clean ^
    --name "TiendaAlexander" ^
    --onedir ^
    --add-data "Frontend;Frontend" ^
    --add-data "database\esquema.sql;database" ^
    --add-data ".env;." ^
    --hidden-import "werkzeug" ^
    --hidden-import "werkzeug.security" ^
    --hidden-import "sqlite3" ^
    --hidden-import "flask_cors" ^
    app.py

# 3. Copiar configuración base a la carpeta compilada
copy .env dist\TiendaAlexander\.env
mkdir dist\TiendaAlexander\database
copy database\esquema.sql dist\TiendaAlexander\database\esquema.sql
```

---

## 🗄️ ¿Cómo se reproduce la Base de Datos Automáticamente?

El sistema cuenta con un mecanismo de **autocreación y persistencia inteligente**:

1. **Ubicación Persistente:**
   La base de datos se almacena en el archivo físico `database/tienda_alexander.db` junto al ejecutable o proyecto.
2. **Auto-inicialización:**
   Al ejecutarse `app.py` o `TiendaAlexander.exe`, la rutina `db.inicializar_db()`:
   - Comprueba si el archivo `.db` existe.
   - Si **no existe**, crea automáticamente la carpeta `database/`, lee `database/esquema.sql` y crea las 8 tablas oficiales (`usuarios`, `clientes`, `categorias`, `productos`, `ventas`, `detalle_ventas`, `proveedores`, `sesiones`).
   - Aplica migraciones para borrado en cascada y columnas de seguridad.
   - Siembra las categorías iniciales (*Electrodomésticos*, *Electrónica*, *Alimentos*).
   - Crea automáticamente el **usuario Administrador por defecto**.
3. **Persistencia Garantizada:**
   Si la base de datos **ya existe**, no se borra ni se sobrescribe: tus productos, ventas y usuarios se conservan intactos entre reinicios.

---

## 🔐 Credenciales Iniciales y Configuración (.env)

El archivo `.env` en la raíz contiene las credenciales iniciales para el primer arranque:

```env
ADMIN_NOMBRE=Administrador
ADMIN_USUARIO=admin
ADMIN_CLAVE=admin123
SECRET_KEY=clave-secreta-tienda-alexander-segura-2026
```

- **Usuario:** `admin`
- **Contraseña:** `admin123`

*(Puedes cambiar estos valores en el archivo `.env` antes de iniciar la aplicación por primera vez).*

---

## 🗜️ ¿Cómo comprimir y compartir la aplicación completa?

### Opción 1: Compartir el Ejecutable Compilado (.EXE)
1. Ejecuta `compilar_exe.bat`.
2. Dirígete a la carpeta `dist\`.
3. Haz clic derecho sobre la carpeta **`TiendaAlexander`** $\rightarrow$ **Enviar a** $\rightarrow$ **Carpeta comprimida (en zip)** (o usa WinRAR / 7-Zip).
4. El archivo `.zip` resultante contiene todo lo necesario: cualquier persona en otra computadora con Windows puede descomprimirlo y hacer doble clic en `TiendaAlexander.exe` sin necesidad de tener Python instalado.

### Opción 2: Compartir el Código Fuente Completo
Comprime toda la carpeta del proyecto `TD_ALEXANDER` excluyendo carpetas temporales (`.git`, `__pycache__`, `dist`, `build`). El destinatario solo requerirá hacer doble clic en `iniciar.bat`.

---

## 🛡️ Características de Seguridad Avanzada

### 1. Bloqueo Escalonado contra Fuerza Bruta
- **3 contraseñas incorrectas:** Bloqueo de 1 minuto.
- **Reincidencia tras desbloqueo:** $+2$ minutos adicionales por cada fallo sucesivo ($3\text{ min} \rightarrow 5\text{ min} \rightarrow 7\text{ min}\dots$).
- **Cuenta regresiva en vivo:** En la pantalla de login los segundos se descuentan automáticamente en tiempo real en la pantalla sin necesidad de presionar Enter.
- **Éxito:** Una contraseña correcta reinicia todos los contadores y niveles a cero.

### 2. Cookies Seguras HttpOnly
- La sesión se mantiene en el servidor en Flask (`session`).
- La cookie de sesión viaja con la bandera `HttpOnly`, lo que impide que cualquier script malicioso en el navegador acceda a ella.

---

## 🧪 Pruebas Automatizadas

El proyecto incluye suites completas de pruebas unitarias y de integración:

```bash
# Ejecutar todas las pruebas del sistema
python tests\test_api.py            # API REST completa, permisos, ventas y respaldos
python tests\test_fuerza_bruta.py   # Bloqueo escalonado e intentos fallidos
python tests\test_sesion_cookie.py  # Autenticación mediante cookies HttpOnly de servidor
```

---

## 📁 Estructura del Proyecto

```
TD_ALEXANDER/
├── app.py                      # Punto de entrada principal (Flask, API y Frontend)
├── iniciar.bat                 # Lanzador de 1 solo clic (con auto-apertura de navegador)
├── compilar_exe.bat            # Generador de ejecutable Windows (.exe)
├── requirements.txt            # Dependencias del proyecto
├── .env                        # Variables de entorno y credenciales seguras
├── api/                        # Módulos RESTful (/api)
│   ├── auth.py                 # Autenticación y sesiones
│   ├── usuarios.py             # Gestión de vendedores
│   ├── productos.py            # Inventario y recarga de stock
│   ├── ventas.py               # Cobro y emisión de facturas
│   ├── proveedores.py          # Gestión de proveedores
│   ├── reportes.py             # KPIs y estadísticas de ventas
│   └── respaldos.py            # Copias de seguridad de base de datos
├── seguridad/                  # Capa de seguridad
│   ├── autenticacion.py        # Hashing Werkzeug y algoritmo de fuerza bruta
│   ├── decoradores.py          # @requiere_login y @requiere_rol
│   └── modelos.py              # Sembrado de usuarios desde .env
├── database/
│   ├── esquema.sql             # Esquema DDL oficial de SQLite
│   └── tienda_alexander.db     # Archivo persistente de base de datos
├── Frontend/                   # Interfaz de usuario (HTML, CSS, JS)
│   ├── Login.html              # Pantalla de acceso con cuenta regresiva en vivo
│   ├── inicio.html             # Panel principal
│   ├── almacen.html            # Gestión de productos
│   ├── stock.html              # Alertas de stock crítico y recargas
│   ├── ventas.html             # Punto de venta y facturación
│   ├── reportes.html           # Reportes financieros
│   └── ...
└── tests/                      # Suites de pruebas automáticas
```
