"""Conexión a PostgreSQL (Neon).

Neon trabaja en UTC y los TIMESTAMP del proyecto están en hora de Bogotá. Cada
transacción abre con SET LOCAL TIME ZONE 'America/Bogota'; si no, los triggers
verían como ya iniciada una función de las 20:00 desde las 15:00 (caso C4).
"""
import threading
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from . import config
from .errores import ErrorCuevana, traducir_pg

_conexion: psycopg.Connection | None = None
_candado = threading.RLock()   # una sola conexión compartida: una transacción a la vez (caso C10)
_avisos: list[str] = []        # RAISE NOTICE de los procedimientos


def _al_avisar(diag) -> None:
    _avisos.append(diag.message_primary)


def conectar() -> psycopg.Connection:
    global _conexion
    if _conexion is None or _conexion.closed:
        url = config.pg_url()
        if not url:
            raise ErrorCuevana(503, "Falta PG_URL (en .env o en los Secretos de Colab).", "postgresql")
        try:
            # connect_timeout amplio: Neon suspende la base inactiva y tarda unos segundos en despertar (C8)
            _conexion = psycopg.connect(url, row_factory=dict_row, autocommit=True, connect_timeout=30)
        except psycopg.OperationalError as e:
            raise ErrorCuevana(503, f"Sin conexión con PostgreSQL: {str(e).splitlines()[0]}", "postgresql") from e
        _conexion.add_notice_handler(_al_avisar)
    return _conexion


def cerrar() -> None:
    global _conexion
    if _conexion is not None:
        try:
            _conexion.close()
        finally:
            _conexion = None


@contextmanager
def transaccion():
    """BEGIN … COMMIT con hora de Bogotá. Si algo falla, ROLLBACK y error traducido."""
    with _candado:
        conn = conectar()
        _avisos.clear()
        try:
            with conn.transaction():
                conn.execute("SET LOCAL TIME ZONE 'America/Bogota'")
                yield conn
        except psycopg.OperationalError as e:
            cerrar()   # la próxima llamada reconecta
            raise ErrorCuevana(503, f"Se perdió la conexión con PostgreSQL: {str(e).splitlines()[0]}",
                               "postgresql") from e
        except psycopg.Error as e:
            raise traducir_pg(e) from e


def avisos() -> list[str]:
    """Mensajes RAISE NOTICE de la última transacción (llamar dentro del bloque with)."""
    return list(_avisos)


def consultar(sql, parametros=None) -> list[dict]:
    with transaccion() as conn:
        cur = conn.execute(sql, parametros)
        return cur.fetchall() if cur.description else []


def uno(sql, parametros=None) -> dict | None:
    filas = consultar(sql, parametros)
    return filas[0] if filas else None


def ping() -> dict:
    fila = uno("SELECT current_database() AS base, version() AS version, LOCALTIMESTAMP(0) AS hora_bogota")
    return {"conectado": True, "base": fila["base"], "version": fila["version"].split(",")[0],
            "hora_bogota": fila["hora_bogota"]}
