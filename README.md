# Tienda Alexander

Sistema de gestión de ventas e inventario: Flask + SQLite en el backend,
HTML/CSS/JS sin framework en el frontend.

## Puesta en marcha

```bash
pip install -r requirements.txt
python Backend/server.py
```

El servidor escucha en `http://127.0.0.1:5000` y crea
`database/tienda_alexander.db` a partir de `database/esquema.sql` en el
primer arranque, junto con el usuario administrador y las categorías
iniciales.

Para usar la interfaz, abre `Frontend/index.html` en el navegador. Se
redirige al login. Credenciales iniciales: **admin / admin123**

> El frontend son archivos estáticos: puedes abrirlos con doble clic.
> No hace falta servir la carpeta con otro servidor.

## Modo demostración (sin servidor)

Si abres el sistema sin que Flask esté corriendo, no se queda esperando:
tras 1,5 segundos el frontend detecta que la API no responde y entra solo
en **modo demostración**. No hay aviso en pantalla: el sistema se comporta
igual y los datos quedan en el navegador.

| | Con servidor | Modo demostración |
|---|---|---|
| Entrar con | admin / admin123 | **admin / admin** |
| Dónde viven los datos | SQLite, en el servidor | `localStorage` del navegador |
| Contraseñas | PBKDF2 con sal | texto simple, solo en el equipo |

En la demo puedes registrar ventas, crear y editar productos, agregar
proveedores, ver reportes e inventarios, cambiar tu contraseña y crear
usuarios: todo funciona igual, pero contra los datos locales.

Tres cosas para tener claras:

- **Solo pasa a la demo si la API no contesta.** Si el servidor responde
  un `401` o un `403`, se respeta esa respuesta y no se entra en
  demostración. Nadie se salta la seguridad de una instalación real.
- **Los datos de la demo no son los del negocio.** No se mezclan ni se
  sincronizan con la base de datos.
- **Para volver a los datos reales** cierra la sesión y entra de nuevo con
  `admin / admin123` teniendo Flask corriendo. Si enciendes el servidor con
  una sesión de demo abierta, esa sesión se rechaza y vuelves al login.

### Crear cuentas sin servidor

El botón **Crear usuario** del login abre una pantalla que **no pide sesión
abierta**, porque es justamente donde se crea la cuenta: pedir que ya hayas
entrado convertía el alta en un callejón sin salida y el botón te rebotaba al
propio login.

Para que esa pantalla sirva sin conexión hay un almacén propio,
`App.cuentas`, que guarda las cuentas en el `localStorage` del navegador
bajo `tiendaAlexanderCuentasLocales`. La cuenta creada sirve para entrar en
el acto, haya servidor o no:

| | Con servidor | Sin servidor |
|---|---|---|
| Se crea en | la base de datos **y** el navegador | solo el navegador |
| Se puede entrar con ella | sí | sí |
| La ve el admin `admin123` | sí, siempre | — |

Al entrar, si la cuenta es de este navegador la sesión queda marcada como
**local**: el token `"local"` no existe para ningún servidor, así que las
peticiones se responden con la demo en vez de mandar un token inventado que
traería un `401` a mitad de sesión. Si quien crea la cuenta es un
administrador con sesión real, además se da de alta en el servidor y así el
despliegue normal no se rompe.

> La contraseña se guarda en claro en ese `localStorage`, igual que las
> cuentas de ejemplo de la demo. Es una medida para poder presentar sin base
> de datos, **no** un almacén de claves: en un despliegue real el alta va por
> `/auth/registro` y la contraseña nunca sale del servidor (PBKDF2 con sal).
> Para borrarlas: `App.cuentas.borrarTodas()` desde la consola.

Para empezar de cero con los datos de ejemplo,
`Frontend/js/demo.js` expone `App.demo.reiniciar()` desde la consola del
navegador. También puedes borrar el sitio desde las herramientas del
navegador.

## Estructura

