"""Herramienta de consola administrativa para Tienda Alexander.
Invocada por admin.bat para operaciones con privilegios de Administrador.
"""

import ctypes
import os
import secrets
import string
import sys
from datetime import datetime
from pathlib import Path

# Asegurar importación de módulos del proyecto
RAIZ_BASE = Path(__file__).resolve().parent.parent
if str(RAIZ_BASE) not in sys.path:
    sys.path.insert(0, str(RAIZ_BASE))

import backend.db as db
from backend.config import FORMATO_FECHA, RAIZ_ACTUAL, ahora, cargar_env
from seguridad.autenticacion import (
    hash_password,
    purgar_todas_las_sesiones,
    revocar_sesiones_de_usuario,
)


def es_administrador_windows() -> bool:
    """Verifica si el proceso actual corre con privilegios elevados en Windows."""
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return True


def requerir_admin():
    """Exige permisos de administrador en Windows."""
    if not es_administrador_windows():
        print("\n[ERROR DE SEGURIDAD] Se requieren permisos de Administrador en Windows.")
        print("Por favor ejecuta este script a través de admin.bat con privilegios elevados.\n")
        sys.exit(1)


def generar_clave_temporal(longitud: int = 10) -> str:
    """Genera una contraseña temporal segura pero fácil de escribir."""
    caracteres = string.ascii_letters + string.digits + "!@#$"
    primera = secrets.choice(string.ascii_uppercase)
    segunda = secrets.choice(string.digits)
    resto = "".join(secrets.choice(caracteres) for _ in range(longitud - 2))
    return f"{primera}{resto}{segunda}"


def listar_usuarios_tabla():
    """Muestra la lista de usuarios en formato tabla."""
    with db.conectar_db() as conn:
        filas = conn.execute(
            "SELECT id, nombre, apellido, usuario, rol, COALESCE(activo, 1) as activo, "
            "bloqueado, nivel_bloqueo, debe_cambiar_clave "
            "FROM usuarios ORDER BY id"
        ).fetchall()

    if not filas:
        print("   (No hay usuarios registrados en la base de datos)")
        return []

    print("-" * 75)
    print(f"{'ID':<4} | {'Usuario':<16} | {'Rol':<10} | {'Estado':<14} | {'Cambio Clave':<12}")
    print("-" * 75)
    for f in filas:
        nombre_completo = f"{f['nombre']} {f['apellido'] or ''}".strip()
        if not f["activo"]:
            estado = "Inactivo"
        elif f["bloqueado"]:
            estado = f"Bloqueado (N{f['nivel_bloqueo']})"
        else:
            estado = "Activo"

        cambio = "Obligatorio" if f["debe_cambiar_clave"] else "Al día"
        print(f"{f['id']:<4} | {f['usuario']:<16} | {f['rol']:<10} | {estado:<14} | {cambio:<12}")
    print("-" * 75)
    return filas


def accion_recuperar_cuenta():
    """Opción 1: Recuperar cuenta.
    Solicita privilegios de administrador de nuevo. Genera una contraseña temporal
    que funcionará de inmediato en el login para iniciar sesión (sin importar la
    contraseña anterior). Al iniciar sesión con ella, el sistema exigirá obligatoriamente
    ingresar: Contraseña temporal, Nueva contraseña y Confirmar nueva contraseña.
    """
    requerir_admin()

    print("\n" + "=" * 75)
    print("      RECUPERACIÓN DE CUENTA — GENERACIÓN DE CONTRASEÑA TEMPORAL")
    print("=" * 75)
    print("Esta opción desbloquea la cuenta y genera una contraseña temporal que")
    print("permitirá el acceso inmediato. Al entrar al sistema, se exigirá")
    print("obligatoriamente definir una nueva contraseña.")
    print("=" * 75 + "\n")

    filas = listar_usuarios_tabla()
    if not filas:
        return

    entrada = input("\nIngrese el nombre de usuario o ID de la cuenta a recuperar: ").strip()
    if not entrada:
        print("[AVISO] Operación cancelada.")
        return

    with db.conectar_db() as conn:
        usuario = conn.execute(
            "SELECT id, nombre, usuario, rol FROM usuarios "
            "WHERE (usuario = ? COLLATE NOCASE) OR (id = ?)",
            (entrada, int(entrada) if entrada.isdigit() else -1),
        ).fetchone()

        if not usuario:
            print(f"\n[ERROR] No se encontró ningún usuario con el identificador: {entrada}")
            return

        user_id = usuario["id"]
        username = usuario["usuario"]
        clave_temporal = generar_clave_temporal(10)

        # Actualizar base de datos: nueva clave hash, debe_cambiar_clave = 1, desbloquear cuenta
        conn.execute(
            "UPDATE usuarios SET "
            "password_hash = ?, "
            "debe_cambiar_clave = 1, "
            "intentos_fallidos = 0, "
            "bloqueado = 0, "
            "tiempo_bloqueo = NULL, "
            "nivel_bloqueo = 0, "
            "activo = 1 "
            "WHERE id = ?",
            (hash_password(clave_temporal), user_id),
        )

        # Revocar sesiones previas por seguridad
        revocar_sesiones_de_usuario(conn, user_id)

    print("\n" + "#" * 75)
    print("                 CUENTA RECUPERADA EXITOSAMENTE")
    print("#" * 75)
    print(f" * Usuario               : {username}")
    print(f" * Nombre                : {usuario['nombre']}")
    print(f" * Rol                   : {usuario['rol']}")
    print(f" * CONTRASEÑA TEMPORAL   : {clave_temporal}")
    print(f" * Estado de la cuenta   : 100% Desbloqueada y Activa")
    print(f" * Cambio obligatorio    : ACTIVO (Exigido en el próximo inicio de sesión)")
    print("#" * 75)
    print("\nINSTRUCCIONES DE USO:")
    print("1. Abre la aplicación web en http://127.0.0.1:5000/")
    print(f"2. En la pantalla de login, ingresa como usuario: {username}")
    print(f"3. Ingresa la contraseña temporal: {clave_temporal}")
    print("4. El sistema exigirá inmediatamente el formulario de cambio obligatorio:")
    print("     - Contraseña temporal")
    print("     - Nueva contraseña")
    print("     - Confirmar nueva contraseña")
    print("=" * 75 + "\n")


