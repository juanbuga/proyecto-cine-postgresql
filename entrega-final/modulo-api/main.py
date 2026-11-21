"""API REST de CuevanaCinema: expone la integración PostgreSQL + MongoDB (requerimiento 4).

No duplica lógica: importa los módulos de ../script-integracion
(conexiones, casos_uso, transaccion).

Arranque (desde entrega-final/modulo-api):
    uvicorn main:app --port 8000
Documentación interactiva:  http://localhost:8000/docs
"""
import sys
import threading
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Literal

import psycopg2
from bson import Decimal128, ObjectId
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pymongo.errors import PyMongoError
from starlette.exceptions import HTTPException as StarletteHTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "script-integracion"))

import casos_uso      # noqa: E402
import conexiones     # noqa: E402
import transaccion    # noqa: E402

app = FastAPI(
    title="CuevanaCinema · API de integración PostgreSQL + MongoDB",
    version="1.0.0",
    description="Casos de uso que combinan los dos motores y venta con transacción cruzada.",
)

# psycopg2 comparte una sola conexión: se atiende una petición a la vez sobre la base.
_candado = threading.Lock()


# ------------------------------------------------------------------ utilidades
def _json(valor):
    """Convierte tipos de PostgreSQL/MongoDB (Decimal, Decimal128, ObjectId, fechas) a JSON."""
    if isinstance(valor, dict):
        return {k: _json(v) for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [_json(v) for v in valor]
    if isinstance(valor, Decimal128):
        return float(valor.to_decimal())
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, ObjectId):
        return str(valor)
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    return valor


def _error(estado: int, motor: str, mensaje: str, detalle=None) -> JSONResponse:
    cuerpo = {"error": {"estado": estado, "motor": motor, "mensaje": mensaje}}
    if detalle:
        cuerpo["error"]["detalle"] = detalle
    return JSONResponse(cuerpo, status_code=estado)


# ---------------------------------------------------------- manejo de errores
@app.exception_handler(RequestValidationError)
def _peticion_invalida(_: Request, e: RequestValidationError):
    detalle = [f"{'.'.join(str(x) for x in err['loc'])}: {err['msg']}" for err in e.errors()]
    return _error(400, "api", "Petición inválida.", detalle)


@app.exception_handler(StarletteHTTPException)
def _http(_: Request, e: StarletteHTTPException):
    return _error(e.status_code, "api", "Ruta no encontrada." if e.status_code == 404 else str(e.detail))


@app.exception_handler(casos_uso.CasoNoEncontrado)
def _no_encontrado(_: Request, e: casos_uso.CasoNoEncontrado):
    return _error(404, "postgresql", str(e))


@app.exception_handler(transaccion.VentaRechazada)
def _venta_rechazada(_: Request, e: transaccion.VentaRechazada):
    return _error(422, e.motor, e.mensaje,
                  "La venta no quedó en ningún motor (todo o nada).")


@app.exception_handler(conexiones.ErrorConexion)
def _sin_conexion(_: Request, e: conexiones.ErrorConexion):
    motor = "mongodb" if "MongoDB" in str(e) or "MONGO" in str(e) else "postgresql"
    return _error(503, motor, str(e))


@app.exception_handler(psycopg2.Error)
def _error_pg(_: Request, e: psycopg2.Error):
    conexiones.cerrar_conexiones()   # la próxima petición reconecta
    return _error(503, "postgresql", f"Error de PostgreSQL: {str(e).strip().splitlines()[0]}")


@app.exception_handler(PyMongoError)
def _error_mongo(_: Request, e: PyMongoError):
    return _error(503, "mongodb", f"Error de MongoDB: {type(e).__name__}")


@app.exception_handler(Exception)
def _inesperado(_: Request, e: Exception):
    return _error(500, "api", f"Error inesperado: {type(e).__name__}")


