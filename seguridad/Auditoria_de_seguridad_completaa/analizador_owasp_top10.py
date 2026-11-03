#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analizador estático de patrones OWASP Top 10 para Python/Flask.

Uso:
    python analizador_owasp_top10.py /ruta/al/proyecto

Sin ruta, analiza el directorio actual. Guarda automáticamente un reporte
Markdown en el directorio desde el que se ejecuta. Los indicadores requieren
validación manual y no confirman por sí solos vulnerabilidades.
"""

import ast
import os
import re
import sys
from pathlib import Path
from datetime import datetime
from collections import Counter

IGNORAR = {".git", "__pycache__", ".venv", "venv", "env",
           "node_modules", "dist", "build", ".pytest_cache"}
HALLAZGOS = []

REGLAS = [
    ("A02:2021 – Fallos criptográficos", "Alta",
     re.compile(r"\b(md5|sha1)\s*\(", re.I),
     "No usar MD5/SHA-1 para contraseñas. Usar Argon2id, scrypt o bcrypt."),
    ("A02:2021 – Fallos criptográficos", "Alta",
     re.compile(r"\bverify\s*=\s*False\b", re.I),
     "Mantener la verificación TLS activada y configurar certificados confiables."),
    ("A02:2021 – Fallos criptográficos", "Alta",
     re.compile(r"secret_key\s*=\s*['\"][^'\"]+['\"]", re.I),
     "Cargar la clave secreta desde variables de entorno o un gestor de secretos; rotarla si fue expuesta."),
    ("A05:2021 – Configuración de seguridad incorrecta", "Alta",
     re.compile(r"\bdebug\s*=\s*True\b", re.I),
     "Desactivar debug en producción y configurar el entorno de forma segura."),
    ("A08:2021 – Fallos de integridad del software y los datos", "Alta",
     re.compile(r"\bpickle\.loads\s*\(", re.I),
     "No deserializar con pickle datos controlados por usuarios. Preferir JSON cuando sea apropiado."),
    ("A03:2021 – Inyección", "Alta",
     re.compile(r"\b(os\.system|subprocess\.Popen|subprocess\.run)\s*\(.*shell\s*=\s*True", re.I),
     "Evitar shell=True con entradas externas. Usar listas de argumentos y validar los valores."),
    ("A07:2021 – Fallos de identificación y autenticación", "Alta",
     re.compile(r"\b(password|passwd|pwd)\s*=\s*['\"][^'\"]+['\"]", re.I),
     "No guardar contraseñas en el código. Para contraseñas de usuarios usar Argon2id, scrypt o bcrypt."),
    ("A09:2021 – Fallos de registro y supervisión", "Media",
     re.compile(r"\bprint\s*\(.*(password|passwd|token|secret|api[_-]?key)", re.I),
     "No imprimir contraseñas, tokens ni secretos. Registrar eventos sin datos sensibles."),
]

RECOMENDACIONES = {
    "A01:2021 – Control de acceso roto":
        "Aplicar autorización en el servidor, denegar por defecto y comprobar permisos sobre cada recurso.",
    "A02:2021 – Fallos criptográficos":
        "Usar HTTPS, cookies seguras, gestión externa de secretos y algoritmos vigentes. Para contraseñas, Argon2id, scrypt o bcrypt.",
    "A03:2021 – Inyección":
        "Usar consultas SQL parametrizadas u ORM. No concatenar entradas en SQL, comandos del sistema ni plantillas.",
    "A04:2021 – Diseño inseguro":
        "Definir requisitos de seguridad, modelar amenazas y diseñar controles para autenticación, autorización y protección de datos.",
    "A05:2021 – Configuración de seguridad incorrecta":
        "Desactivar debug en producción, restringir hosts, configurar cabeceras de seguridad y cookies Secure, HttpOnly y SameSite.",
    "A06:2021 – Componentes vulnerables y desactualizados":
        "Inventariar y actualizar dependencias. Fijar versiones revisadas y ejecutar pip-audit.",
    "A07:2021 – Fallos de identificación y autenticación":
        "Usar hash de contraseñas resistente, limitar intentos, proteger recuperación de cuentas y gestionar sesiones con expiración.",
    "A08:2021 – Fallos de integridad del software y los datos":
        "Verificar procedencia e integridad de dependencias y artefactos. Evitar deserialización insegura.",
    "A09:2021 – Fallos de registro y supervisión":
        "Registrar accesos y acciones sensibles, proteger los logs y excluir contraseñas y tokens.",
    "A10:2021 – Falsificación de solicitudes del lado del servidor (SSRF)":
        "Validar destinos mediante listas permitidas, bloquear direcciones locales y redes internas y restringir la salida de red.",
}


def agregar(categoria, severidad, archivo, linea, evidencia, solucion):
    HALLAZGOS.append({
        "categoria": categoria, "severidad": severidad,
        "archivo": str(archivo), "linea": linea,
        "evidencia": evidencia.strip()[:500], "solucion": solucion
    })


def analizar_ast(ruta, codigo):
    try:
        arbol = ast.parse(codigo, filename=str(ruta))
    except SyntaxError as exc:
        agregar("Revisión de código", "Informativa", ruta, exc.lineno or 0,
                f"No se pudo analizar por error de sintaxis: {exc.msg}",
                "Corregir el error de sintaxis y volver a ejecutar el análisis.")
        return

    for nodo in ast.walk(arbol):
        if not isinstance(nodo, ast.Call):
            continue
        funcion = nodo.func.id if isinstance(nodo.func, ast.Name) else (
            nodo.func.attr if isinstance(nodo.func, ast.Attribute) else "")

        if funcion in {"execute", "executemany"} and nodo.args:
            if isinstance(nodo.args[0], (ast.BinOp, ast.JoinedStr)):
                agregar("A03:2021 – Inyección", "Alta", ruta, nodo.lineno,
                        "La consulta pasada a execute() parece construirse con concatenación o f-string.",
                        "Usar parámetros enlazados u ORM. No interpolar valores externos directamente en SQL.")

        if funcion in {"eval", "exec"}:
            agregar("A03:2021 – Inyección", "Alta", ruta, nodo.lineno,
                    f"Uso de {funcion}() detectado.",
                    "Evitar ejecutar código dinámico. Rediseñar para procesar datos sin convertir entradas en código.")

        if funcion == "render_template_string":
            agregar("A03:2021 – Inyección", "Media", ruta, nodo.lineno,
                    "Uso de render_template_string(); revisar si recibe contenido controlado por usuarios.",
                    "Preferir plantillas almacenadas y pasar datos como variables; no insertar entradas no confiables en el código de plantilla.")

        if funcion == "run":
            for kw in nodo.keywords:
                if kw.arg == "debug" and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                    agregar("A05:2021 – Configuración de seguridad incorrecta", "Alta",
                            ruta, nodo.lineno, "Se detectó run(debug=True).",
                            "Desactivar debug en producción y usar un servidor WSGI adecuado.")


def analizar_archivo(ruta):
    try:
        codigo = ruta.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return
    analizar_ast(ruta, codigo)
    for numero, linea in enumerate(codigo.splitlines(), 1):
        for categoria, severidad, patron, solucion in REGLAS:
            if patron.search(linea):
                agregar(categoria, severidad, ruta, numero, linea, solucion)


def revisar_requirements(raiz):
    archivo = raiz / "requirements.txt"
    if not archivo.is_file():
        return
    try:
        lineas = archivo.read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    for numero, linea in enumerate(lineas, 1):
        texto = linea.strip()
        if texto and not texto.startswith("#") and not re.search(r"(==|~=|>=|<=|>|<)", texto):
            agregar("A06:2021 – Componentes vulnerables y desactualizados",
                    "Informativa", archivo, numero,
                    f"Dependencia sin versión fijada: {texto}",
                    "Revisar la dependencia, fijar una versión mantenida y ejecutar pip-audit.")


def recorrer(raiz):
    cantidad = 0
    for carpeta, subcarpetas, archivos in os.walk(raiz):
        subcarpetas[:] = [d for d in subcarpetas if d not in IGNORAR]
        for nombre in archivos:
            ruta = Path(carpeta) / nombre
            if ruta.suffix.lower() == ".py":
                cantidad += 1
                analizar_archivo(ruta)
    revisar_requirements(raiz)
    return cantidad


def generar_reporte(raiz, cantidad):
    ahora = datetime.now()
    destino = Path.cwd() / f"reporte_owasp_top10_{ahora:%Y%m%d_%H%M%S}.md"
    conteo = Counter(h["severidad"] for h in HALLAZGOS)
    lineas = [
        "# Informe de análisis estático – OWASP Top 10", "",
        f"- **Proyecto:** `{raiz}`",
        f"- **Fecha:** {ahora:%Y-%m-%d %H:%M:%S}",
        f"- **Archivos Python analizados:** {cantidad}",
        f"- **Indicadores encontrados:** {len(HALLAZGOS)}", "",
        "> **Limitaciones:** este informe contiene indicadores heurísticos. "
        "No confirma explotabilidad ni demuestra que el proyecto esté libre "
        "de vulnerabilidades. Validar cada resultado manualmente.", "",
        "## Resumen por severidad", "",
        "| Severidad | Cantidad |", "|---|---:|"
    ]
    for nivel in ["Crítica", "Alta", "Media", "Baja", "Informativa"]:
        lineas.append(f"| {nivel} | {conteo.get(nivel, 0)} |")
    lineas += ["", "## Hallazgos", ""]
    if not HALLAZGOS:
        lineas += ["No se detectaron patrones de las reglas implementadas. "
                   "Esto no garantiza que el proyecto esté libre de vulnerabilidades.", ""]

    for i, h in enumerate(HALLAZGOS, 1):
        evidencia = h["evidencia"].replace("```", "   ")
        lineas += [
            f"### OWASP-{i:03d}: {h['categoria']}", "",
            f"- **Severidad orientativa:** {h['severidad']}",
            f"- **Archivo:** `{h['archivo']}`",
            f"- **Línea:** {h['linea']}", "",
            "**Evidencia / indicador detectado**", "",
            "```text", evidencia, "```", "",
            "**Remediación recomendada**", "", h["solucion"], ""
        ]

    lineas += ["## Revisión manual de las categorías OWASP Top 10", ""]
    for categoria, solucion in RECOMENDACIONES.items():
        lineas += [f"### {categoria}", "", solucion, ""]

    lineas += [
        "## Validación recomendada", "",
        "1. Confirmar manualmente cada indicador y su contexto.",
        "2. Revisar permisos, roles y acceso a objetos.",
        "3. Probar autenticación, sesiones, recuperación de cuenta y CSRF.",
        "4. Verificar consultas SQL parametrizadas.",
        "5. Revisar configuración de producción y dependencias.",
        "6. Repetir las pruebas después de aplicar correcciones.", "",
        "## Herramientas complementarias", "",
        "- `bandit -r RUTA_DEL_PROYECTO` para análisis estático Python.",
        "- `pip-audit` para revisar dependencias conocidas como vulnerables.", "",
        "*Generado automáticamente por analizador_owasp_top10.py.*", ""
    ]
    destino.write_text("\n".join(lineas), encoding="utf-8")
    return destino


def main():
    raiz = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
    if not raiz.exists() or not raiz.is_dir():
        print(f"[ERROR] La ruta no existe o no es una carpeta: {raiz}")
        return 2

    print("=" * 65)
    print("       ANALIZADOR ESTÁTICO OWASP TOP 10")
    print("                PYTHON / FLASK")
    print("=" * 65)
    print(f"[+] Proyecto: {raiz}")
    print("[+] Analizando archivos Python y requirements.txt...\n")

    cantidad = recorrer(raiz)
    try:
        reporte = generar_reporte(raiz, cantidad)
    except OSError as exc:
        print(f"[ERROR] No se pudo guardar el reporte: {exc}")
        return 1

    print("=" * 65)
    print("ANÁLISIS FINALIZADO")
    print(f"Archivos Python analizados: {cantidad}")
    print(f"Indicadores encontrados: {len(HALLAZGOS)}")
    print(f"Reporte guardado en: {reporte.resolve()}")
    print("=" * 65)
    print("Nota: los indicadores requieren validación manual.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