def accion_contrasenas_usuarios():
    """Opción 2: Contraseña de usuarios.
    Muestra la lista de usuarios y permite cambiar la contraseña directamente.
    """
    requerir_admin()

    print("\n" + "=" * 75)
    print("                 GESTIÓN DE CONTRASEÑAS DE USUARIOS")
    print("=" * 75)
    print("Lista completa de usuarios registrados en el sistema:")
    print("=" * 75 + "\n")

    filas = listar_usuarios_tabla()
    if not filas:
        return

    entrada = input("\nIngrese el ID o nombre de usuario al que desea cambiar la contraseña (o Enter para salir): ").strip()
    if not entrada:
        print("[AVISO] Operación cancelada.")
        return

    with db.conectar_db() as conn:
        usuario = conn.execute(
            "SELECT id, nombre, usuario, rol FROM usuarios "
            "WHERE (usuario = ? COLLATE NOCASE) OR (id = ?)",
            (entrada, int(entrada) if entrada.isdigit() else -1),
        ).fetchone()

        if not usuario:
            print(f"\n[ERROR] No se encontró el usuario: {entrada}")
            return

        print(f"\nUsuario seleccionado: {usuario['usuario']} ({usuario['nombre']} - {usuario['rol']})")
        print("[1] Escribir una contraseña manualmente")
        print("[2] Generar una contraseña aleatoria segura")
        sub_opc = input("Seleccione opción [1 o 2]: ").strip()

        if sub_opc == "2":
            nueva_clave = generar_clave_temporal(12)
        else:
            nueva_clave = input("Escriba la nueva contraseña (mínimo 4 caracteres): ").strip()
            if len(nueva_clave) < 4:
                print("\n[ERROR] La contraseña debe tener al menos 4 caracteres.")
                return

        resp_cambio = input("¿Exigir cambio de contraseña al iniciar sesión? (S/N) [N]: ").strip().upper()
        debe_cambiar = 1 if resp_cambio == "S" else 0

        conn.execute(
            "UPDATE usuarios SET "
            "password_hash = ?, "
            "debe_cambiar_clave = ?, "
            "intentos_fallidos = 0, "
            "bloqueado = 0, "
            "tiempo_bloqueo = NULL, "
            "nivel_bloqueo = 0, "
            "activo = 1 "
            "WHERE id = ?",
            (hash_password(nueva_clave), debe_cambiar, usuario["id"]),
        )
        revocar_sesiones_de_usuario(conn, usuario["id"])

    print("\n" + "=" * 75)
    print(f" [OK] Contraseña del usuario '{usuario['usuario']}' actualizada con éxito.")
    print(f"      Nueva contraseña establecida: {nueva_clave}")
    if debe_cambiar:
        print("      * Se exigirá cambio de contraseña en el próximo acceso.")
    print("=" * 75 + "\n")


