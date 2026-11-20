"""API REST de CuevanaCinema sobre PostgreSQL (Neon) y MongoDB (Atlas), para probar con Postman.

Arranque (desde integracion-python/):  uvicorn api.main:app --port 8000
Documentación interactiva:              http://localhost:8000/docs
"""
import importlib

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field

from cuevana import db_mongo, db_pg, integracion
from cuevana.errores import ErrorCuevana
from cuevana.serializar import responder

app = FastAPI(title="CuevanaCinema · Integración PostgreSQL + MongoDB", version="1.0.0")


@app.exception_handler(ErrorCuevana)
def _error_cuevana(_: Request, e: ErrorCuevana):
    return responder(e.a_dict(), e.estado)


@app.exception_handler(RequestValidationError)
def _peticion_invalida(_: Request, e: RequestValidationError):
    errores = [f"{'.'.join(str(x) for x in err['loc'])}: {err['msg']}" for err in e.errors()]
    return responder({"error": {"estado": 400, "mensaje": "Petición inválida.", "motor": "api", "detalle": errores}},
                     400)


# ── Routers de cada integrante: si su archivo todavía no está, la API arranca igual ──
ROUTERS = ["api.rutas_consultas", "api.rutas_integridad", "api.rutas_crud"]   # CRUD al final: /pg/{tabla}
cargados = []
for modulo in ROUTERS:
    try:
        app.include_router(importlib.import_module(modulo).router)
        cargados.append(modulo)
    except ModuleNotFoundError as e:
        if e.name != modulo:
            raise


@app.get("/", tags=["Estado"])
def estado():
    """Estado de las dos conexiones y lista de rutas."""
    resultado = {}
    for motor, ping in (("postgresql", db_pg.ping), ("mongodb", db_mongo.ping)):
        try:
            resultado[motor] = ping()
        except ErrorCuevana as e:
            resultado[motor] = {"conectado": False, "mensaje": e.mensaje}
    rutas = sorted({f"{m} {r.path}" for r in app.routes for m in getattr(r, "methods", []) or []
                    if m != "HEAD" and not r.path.startswith(("/docs", "/openapi", "/redoc"))})
    return responder({"api": "CuevanaCinema", "modulos": cargados, **resultado, "rutas": rutas})


# ── Integración entre motores ───────────────────────────────────────────────
class Requisitos(BaseModel):
    experiencias: list[str]
    requisitos: list[dict]
    dcp: dict


class ProgramarFuncion(BaseModel):
    id_sala: int
    id_pelicula: int
    fecha_hora_inicio: str = Field(description="Hora de Bogotá, AAAA-MM-DD HH:MM")
    tipo: str = "REGULAR"
    version: str = "DOBLADA"
    requisitos: Requisitos | None = None


class Resena(BaseModel):
    id_espectador: int
    id_pelicula: int
    autor_alias: str
    calificacion: int
    texto: str
    id_venta: int | None = None
    titulo: str | None = None
    canal: str | None = None
    contiene_spoilers: bool | None = None
    etiquetas: list[str] | None = None
    aspectos: dict[str, int] | None = None


class Cancelacion(BaseModel):
    motivo: str


@app.get("/integracion/peliculas/{id_pelicula}", tags=["Integración"])
def pelicula(id_pelicula: int):
    """Película y funciones (PostgreSQL) + ficha técnica y reseñas (MongoDB)."""
    return responder(integracion.pelicula(id_pelicula))


@app.get("/integracion/funciones/{id_funcion}", tags=["Integración"])
def funcion(id_funcion: int):
    """Función, ventas y ocupación (PostgreSQL) + requisitos, incidentes y reseñas (MongoDB)."""
    return responder(integracion.funcion(id_funcion))


@app.post("/integracion/funciones", tags=["Integración"])
def programar_funcion(datos: ProgramarFuncion):
    """Programa la función en PostgreSQL (lo valida trg_funciones_validar) y sus requisitos en MongoDB."""
    return responder(integracion.programar_funcion(datos.model_dump(exclude_none=True)), 201)


@app.post("/integracion/funciones/{id_funcion}/requisitos", tags=["Integración"])
def crear_requisitos(id_funcion: int, datos: Requisitos):
    """Crea los requisitos técnicos copiando de PostgreSQL los datos de la función."""
    return responder(integracion.crear_requisitos(id_funcion, **datos.model_dump()), 201)


@app.post("/integracion/funciones/{id_funcion}/cancelar", tags=["Integración"])
def cancelar_funcion(id_funcion: int, datos: Cancelacion):
    """sp_cancelar_funcion en PostgreSQL y después los requisitos de MongoDB a NO_APLICA."""
    return responder(integracion.cancelar_funcion(id_funcion, datos.motivo))


@app.post("/integracion/resenas", tags=["Integración"])
def publicar_resena(datos: Resena):
    """Publica una reseña después de comprobar en PostgreSQL el espectador, la película y la venta."""
    return responder(integracion.publicar_resena(datos.model_dump(exclude_none=True)), 201)