```
Backend/
  server.py        Servidor Flask: todas las rutas de la API
  db.py            Conexión, arranque del esquema, sesiones y contraseñas
database/
  esquema.sql      Única fuente del esquema (DDL)
tests/
  test_api.py      160 comprobaciones contra la API real
  test_demo.js     77 comprobaciones contra la demo aislada
  test_modo_demo.js 30 comprobaciones del arranque sin servidor
  test_factura.js  52 comprobaciones de la factura imprimible
test_registro.js  28 comprobaciones del alta de cuentas sin servidor
auditar_paginas.js  Botones muertos, métodos inexistentes, ids y scripts
auditar_css.js      Clases que faltan y reglas que no usa nadie
Frontend/
  *.html           Una página por módulo
  css/base.css     Tokens, layout y componentes comunes
  css/*.css        Solo lo específico de cada página
  js/core.js       api, auth, fmt, ui y la factura (lo que usa toda página)
  js/demo.js       API simulada en localStorage, solo si el servidor no responde
  js/layout.js     Sidebar y cabecera comunes
  js/pages/        Un script por página
```

El código compartido vive en `Frontend/js/core.js` y
`Frontend/js/layout.js`. El sidebar y la cabecera se generan una sola vez;
las páginas solo ponen `<aside id="sidebar">` y `<header id="barraSuperior">`.

## Sesiones y permisos

El login devuelve un token opaco que el cliente manda en cada petición como
`Authorization: Bearer <token>`. El servidor lo valida contra la tabla
`sesiones`, que dura 8 horas. **Todos los endpoints exigen sesión salvo
`/api/auth/login`.**

- `POST /api/auth/registro` y `GET /api/usuarios` exigen rol `ADMIN`.
- El usuario de una venta sale de la sesión, no del cuerpo de la petición.
- Cerrar sesión revoca el token en el servidor: deja de servir aunque
  alguien lo hubiera copiado.
- Cambiar la contraseña revoca las demás sesiones abiertas de esa cuenta.

Contraseñas con PBKDF2-SHA256 y sal por usuario; en el navegador solo se
guarda el token y quién está conectado, en `sessionStorage`.

## API

| Método  | Ruta                      | Acceso  | Descripción                        |
| ------- | ------------------------- | ------- | ---------------------------------- |
| POST    | `/api/auth/login`         | público | Iniciar sesión                     |
| GET     | `/api/auth/yo`            | sesión  | Usuario de la sesión actual        |
| POST    | `/api/auth/logout`        | sesión  | Revocar el token                   |
| POST    | `/api/auth/cambiar-clave` | sesión  | Cambiar la contraseña propia       |
| DELETE  | `/api/auth/cuenta`        | sesión  | Eliminar la cuenta propia          |
| POST    | `/api/auth/registro`      | admin   | Crear usuario vendedor             |
| GET     | `/api/usuarios`           | admin   | Listar usuarios                    |
| GET     | `/api/categorias`         | sesión  | Listar categorías                  |
| POST    | `/api/categorias`         | sesión  | Crear categoría                    |
| GET     | `/api/productos`          | sesión  | Listar productos                   |
| POST    | `/api/productos`          | sesión  | Crear producto                     |
| PUT     | `/api/productos/<id>`     | sesión  | Actualizar producto                |
| DELETE  | `/api/productos/<id>`     | sesión  | Eliminar producto                  |
| POST    | `/api/ventas`             | sesión  | Registrar venta y descontar stock  |
| GET     | `/api/ventas/<id>`        | sesión  | Una venta con su detalle, para la factura |
| GET     | `/api/proveedores`        | sesión  | Listar proveedores                 |
| POST    | `/api/proveedores`        | sesión  | Crear proveedor                    |
| DELETE  | `/api/proveedores/<id>`   | sesión  | Eliminar proveedor                 |
| GET     | `/api/reportes?periodo=`   | sesión  | KPIs y ventas de hoy/semana/mes    |
| GET     | `/api/inventario/resumen` | sesión  | Totales del inventario             |
| GET     | `/api/respaldos/info`     | admin   | Fecha y tamaño de la base          |
| GET     | `/api/respaldos/descargar` | admin  | Descargar copia `.db`              |
| POST    | `/api/respaldos/restaurar` | admin  | Restaurar una copia `.db`          |

Los errores siempre devuelven `{"exito": false, "mensaje": "..."}`.

## Pruebas

```bash
python tests\test_api.py      # API real
node tests\test_demo.js       # lógica de la demo
node tests\test_modo_demo.js  # arranque sin servidor
node tests\test_factura.js    # factura imprimible
node tests\test_registro.js   # alta de cuentas sin servidor
node tests\auditar_paginas.js # botones muertos, métodos inexistentes, ids, scripts
node tests\auditar_css.js     # clases que faltan y CSS que sobra
```