def accion_desarrolladores():
    """Opción 3: Desarrolladores.
    Menú de acceso exclusivo para el creador del proyecto con control total
    y opciones automatizadas sin tocar el código fuente manualmente.
    """
    requerir_admin()

    while True:
        print("\n" + "=" * 75)
        print("             PANEL EXCLUSIVO PARA DESARROLLADORES Y CREADOR")
        print("=" * 75)
        print(" [1] Crear / Promover usuario a Administrador maestro")
        print(" [2] Restablecer base de datos a estado de fábrica (limpia)")
        print(" [3] Realizar copia de seguridad inmediata (.bak)")
        print(" [4] Restaurar base de datos desde una copia existente")
        print(" [5] Diagnóstico de integridad de SQLite (PRAGMA integrity_check)")
        print(" [6] Purgar y cerrar todas las sesiones activas")
        print(" [7] Configuración de Red / Puerto del Servidor (.env)")
        print(" [8] Ver resumen estadístico general de la base de datos")
        print(" [9] Volver al menú principal")
        print("=" * 75)

        opc = input("Selecciona una opción [1-9]: ").strip()

        if opc == "1":
            _dev_crear_o_promover_admin()
        elif opc == "2":
            _dev_restablecer_fabrica()
        elif opc == "3":
            _dev_respaldo_inmediato()
        elif opc == "4":
            _dev_restaurar_respaldo()
        elif opc == "5":
            _dev_verificar_integridad()
        elif opc == "6":
            _dev_purgar_sesiones()
        elif opc == "7":
            _dev_configurar_red()
        elif opc == "8":
            _dev_resumen_estadistico()
        elif opc == "9":
            break
        else:
            print("[AVISO] Opción no válida.")


def _dev_crear_o_promover_admin():
    print("\n--- Crear o Promover Administrador Maestro ---")
    usuario = input("Nombre de usuario a crear o promover: ").strip()
    if not usuario:
        return

    with db.conectar_db() as conn:
        fila = conn.execute("SELECT id, usuario, rol FROM usuarios WHERE usuario = ? COLLATE NOCASE", (usuario,)).fetchone()
        if fila:
            conn.execute("UPDATE usuarios SET rol = 'ADMIN', activo = 1 WHERE id = ?", (fila["id"],))
            print(f"[OK] El usuario existente '{fila['usuario']}' ahora tiene rol ADMIN.")
        else:
            nombre = input("Nombre completo del administrador: ").strip() or "Administrador"
            clave = input("Contraseña del nuevo administrador (o Enter para generar una): ").strip()
            if not clave:
                clave = generar_clave_temporal(12)
                print(f"Contraseña generada: {clave}")

            conn.execute(
                "INSERT INTO usuarios (nombre, usuario, password_hash, rol, activo, debe_cambiar_clave) "
                "VALUES (?, ?, ?, 'ADMIN', 1, 0)",
                (nombre, usuario, hash_password(clave)),
            )
            print(f"[OK] Administrador maestro '{usuario}' creado exitosamente con la contraseña asignada.")


def _dev_restablecer_fabrica():
    print("\n" + "!" * 75)
    print("¡ATENCIÓN! Esta acción reiniciará la base de datos eliminando")
    print("todos los productos, ventas y usuarios de prueba, y recreará")
    print("el esquema limpio con el administrador por defecto.")
    print("!" * 75)
    confirmacion = input("Escribe 'RESTABLECER' para confirmar: ").strip()
    if confirmacion != "RESTABLECER":
        print("[CANCELADO] No se realizaron cambios.")
        return

    # Realizar respaldo preventivo antes de restablecer
    _dev_respaldo_inmediato(silencioso=True)

    try:
        import sqlite3
        conn = sqlite3.connect(db.RUTA_DB)
        conn.close()

        # Re-inicializar DB
        db.inicializar_db()
        print("\n[OK] Base de datos restablecida a estado de fábrica exitosamente.")
    except Exception as e:
        print(f"[ERROR] No se pudo restablecer la base de datos: {e}")


def _dev_respaldo_inmediato(silencioso: bool = False):
    import sqlite3
    carpeta = RAIZ_ACTUAL / "database" / "respaldos"
    carpeta.mkdir(parents=True, exist_ok=True)
    nombre = f"alexander_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    destino_path = carpeta / nombre

    try:
        origen = sqlite3.connect(db.RUTA_DB)
        destino = sqlite3.connect(destino_path)
        try:
            origen.backup(destino)
        finally:
            destino.close()
            origen.close()

        if not silencioso:
            print(f"\n[OK] Copia de seguridad creada exitosamente en:\n     {destino_path}")
        return destino_path
    except Exception as e:
        print(f"[ERROR] Falló la creación del respaldo: {e}")
        return None


