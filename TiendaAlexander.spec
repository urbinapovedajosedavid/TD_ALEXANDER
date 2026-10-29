# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[('Frontend', 'Frontend'), ('database/esquema.sql', 'database'), ('.env', '.')],
    hiddenimports=['werkzeug', 'werkzeug.security', 'sqlite3', 'flask_cors', 'api', 'api.auth', 'api.usuarios', 'api.productos', 'api.ventas', 'api.proveedores', 'api.reportes', 'api.respaldos', 'seguridad', 'seguridad.autenticacion', 'seguridad.decoradores', 'seguridad.modelos'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='TiendaAlexander',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='TiendaAlexander',
)
