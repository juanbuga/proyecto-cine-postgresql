"""Configuración común de las pruebas: corren contra las bases reales (Neon y Atlas).

Las ventas que crean las pruebas se borran al final de cada prueba en los dos motores.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))   # script-integracion/

import conexiones   # noqa: E402
# transaccion se importa dentro de cada fixture: así las pruebas de conexión corren
# aunque transaccion.py (otra rama) todavía no esté fusionado.


def _hay_credenciales() -> bool:
    try:
        conexiones.conectar_postgres()
        conexiones.conectar_mongo()
        return True
    except conexiones.ErrorConexion:
        return False


def pytest_collection_modifyitems(config, items):
    if not _hay_credenciales():
        salto = pytest.mark.skip(reason="Sin conexión: revise el archivo .env")
        for item in items:
            item.add_marker(salto)


@pytest.fixture(scope="session", autouse=True)
def _cerrar_al_final():
    yield
    conexiones.cerrar_conexiones()


@pytest.fixture
def pg():
    """Cursor de PostgreSQL de solo lectura (se hace rollback al terminar)."""
    conn = conexiones.conectar_postgres()
    with conn.cursor() as cur:
        yield cur
    conn.rollback()


@pytest.fixture
def mongo():
    return conexiones.conectar_mongo()


@pytest.fixture
def datos_venta():
    import transaccion
    datos = transaccion.buscar_datos_de_prueba()
    if not datos:
        pytest.skip("No hay funciones PROGRAMADAS futuras con cupo")
    return datos


@pytest.fixture
def limpiar_ventas():
    """Las pruebas agregan aquí los id_venta que crean; al final se borran de los dos motores."""
    creadas: list[int] = []
    yield creadas
    if creadas:
        import transaccion
        conn = conexiones.conectar_postgres()
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ventas WHERE id_venta = ANY(%s)", (creadas,))
        conn.commit()
        conexiones.conectar_mongo()[transaccion.COLECCION].delete_many({"id_venta": {"$in": creadas}})


def conteos() -> tuple[int, int]:
    import transaccion
    return transaccion.contar_ventas()