# --------------------------------------------------------------------- rutas
@app.get("/", tags=["Estado"])
def estado():
    """Estado de las dos conexiones."""
    resultado = {"api": "CuevanaCinema", "postgresql": {}, "mongodb": {}}
    with _candado:
        try:
            conn = conexiones.conectar_postgres()
            with conn.cursor() as cur:
                cur.execute("SELECT current_database() AS base, LOCALTIMESTAMP(0) AS hora_bogota")
                resultado["postgresql"] = {"conectado": True, **cur.fetchone()}
            conn.rollback()
        except (conexiones.ErrorConexion, psycopg2.Error) as e:
            conexiones.cerrar_conexiones()
            resultado["postgresql"] = {"conectado": False, "mensaje": str(e)}
        try:
            db = conexiones.conectar_mongo()
            resultado["mongodb"] = {"conectado": True, "base": db.name,
                                    "colecciones": sorted(db.list_collection_names())}
        except (conexiones.ErrorConexion, PyMongoError) as e:
            resultado["mongodb"] = {"conectado": False, "mensaje": str(e)}
    ok = resultado["postgresql"]["conectado"] and resultado["mongodb"]["conectado"]
    return JSONResponse(_json(resultado), status_code=200 if ok else 503)


@app.get("/funciones/{id_funcion}/resenas", tags=["Casos de uso"])
def caso_1_funcion_con_resenas(id_funcion: int):
    """Caso 1: función con ocupación e ingresos (PostgreSQL) y sus reseñas (MongoDB)."""
    with _candado:
        return _json(casos_uso.funcion_con_resenas(id_funcion))


@app.get("/peliculas/{id_pelicula}/requisitos", tags=["Casos de uso"])
def caso_2_pelicula_con_requisitos(id_pelicula: int):
    """Caso 2: película y funciones (PostgreSQL) con ficha y requisitos técnicos (MongoDB)."""
    with _candado:
        return _json(casos_uso.pelicula_con_requisitos(id_pelicula))


@app.get("/salas/ventas-incidentes", tags=["Casos de uso"])
def caso_3_ventas_vs_incidentes():
    """Caso 3: ventas por sala (PostgreSQL) cruzadas con incidentes por sala (MongoDB)."""
    with _candado:
        return _json(casos_uso.ventas_vs_incidentes_por_sala())


class VentaEntrada(BaseModel):
    id_funcion: int
    id_espectador: int
    id_tipo_boleta: int
    cantidad: int = Field(description="Entre 1 y 10 (lo valida PostgreSQL)")
    canal: Literal["WEB", "TAQUILLA"] = "WEB"
    id_staff: int | None = Field(default=None, description="Obligatorio solo en TAQUILLA")
    simular_fallo_mongo: bool = Field(default=False,
                                      description="Demo: MongoDB rechaza el comprobante y se hace ROLLBACK en PostgreSQL")


@app.post("/ventas", status_code=201, tags=["Transacción cruzada"])
def registrar_venta(venta: VentaEntrada):
    """Registra la venta en PostgreSQL y su comprobante en MongoDB (todo o nada)."""
    with _candado:
        return _json(transaccion.registrar_venta(**venta.model_dump()))


@app.get("/ventas/{id_venta}/verificacion", tags=["Transacción cruzada"])
def verificar_venta(id_venta: int):
    """Comprueba que la venta exista y coincida en los dos motores."""
    with _candado:
        r = transaccion.verificar_venta(id_venta)
    if not r["en_postgresql"] and not r["en_mongodb"]:
        return _error(404, "integracion", f"La venta {id_venta} no existe en ningún motor.")
    return {"id_venta": id_venta, **r}


@app.get("/demo/datos-venta", tags=["Transacción cruzada"])
def datos_para_vender():
    """Devuelve una función futura con cupo, su boleta GENERAL y un espectador válido (para Postman)."""
    with _candado:
        datos = transaccion.buscar_datos_de_prueba()
    if not datos:
        return _error(404, "postgresql", "No hay funciones PROGRAMADAS futuras con cupo.")
    return datos


@app.on_event("shutdown")
def _cerrar():
    conexiones.cerrar_conexiones()
