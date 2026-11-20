"""Conexión a MongoDB Atlas (un cliente por proceso, pool pequeño por el tier FREE: caso C10)."""
from contextlib import contextmanager

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from . import config
from .errores import ErrorCuevana, traducir_mongo

_cliente: MongoClient | None = None


def cliente() -> MongoClient:
    global _cliente
    if _cliente is None:
        url = config.mongo_url()
        if not url:
            raise ErrorCuevana(503, "Falta MONGO_URL (en .env o en los Secretos de Colab).", "mongodb")
        _cliente = MongoClient(url, serverSelectionTimeoutMS=15000, maxPoolSize=5, tz_aware=True,
                               appname="cuevanacinema-integracion")
    return _cliente


def bd():
    return cliente()[config.mongo_db()]


@contextmanager
def operacion():
    """Envuelve una operación de MongoDB y traduce su error al formato común."""
    try:
        yield bd()
    except ErrorCuevana:
        raise
    except PyMongoError as e:
        raise traducir_mongo(e) from e


def ping() -> dict:
    with operacion() as db:
        info = db.client.server_info()
        colecciones = sorted(db.list_collection_names())
    return {"conectado": True, "base": config.mongo_db(), "version": info.get("version"),
            "colecciones": colecciones}