`test_api.py` arranca desde una base limpia y comprueba el esquema, que los
22 endpoints responden 401 sin token, los permisos por rol, el ciclo de vida
del token, el cambio y borrado de contraseña, los 409 por duplicados, la
compra, los reportes, los respaldos y la migración de una base vieja.
**160 comprobaciones.**

Los otros cuatro corren el JavaScript en un entorno simulado, sin navegador y
sin servidor. `test_demo.js` y `test_modo_demo.js` cubren el arranque en modo
demostración y, sobre todo, que **un 401 o un 403 del servidor real nunca se
conviertan en una sesión de demostración**. **77 + 30 comprobaciones.**
`test_factura.js` revisa la factura como documento: que tenga tabla de
verdad, que los números cuadren y que escape los nombres de producto.
**52 comprobaciones.** `test_registro.js` recorre el alta completa: crear una
cuenta sin sesión, entrar con ella, y comprobar que funciona igual con el
servidor apagado y con el servidor encendido rechazando el login.
**28 comprobaciones.**

Las dos auditorías revisan lo que no se nota al probar a mano: que cada botón
tenga un evento, que no se repitan ids, que ninguna clase usada se haya
quedado sin estilo y que ninguna página llame a un método de `App` que no
existe.

Lo último nació de un botón "Eliminar" del inventario que no hacía nada: el
HTML estaba bien, el botón tenía su listener, y aun así no pasaba nada, porque
la página llamaba a `App.ui.confirmir()` en vez de `App.ui.confirmar()`. Al no
existir el método, la línea lanzaba `TypeError` y el clic moría en silencio.
Las pruebas de la API no lo veían porque miran el servidor, no el DOM, así que
la auditoría ahora compara cada llamada `App.<módulo>.<método>()` con lo que
ese módulo exporta de verdad.

Esa forma de fallo es la peligrosa: no da error visible en la consola si nadie
la mira, y el botón queda muerto para siempre. Un nombre mal escrito se parece
mucho a uno bien escrito, y a simple vista el código parece correcto.

## Reglas del negocio

- El stock va de 0 a 64 unidades. La base de datos tiene un `CHECK` y la
  API lo vuelve a validar para poder devolver un mensaje claro.
- Las ventas se registran en una transacción: o se descuenta el stock de
  todos los productos y se guarda la factura, o no se toca nada.
- La factura guarda el precio que se cobró en ese momento, no el de hoy: si
  después sube el precio de un producto, las facturas viejas siguen diciendo
  lo que el cliente pagó. Por eso el detalle se arma con lo que lee el
  servidor y no con lo que manda el navegador.
- La factura es lo único que sale en papel. Va en blanco y negro, con tabla
  de verdad y sin adornos: `App.factura` en `Frontend/js/core.js`.
- Una copia de seguridad se valida antes de restaurar: tiene que ser una base
  SQLite con el esquema del sistema y al menos un administrador. Si algo
  falla, se conserva la base anterior. Al restaurar se invalidan todas las
  sesiones, así que hay que volver a entrar.
- Un producto se elimina aunque ya se haya vendido. La línea de venta guarda
  una copia del nombre y del precio del momento, y `producto_id` queda en
  `NULL` (`ON DELETE SET NULL`), así que borrar el producto del inventario no
  toca las facturas antiguas: siguen diciendo lo que se cobró. Es la misma
  razón por la que `ventas.cliente_id` usa `SET NULL`.
- Una cuenta con ventas registradas sí que no se puede eliminar, y el sistema
  no permite quedarse sin ningún administrador. Ahí el borrado rompería datos
  que no están duplicados en ningún sitio más.
- El IVA es 15 % y se calcula con `ROUND_HALF_UP` para no descuadrar
  centavos.
- Las fechas se guardan siempre en hora local escritas por el servidor.
  `CURRENT_TIMESTAMP` de SQLite devuelve UTC, que en Nicaragua va seis horas
  por detrás y hacía que las ventas de la tarde aparecieran como del día
  siguiente en el reporte de "hoy".

## Publicar los cambios

```bash
.\subir.bat
```

## Pendientes conocidos

- La copia de seguridad es una simulación en el navegador; no genera
  archivos de verdad.
- La API responde igual desde cualquier origen porque se usa
  `Flask-CORS` sin restringir. Al abrirla a una red real hay que limitar
  `origins` y poner el servidor detrás de HTTPS.
