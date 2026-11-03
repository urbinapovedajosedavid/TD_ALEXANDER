
import os
import sys
import subprocess

CARPETA = os.path.dirname(os.path.abspath(__file__))

ARCHIVOS = {
    "1": "auditoria_de_seguridad_proyecto.py",
    "2": "generador_reporte_hallazgos_remediacion.py",
    "3": "analizador_owasp_top10.py"
}


def ejecutar_archivo(nombre, argumentos=None):
    ruta = os.path.join(CARPETA, nombre)

    if not os.path.isfile(ruta):
        print(f"\nERROR: No se encontró el archivo: {nombre}")
        return

    comando = [sys.executable, ruta]

    if argumentos:
        comando.extend(argumentos)

    print(f"\nEjecutando: {nombre}\n")
    subprocess.run(comando, check=False)


def solicitar_ruta():
    ruta = input("\nIngresa la ruta del proyecto que deseas analizar: ")
    ruta = ruta.strip().strip('"').strip("'")

    if not os.path.exists(ruta):
        print("\nERROR: La ruta indicada no existe.")
        return None

    if not os.path.isdir(ruta):
        print("\nERROR: Debes indicar una carpeta.")
        return None

    return ruta


def menu():
    while True:
        os.system("clear")

        print("=" * 55)
        print("       SISTEMA DE AUDITORIA DE SEGURIDAD")
        print("=" * 55)
        print("1. Auditoria general del proyecto")
        print("2. Generador de hallazgos y remediaciones")
        print("3. Analizador OWASP Top 10")
        print("4. Ejecutar las tres herramientas")
        print("0. Salir")
        print("=" * 55)

        opcion = input("Selecciona una opcion: ").strip()

        if opcion == "1":
            ruta = solicitar_ruta()
            if ruta:
                ejecutar_archivo(ARCHIVOS["1"], [ruta])

        elif opcion == "2":
            ejecutar_archivo(ARCHIVOS["2"])

        elif opcion == "3":
            ruta = solicitar_ruta()
            if ruta:
                ejecutar_archivo(ARCHIVOS["3"], [ruta])

        elif opcion == "4":
            ruta = solicitar_ruta()

            if ruta:
                ejecutar_archivo(ARCHIVOS["1"], [ruta])
                ejecutar_archivo(ARCHIVOS["3"], [ruta])
                ejecutar_archivo(ARCHIVOS["2"])

        elif opcion == "0":
            print("\nSaliendo del sistema...")
            break

        else:
            print("\nOpcion no valida.")

        input("\nPresiona ENTER para regresar al menu...")


if __name__ == "__main__":
    menu()

