"""Convierte resultados de PostgreSQL y MongoDB a JSON (respuestas de la API y tablas del notebook)."""
from datetime import date, datetime, time
from decimal import Decimal

from bson import Decimal128, ObjectId


def a_json(valor):
    if isinstance(valor, dict):
        return {str(k): a_json(v) for k, v in valor.items()}
    if isinstance(valor, (list, tuple, set)):
        return [a_json(v) for v in valor]
    if isinstance(valor, ObjectId):
        return str(valor)
    if isinstance(valor, Decimal128):
        valor = valor.to_decimal()
    if isinstance(valor, Decimal):
        return int(valor) if valor == valor.to_integral_value() else float(valor)
    if isinstance(valor, (datetime, date, time)):
        return valor.isoformat()
    return valor


def responder(datos, estado: int = 200):
    """Respuesta JSON de la API con los tipos de las dos bases ya convertidos."""
    from fastapi.responses import JSONResponse
    return JSONResponse(a_json(datos), status_code=estado)
