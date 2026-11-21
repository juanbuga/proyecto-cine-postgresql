"""Conexiones a los dos motores de CuevanaCinema.

- PostgreSQL (Neon): datos transaccionales (películas, funciones, ventas...).
- MongoDB (Atlas): datos flexibles (fichas técnicas, reseñas, incidentes...).

Las credenciales se leen del archivo .env (ver .env.example). Este módulo se
puede ejecutar solo para comprobar que los dos motores responden:

    python conexiones.py
"""
import os
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv

CARPETA = Path(__file__).resolve().parent
load_dotenv(CARPETA / ".env")

ZONA_HORARIA = "America/Bogota"   # los TIMESTAMP de PostgreSQL están en hora de Bogotá

_conexion_pg = None
_cliente_mongo = None


class ErrorConexion(Exception):
    """Error legible cuando un motor no está disponible o faltan credenciales."""


def _variable(nombre: str, defecto: str | None = None) -> str:
    valor = os.getenv(nombre, defecto)
    if not valor:
        raise ErrorConexion(f"Falta la variable {nombre}. Copie .env.example como .env y complétela.")
    return valor


# ------------------------------------------------------------------ PostgreSQL
def conectar_postgres():
    """Devuelve una conexión abierta a PostgreSQL (la reutiliza si ya existe)."""
    global _conexion_pg
    if _conexion_pg is None or _conexion_pg.closed:
        try:
            # connect_timeout amplio: Neon suspende la base inactiva y tarda en despertar.
            _conexion_pg = psycopg2.connect(_variable("PG_URL"), connect_timeout=30,
                                            cursor_factory=RealDictCursor)
        except psycopg2.OperationalError as e:
            raise ErrorConexion(f"No se pudo conectar a PostgreSQL: {str(e).strip().splitlines()[0]}") from e
        with _conexion_pg.cursor() as cur:
            cur.execute("SET TIME ZONE %s", (ZONA_HORARIA,))
        _conexion_pg.commit()
    return _conexion_pg


# --------------------------------------------------------------------- MongoDB
def conectar_mongo():
    """Devuelve la base de datos de MongoDB (el cliente se crea una sola vez)."""
    global _cliente_mongo
    if _cliente_mongo is None:
        _cliente_mongo = MongoClient(_variable("MONGO_URL"), serverSelectionTimeoutMS=15000,
                                     tz_aware=True, appname="cuevanacinema-entrega-final")
    try:
        _cliente_mongo.admin.command("ping")
    except PyMongoError as e:
        raise ErrorConexion(f"No se pudo conectar a MongoDB: {str(e).splitlines()[0][:200]}") from e
    return _cliente_mongo[_variable("MONGO_DB", "cine_avance2")]


def cerrar_conexiones() -> None:
    global _conexion_pg, _cliente_mongo
    if _conexion_pg is not None and not _conexion_pg.closed:
        _conexion_pg.close()
    if _cliente_mongo is not None:
        _cliente_mongo.close()
    _conexion_pg = _cliente_mongo = None


# -------------------------------------------------------------------- Prueba
TABLAS_PG = ["sedes", "salas", "peliculas", "funciones", "espectadores", "ventas"]


def probar_conexiones() -> bool:
    """Se conecta a los dos motores y muestra un resumen. Devuelve True si ambos responden."""
    todo_bien = True

    print("== PostgreSQL ==")
    try:
        conn = conectar_postgres()
        with conn.cursor() as cur:
            cur.execute("SELECT current_database() AS base, version() AS version, "
                        "LOCALTIMESTAMP(0) AS hora")
            info = cur.fetchone()
            print(f"  Base:    {info['base']}")
            print(f"  Versión: {info['version'].split(',')[0]}")
            print(f"  Hora:    {info['hora']} ({ZONA_HORARIA})")
            for tabla in TABLAS_PG:
                cur.execute(f"SELECT COUNT(*) AS n FROM {tabla}")
                print(f"  {tabla:<13} {cur.fetchone()['n']:>5} filas")
        conn.rollback()
    except (ErrorConexion, psycopg2.Error) as e:
        print(f"  ERROR: {e}")
        todo_bien = False

    print("== MongoDB ==")
    try:
        db = conectar_mongo()
        print(f"  Base:    {db.name}")
        print(f"  Versión: {db.client.server_info()['version']}")
        for nombre in sorted(db.list_collection_names()):
            print(f"  {nombre:<24} {db[nombre].estimated_document_count():>5} documentos")
    except (ErrorConexion, PyMongoError) as e:
        print(f"  ERROR: {e}")
        todo_bien = False

    print("\nResultado:", "los dos motores responden." if todo_bien else "hay motores sin conexión.")
    return todo_bien


if __name__ == "__main__":
    try:
        ok = probar_conexiones()
    finally:
        cerrar_conexiones()
    sys.exit(0 if ok else 1)
