import sqlite3

def inicializar_BD():
    # Se conecta o crea el archivo local 'tienda_alexander.db'
    conn = sqlite3.connect('tienda_alexander.db')
    cursor = conn.cursor()
    
    # Activar llaves foráneas
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Leemos el script de arriba si lo guardaste en un archivo esquema.sql
    with open('esquema.sql', 'r', encoding='utf-8') as f:
        script_sql = f.read()
        
    cursor.executescript(script_sql)
    conn.commit()
    conn.close()
    print("Base de datos inicializada correctamente.")

if __name__ == "__main__":
    inicializar_BD()