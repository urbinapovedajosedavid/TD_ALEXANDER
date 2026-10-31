(function () {
    const $ = (id) => document.getElementById(id);

    function tamanoLegible(bytes) {
        const numero = Number(bytes);
        if (!Number.isFinite(numero) || numero <= 0) return "0 KB";
        if (numero < 1024 * 1024) return `${Math.round(numero / 1024)} KB`;
        return `${(numero / (1024 * 1024)).toFixed(1)} MB`;
    }

    async function cargarInfo() {
        const info = await App.api.infoRespaldo();

        $("fechaBase").textContent = info.fecha
            ? App.fmt.fechaHora(info.fecha)
            : "La base aún no se ha creado";
        $("tamanoBase").textContent = tamanoLegible(info.tamano_bytes);
    }

    async function descargar() {
        const boton = $("btnDescargar");
        boton.disabled = true;

        try {
            await App.api.descargarRespaldo();
            App.ui.aviso("Copia descargada.");
        } catch (err) {
            App.ui.aviso(err.message);
        } finally {
            boton.disabled = false;
        }
    }

    async function restaurar() {
        const entrada = $("archivoRespaldo").files[0];
        const aviso = $("avisoRestaurar");

        if (!entrada) {
            aviso.textContent = "Primero elige un archivo de respaldo.";
            return;
        }

        const ok = App.ui.confirmar(
            `Se reemplazarán TODOS los datos actuales por los de "${entrada.name}". ` +
                "Esta acción no se puede deshacer. ¿Continuar?"
        );
        if (!ok) return;

        const boton = $("btnRestaurar");
        boton.disabled = true;
        aviso.textContent = "Restaurando...";

        try {
            await App.api.restaurarRespaldo(entrada);
            App.auth.limpiar();
            aviso.textContent = "Respaldo restaurado. Vuelve a iniciar sesión.";
            $("archivoRespaldo").value = "";
            setTimeout(() => window.location.replace("Login.html"), 1200);
        } catch (err) {
            aviso.textContent = err.message;
            boton.disabled = false;
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        if (!App.layout.montar()) return;

        if (!App.auth.esAdmin()) {
            App.ui.aviso("Solo el administrador puede gestionar copias de seguridad.");
            window.location.replace("inicio.html");
            return;
        }

        $("btnDescargar").addEventListener("click", descargar);
        $("btnRestaurar").addEventListener("click", restaurar);

        try {
            await cargarInfo();
        } catch (err) {
            App.ui.aviso(err.message);
        }
    });
})();
