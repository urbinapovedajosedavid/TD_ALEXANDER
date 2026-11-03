#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador de la sección "Hallazgos y remediación" para un reporte
académico de auditoría de seguridad Python/Flask.

Uso:
    python generador_reporte_hallazgos_remediacion.py

El reporte se guarda automáticamente como archivo Markdown (.md)
en la carpeta desde la que se ejecuta este script.
"""

from datetime import datetime
from pathlib import Path
import re


SEVERIDADES = ["Crítica", "Alta", "Media", "Baja", "Informativa"]


def pedir(texto, obligatorio=True):
    while True:
        valor = input(texto).strip()
        if valor or not obligatorio:
            return valor
        print("Este campo es obligatorio. Inténtalo de nuevo.")


def nombre_archivo(texto):
    texto = texto.strip().lower()
    texto = re.sub(r"[^\w\-]+", "_", texto, flags=re.UNICODE)
    return texto.strip("_") or "proyecto"


def multilinea(titulo, obligatorio=True):
    print(f"\n{titulo}")
    print("(Escribe el texto; termina introduciendo una línea que contenga únicamente FIN)")
    lineas = []
    while True:
        linea = input()
        if linea.strip().upper() == "FIN":
            break
        lineas.append(linea)
    contenido = "\n".join(lineas).strip()
    if obligatorio and not contenido:
        print("Debes introducir información para este campo.")
        return multilinea(titulo, obligatorio)
    return contenido or "No documentado."


def registrar_hallazgo(numero):
    print("\n" + "=" * 65)
    print(f"REGISTRO DEL HALLAZGO {numero}")
    print("=" * 65)

    titulo = pedir("Título de la vulnerabilidad: ")

    print("\nSelecciona la severidad:")
    for i, nivel in enumerate(SEVERIDADES, start=1):
        print(f"  {i}. {nivel}")
    while True:
        opcion = input("Número (1-5): ").strip()
        if opcion in {"1", "2", "3", "4", "5"}:
            severidad = SEVERIDADES[int(opcion) - 1]
            break
        print("Opción no válida.")

    componente = pedir("Archivo, módulo o componente afectado: ")
    ubicacion = pedir("Ubicación exacta (línea, función o ruta; si se conoce): ", False)
    evidencia = multilinea("Evidencia técnica observada (fragmento, resultado o pasos de reproducción):")
    impacto = multilinea("Impacto y riesgo para la confidencialidad, integridad o disponibilidad:")
    remediacion = multilinea("Remediación recomendada (cambio concreto que debe realizarse):")
    verificacion = multilinea("Cómo verificar que la corrección funciona:", obligatorio=False)
    referencia = pedir("Referencia técnica (OWASP, CWE, documentación u otra; opcional): ", False)

    return {
        "titulo": titulo,
        "severidad": severidad,
        "componente": componente,
        "ubicacion": ubicacion or "No determinada",
        "evidencia": evidencia,
        "impacto": impacto,
        "remediacion": remediacion,
        "verificacion": verificacion or "Definir una prueba de verificación.",
        "referencia": referencia or "No indicada",
    }


def crear_reporte(proyecto, auditor, fecha, hallazgos):
    conteo = {nivel: 0 for nivel in SEVERIDADES}
    for hallazgo in hallazgos:
        conteo[hallazgo["severidad"]] += 1

    lineas = [
        f"# Hallazgos y remediación — {proyecto}",
        "",
        "## 1. Alcance de esta sección",
        "",
        (
            "Esta sección documenta los hallazgos identificados durante la "
            "revisión de seguridad del proyecto. Cada hallazgo incluye su "
            "evidencia, nivel de severidad, impacto potencial y una medida "
            "de remediación propuesta. La clasificación debe justificarse "
            "según el contexto y la exposición real del sistema."
        ),
        "",
        f"- **Proyecto:** {proyecto}",
        f"- **Responsable de la auditoría:** {auditor or 'No indicado'}",
        f"- **Fecha de elaboración:** {fecha}",
        f"- **Hallazgos documentados:** {len(hallazgos)}",
        "",
        "## 2. Resumen de hallazgos",
        "",
        "| Severidad | Cantidad |",
        "|---|---:|",
    ]

    for nivel in SEVERIDADES:
        lineas.append(f"| {nivel} | {conteo[nivel]} |")

    lineas += ["", "## 3. Detalle de hallazgos", ""]

    if not hallazgos:
        lineas += [
            "No se registraron hallazgos en esta ejecución. "
            "Esto no demuestra por sí solo que el sistema esté libre de vulnerabilidades.",
            "",
        ]

    for i, h in enumerate(hallazgos, start=1):
        lineas += [
            f"### H-{i:02d}. {h['titulo']}",
            "",
            f"- **Severidad:** {h['severidad']}",
            f"- **Componente afectado:** {h['componente']}",
            f"- **Ubicación:** {h['ubicacion']}",
            "",
            "**Evidencia técnica**",
            "",
            h["evidencia"],
            "",
            "**Impacto y riesgo**",
            "",
            h["impacto"],
            "",
            "**Remediación recomendada**",
            "",
            h["remediacion"],
            "",
            "**Verificación posterior**",
            "",
            h["verificacion"],
            "",
            f"**Referencia técnica:** {h['referencia']}",
            "",
        ]

    lineas += [
        "## 4. Plan de remediación priorizado",
        "",
        "Se recomienda atender primero los hallazgos críticos y altos, "
        "considerando la exposición del sistema, la facilidad de explotación "
        "y el impacto sobre los datos y las cuentas de usuario. Después de "
        "aplicar cada corrección, deben repetirse las pruebas correspondientes.",
        "",
        "| Prioridad | Acción | Estado |",
        "|---|---|---|",
    ]

    for nivel in ["Crítica", "Alta", "Media", "Baja", "Informativa"]:
        for i, h in enumerate(hallazgos, start=1):
            if h["severidad"] == nivel:
                lineas.append(
                    f"| {nivel} | Corregir H-{i:02d}: {h['titulo']} | Pendiente |"
                )

    if not hallazgos:
        lineas.append("| Por determinar | Registrar y evaluar hallazgos confirmados | Pendiente |")

    lineas += [
        "",
        "## 5. Conclusión",
        "",
        (
            "Las vulnerabilidades descritas deben tratarse de acuerdo con "
            "su severidad y verificarse después de implementar las medidas "
            "correctivas. Las conclusiones de esta sección se limitan a las "
            "pruebas y evidencias efectivamente documentadas; no deben "
            "interpretarse como una garantía absoluta de seguridad."
        ),
        "",
        "## 6. Consideraciones académicas",
        "",
        "- No incluir contraseñas, tokens, claves secretas ni datos personales reales.",
        "- Sustituir los ejemplos por evidencias obtenidas durante la auditoría.",
        "- No afirmar que una vulnerabilidad existe si no fue reproducida o sustentada.",
        "- Citar las fuentes técnicas utilizadas y respetar el formato bibliográfico solicitado por la institución.",
        "",
        "---",
        f"*Documento generado automáticamente el {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.*",
        "",
    ]

    return "\n".join(lineas)


def main():
    print("=" * 65)
    print(" GENERADOR DE REPORTE: HALLAZGOS Y REMEDIACIÓN")
    print(" Auditoría académica de seguridad Python / Flask")
    print("=" * 65)
    print("Este asistente documenta hallazgos que tú ya hayas comprobado.")
    print("No ejecuta pruebas ni confirma vulnerabilidades por sí mismo.\n")

    proyecto = pedir("Nombre del proyecto: ")
    auditor = pedir("Nombre del autor/a o auditor/a (opcional): ", False)
    fecha = datetime.now().strftime("%d/%m/%Y")

    hallazgos = []
    while True:
        respuesta = input("\n¿Deseas registrar un hallazgo? (s/n): ").strip().lower()
        if respuesta in {"s", "si", "sí"}:
            hallazgos.append(registrar_hallazgo(len(hallazgos) + 1))
        elif respuesta in {"n", "no"}:
            break
        else:
            print("Responde s o n.")

    contenido = crear_reporte(proyecto, auditor, fecha, hallazgos)
    archivo = Path.cwd() / (
        f"reporte_hallazgos_remediacion_{nombre_archivo(proyecto)}.md"
    )

    try:
        archivo.write_text(contenido, encoding="utf-8")
    except OSError as error:
        print(f"\nNo se pudo guardar el reporte: {error}")
        raise SystemExit(1)

    print("\n" + "=" * 65)
    print("REPORTE GUARDADO CORRECTAMENTE")
    print(f"Ubicación: {archivo.resolve()}")
    print(f"Hallazgos registrados: {len(hallazgos)}")
    print("Formato: Markdown (.md)")
    print("=" * 65)


if __name__ == "__main__":
    main()
