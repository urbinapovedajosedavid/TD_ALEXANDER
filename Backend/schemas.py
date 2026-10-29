def validar_producto(data):
    """Valida los datos de entrada para un producto del almacén.

    Retorna (True, None) si es válido, o (False, mensaje_error) si falla.
    """
    if not isinstance(data, dict):
        return False, "Los datos enviados no tienen el formato JSON correcto."

    campos_requeridos = ['nombre', 'precio', 'stock']
    for campo in campos_requeridos:
        if campo not in data or data[campo] is None or str(data[campo]).strip() == "":
            return False, f"El campo obligatorio '{campo}' está ausente o vacío."

    try:
        precio = float(data['precio'])
        stock = int(data['stock'])

        if precio < 0:
            return False, "El precio no puede ser negativo."
        if stock < 0:
            return False, "El stock no puede ser negativo."

    except (ValueError, TypeError):
        return False, "El precio debe ser un número válido y el stock un número entero."

    return True, None


def validar_usuario(data):
    """Valida los datos de entrada para el registro de usuarios.

    Acepta 'clave' o 'contrasena' indistintamente.
    """
    if not isinstance(data, dict):
        return False, "Los datos enviados no tienen el formato JSON correcto."

    usuario = data.get("usuario")
    if not usuario or str(usuario).strip() == "":
        return False, "El campo obligatorio 'usuario' es requerido."

    clave = data.get("clave") if data.get("clave") is not None else data.get("contrasena")
    if not clave or str(clave).strip() == "":
        return False, "El campo obligatorio 'clave' es requerido."

    if len(str(clave)) < 4:
        return False, "La contraseña debe tener al menos 4 caracteres."

    return True, None
