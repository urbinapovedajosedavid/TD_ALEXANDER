/* demo.js — Modo demostración eliminado.
 *
 * El sistema opera exclusivamente con persistencia en SQLite y autenticación en servidor.
 * Este archivo permanece como módulo inerte para compatibilidad con las etiquetas <script>
 * sin almacenar datos en localStorage ni sessionStorage.
 */

window.App = window.App || {};

window.App.demo = {
    sinServidor: () => false,
    marcarCaido: () => {},
    iniciarSesion: () => {},
    TIMEOUT_MS: 3000,
    reiniciar: () => {},
    exportar: () => ({ datos: {} }),
    pedir: async () => {
        throw new Error("El modo demo fue eliminado. Usa el servidor con SQLite.");
    },
};
