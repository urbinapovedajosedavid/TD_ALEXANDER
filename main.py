"""main.py — Punto de entrada alternativo para iniciar el sistema."""
import app

if __name__ == "__main__":
    puerto = 5000
    print("\nIniciando Tienda Alexander desde main.py...")
    app.app.run(host="0.0.0.0", port=puerto, debug=True)