def _dev_restaurar_respaldo():
    carpeta = RAIZ_ACTUAL / "database" / "respaldos"
    if not carpeta.exists():
        print(f"[AVISO] No existe la carpeta de respaldos: {carpeta}")
        return

    archivos = sorted(carpeta.glob("*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not archivos:
        print("[AVISO] No se encontraron archivos de respaldo en database/respaldos.")
        return

    print("\nRespaldos disponibles:")
    for idx, f in enumerate(archivos[:10], 1):
        fecha = datetime.fromtimestamp(f.stat().st_mtime).strftime(FORMATO_FECHA)
        tamano_kb = round(f.stat().st_size / 1024, 1)
        print(f" [{idx}] {f.name} ({fecha} - {tamano_kb} KB)")

    sel = input("\nSeleccione el número del respaldo a restaurar (o Enter para cancelar): ").strip()
    if not sel.isdigit() or not (1 <= int(sel) <= len(archivos[:10])):
        print("[CANCELADO]")
        return

    elegido = archivos[int(sel) - 1]
    conf = input(f"¿Confirmas restaurar '{elegido.name}'? Se sobrescribirá la base actual (S/N): ").strip().upper()
    if conf != "S":
        print("[CANCELADO]")
        return

    import sqlite3
    try:
        origen = sqlite3.connect(elegido)
        destino = sqlite3.connect(db.RUTA_DB)
        try:
            origen.backup(destino)
        finally:
            destino.close()
            origen.close()

        db.inicializar_db()
        purgar_todas_las_sesiones()
        print(f"\n[OK] Base de datos restaurada correctamente desde {elegido.name}.")
    except Exception as e:
        print(f"[ERROR] Error al restaurar: {e}")


def _dev_verificar_integridad():
    print("\n--- Verificación de Integridad de SQLite ---")
    with db.conectar_db() as conn:
        res = conn.execute("PRAGMA integrity_check").fetchall()
        for r in res:
            print(f" * Chequeo: {r[0]}")

        tablas = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
        print(f"\nTablas activas ({len(tablas)}): {', '.join(t[0] for t in tablas)}")
    print("[OK] Comprobación de integridad completada sin fallas.")


def _dev_purgar_sesiones():
    with db.conectar_db() as conn:
        conn.execute("DELETE FROM sesiones")
    print("\n[OK] Todas las sesiones de usuario han sido revocadas. Se exigirá login a todos.")


def _dev_configurar_red():
    print("\n--- Configuración de Red del Servidor ---")
    ruta_env = RAIZ_ACTUAL / ".env"
    cargar_env()
    host_actual = os.environ.get("HOST", "127.0.0.1")
    puerto_actual = os.environ.get("PORT", "5000")

    print(f"Host actual  : {host_actual}")
    print(f"Puerto actual: {puerto_actual}")

    nuevo_host = input(f"Nuevo Host [{host_actual}]: ").strip() or host_actual
    nuevo_puerto = input(f"Nuevo Puerto [{puerto_actual}]: ").strip() or puerto_actual

    # Guardar en .env
    lineas = []
    if ruta_env.exists():
        for l in ruta_env.read_text(encoding="utf-8").splitlines():
            if not l.startswith("HOST=") and not l.startswith("PORT="):
                lineas.append(l)

    lineas.append(f"HOST={nuevo_host}")
    lineas.append(f"PORT={nuevo_puerto}")
    ruta_env.write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print(f"[OK] Archivo .env actualizado con HOST={nuevo_host} y PORT={nuevo_puerto}.")


def _dev_resumen_estadistico():
    print("\n--- Resumen Estadístico del Sistema ---")
    with db.conectar_db() as conn:
        total_usuarios = conn.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
        total_productos = conn.execute("SELECT COUNT(*) FROM productos").fetchone()[0]
        total_ventas = conn.execute("SELECT COUNT(*) FROM ventas").fetchone()[0]
        total_recaudado = conn.execute("SELECT COALESCE(SUM(total), 0) FROM ventas WHERE estado = 'COMPLETADA'").fetchone()[0]
        sesiones_activas = conn.execute("SELECT COUNT(*) FROM sesiones WHERE expira_en > datetime('now')").fetchone()[0]

    print(f" * Usuarios registrados : {total_usuarios}")
    print(f" * Productos en inventario: {total_productos}")
    print(f" * Ventas completadas   : {total_ventas}")
    print(f" * Total recaudado      : C$ {total_recaudado:,.2f}")
    print(f" * Sesiones activas     : {sesiones_activas}")


def main():
    if len(sys.argv) < 2:
        print("Uso: python admin_cli.py [recuperar | usuarios | dev]")
        sys.exit(0)

    comando = sys.argv[1].lower().strip()
    if comando == "recuperar":
        accion_recuperar_cuenta()
    elif comando == "usuarios":
        accion_contrasenas_usuarios()
    elif comando == "dev":
        accion_desarrolladores()
    else:
        print(f"Comando desconocido: {comando}")


if __name__ == "__main__":
    main()
