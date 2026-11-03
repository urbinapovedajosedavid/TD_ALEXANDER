import os
import re
import ast
import sys
from pathlib import Path

# ==========================================
# AUDITOR DE SEGURIDAD PYTHON / FLASK
# ==========================================

RIESGOS = {
    "CRITICO": [],
    "ALTO": [],
    "MEDIO": [],
    "BAJO": []
}

ARCHIVOS_IGNORADOS = {
    ".git", "__pycache__", "venv", ".venv",
    "node_modules", "dist", "build"
}


def reportar(nivel, archivo, linea, mensaje):
    RIESGOS[nivel].append(
        f"{archivo}:{linea} - {mensaje}"
    )


def analizar_archivo(ruta):
    try:
        codigo = ruta.read_text(encoding="utf-8")
    except Exception:
        return

    nombre = str(ruta)

    try:
        arbol = ast.parse(codigo)
    except SyntaxError:
        reportar("MEDIO", nombre, 0,
                 "No se pudo analizar sintácticamente el archivo.")
        return

    # Detectar configuraciones y funciones inseguras
    for nodo in ast.walk(arbol):

        if isinstance(nodo, ast.Call):

            funcion = ""
            if isinstance(nodo.func, ast.Name):
                funcion = nodo.func.id
            elif isinstance(nodo.func, ast.Attribute):
                funcion = nodo.func.attr

            if funcion == "debug" and isinstance(nodo.func, ast.Attribute):
                pass

            if funcion == "execute":
                if nodo.args:
                    argumento = nodo.args[0]
                    if isinstance(argumento, ast.BinOp):
                        reportar(
                            "CRITICO", nombre, nodo.lineno,
                            "Posible consulta SQL construida mediante concatenación."
                        )
                    elif isinstance(argumento, ast.JoinedStr):
                        reportar(
                            "CRITICO", nombre, nodo.lineno,
                            "Posible inyección SQL mediante f-string."
                        )

            if funcion in ("eval", "exec"):
                reportar(
                    "ALTO", nombre, nodo.lineno,
                    f"Uso de función dinámica peligrosa: {funcion}."
                )

            if funcion == "render_template_string":
                reportar(
                    "ALTO", nombre, nodo.lineno,
                    "Revisar posible inyección de plantillas."
                )

            if funcion == "run":
                for palabra in ("debug", "host"):
                    for kw in nodo.keywords:
                        if kw.arg == "debug" and isinstance(kw.value, ast.Constant):
                            if kw.value.value is True:
                                reportar(
                                    "ALTO", nombre, nodo.lineno,
                                    "Flask ejecutado con debug=True."
                                )

    # Analizar líneas de código
    for numero, linea in enumerate(codigo.splitlines(), 1):
        texto = linea.strip().lower()

        if re.search(r"secret_key\s*=\s*['\"]", texto):
            reportar(
                "ALTO", nombre, numero,
                "Posible clave secreta escrita directamente en el código."
            )

        if "password" in texto or "passwd" in texto:
            if re.search(r"password\s*=\s*['\"]|passwd\s*=\s*['\"]", texto):
                reportar(
                    "CRITICO", nombre, numero,
                    "Posible contraseña almacenada directamente en el código."
                )

        if "md5(" in texto or "sha1(" in texto:
            reportar(
                "ALTO", nombre, numero,
                "Posible uso de hash débil para contraseñas."
            )

        if "verify=False" in texto:
            reportar(
                "ALTO", nombre, numero,
                "Verificación TLS desactivada."
            )

        if "pickle.loads(" in texto:
            reportar(
                "ALTO", nombre, numero,
                "Deserialización pickle potencialmente peligrosa."
            )

        if "session.permanent" in texto:
            pass


def recorrer_proyecto(directorio):
    for raiz, carpetas, archivos in os.walk(directorio):
        carpetas[:] = [
            carpeta for carpeta in carpetas
            if carpeta not in ARCHIVOS_IGNORADOS
        ]

        for archivo in archivos:
            if archivo.endswith(".py"):
                analizar_archivo(Path(raiz) / archivo)


def mostrar_resultados():
    print("\n" + "=" * 65)
    print("       INFORME DE AUDITORÍA DE SEGURIDAD")
    print("              PYTHON / FLASK")
    print("=" * 65)

    total = 0

    for nivel, hallazgos in RIESGOS.items():
        print(f"\n[{nivel}] - {len(hallazgos)} hallazgos")
        total += len(hallazgos)

        for hallazgo in hallazgos:
            print("  - " + hallazgo)

    print("\n" + "=" * 65)
    print(f"TOTAL DE HALLAZGOS: {total}")
    print("Auditoría estática finalizada.")
    print("=" * 65)

    if total == 0:
        print("No se encontraron patrones sospechosos.")
        print("Esto NO garantiza que el proyecto sea seguro.")


if __name__ == "__main__":
    directorio = sys.argv[1] if len(sys.argv) > 1 else "."

    if not os.path.isdir(directorio):
        print("Error: el directorio indicado no existe.")
        sys.exit(1)

    print("Iniciando auditoría de seguridad...")
    recorrer_proyecto(directorio)
    mostrar_resultados()
