"""Operaciones que cruzan PostgreSQL y MongoDB.

Entre los dos motores no hay llaves foráneas ni transacción común. Por eso:
- antes de escribir en MongoDB se comprueba en PostgreSQL que los ids existan (caso C3);
- se escribe primero en PostgreSQL y después en MongoDB, y si MongoDB falla se
  compensa (se deshace lo de PostgreSQL) o se deja marcado para sincronizar (caso C2);
- los datos copiados en MongoDB (fecha de la función, título) salen siempre de PostgreSQL.
"""
import json
import time

from bson import json_util

from . import config, db_mongo, db_pg
from .errores import ErrorCuevana


def _bson(valor):
    """Acepta JSON extendido ({"$date": ...}, {"$numberDecimal": ...}) y lo pasa a tipos BSON."""
    return json_util.loads(json.dumps(valor)) if valor is not None else None


def _requeridos(datos: dict, campos: list[str]) -> None:
    faltan = [c for c in campos if datos.get(c) in (None, "")]
    if faltan:
        raise ErrorCuevana(400, f"Faltan campos obligatorios: {', '.join(faltan)}", "api")


# ── Consultas entre motores ─────────────────────────────────────────────────
def pelicula(id_pelicula: int) -> dict:
    """La película y sus funciones (PostgreSQL) + ficha técnica y reseñas publicadas (MongoDB)."""
    p = db_pg.uno("SELECT * FROM peliculas WHERE id_pelicula = %s", (id_pelicula,))
    if not p:
        raise ErrorCuevana(404, f"No existe la película {id_pelicula} en PostgreSQL.", "postgresql")
    funciones = db_pg.consultar(
        """SELECT f.id_funcion, f.fecha_hora_inicio, f.tipo, f.version, f.estado,
                  sa.id_sala, sa.numero AS sala, sa.formato, se.nombre AS sede
             FROM funciones f
             JOIN salas sa ON sa.id_sala = f.id_sala
             JOIN sedes se ON se.id_sede = sa.id_sede
            WHERE f.id_pelicula = %s
            ORDER BY f.fecha_hora_inicio""", (id_pelicula,))
    with db_mongo.operacion() as db:
        ficha = db.fichas_tecnicas_peliculas.find_one({"id_pelicula": id_pelicula}, {"_id": 0})
        resenas = list(db.resenas_peliculas.find(
            {"id_pelicula": id_pelicula, "estado_moderacion": "PUBLICADA"},
            {"_id": 0, "autor_alias": 1, "calificacion": 1, "titulo": 1, "fecha": 1, "compra_verificada": 1}
        ).sort("fecha", -1))
    promedio = round(sum(r["calificacion"] for r in resenas) / len(resenas), 2) if resenas else None
    return {
        "id_pelicula": id_pelicula,
        "postgresql": {"pelicula": p, "funciones": funciones},
        "mongodb": {"ficha_tecnica": ficha,
                    "resenas": {"total": len(resenas), "promedio": promedio, "lista": resenas}},
    }


def funcion(id_funcion: int) -> dict:
    """La función, sus ventas y ocupación (PostgreSQL) + requisitos, incidentes y reseñas (MongoDB)."""
    f = db_pg.uno(
        """SELECT f.*, p.titulo, p.edad_minima, sa.numero AS sala, sa.formato, sa.capacidad,
                  se.id_sede, se.nombre AS sede,
                  COALESCE((SELECT SUM(v.cantidad) FROM ventas v
                             WHERE v.id_funcion = f.id_funcion AND v.estado = 'PAGADA'), 0) AS boletas_pagadas,
                  COALESCE((SELECT SUM(v.cantidad * v.precio_unitario) FROM ventas v
                             WHERE v.id_funcion = f.id_funcion AND v.estado = 'PAGADA'), 0) AS ingresos
             FROM funciones f
             JOIN peliculas p ON p.id_pelicula = f.id_pelicula
             JOIN salas sa    ON sa.id_sala = f.id_sala
             JOIN sedes se    ON se.id_sede = sa.id_sede
            WHERE f.id_funcion = %s""", (id_funcion,))
    if not f:
        raise ErrorCuevana(404, f"No existe la función {id_funcion} en PostgreSQL.", "postgresql")
    f["ocupacion_pct"] = round(100 * f["boletas_pagadas"] / f["capacidad"], 1)
    with db_mongo.operacion() as db:
        requisitos = db.requisitos_proyeccion.find_one({"id_funcion": id_funcion}, {"_id": 0})
        incidentes = list(db.reportes_incidentes.find(
            {"id_funcion": id_funcion},
            {"_id": 0, "codigo": 1, "tipo": 1, "prioridad": 1, "estado": 1, "fecha_reporte": 1}))
        resenas = list(db.resenas_peliculas.find(
            {"id_funcion": id_funcion}, {"_id": 0, "autor_alias": 1, "calificacion": 1, "titulo": 1}))
    # La copia de la función en MongoDB debe coincidir con PostgreSQL
    diferencias = []
    if requisitos:
        copia = requisitos["funcion"]
        if config.utc_a_bogota(copia["fecha_hora_inicio"]) != f["fecha_hora_inicio"]:
            diferencias.append("funcion.fecha_hora_inicio")
        for campo in ("tipo", "version"):
            if copia[campo] != f[campo]:
                diferencias.append(f"funcion.{campo}")
        if f["estado"] == "CANCELADA" and requisitos["verificacion"]["estado"] != "NO_APLICA":
            diferencias.append("verificacion.estado (la función está CANCELADA)")
    return {
        "id_funcion": id_funcion,
        "postgresql": {"funcion": f},
        "mongodb": {"requisitos_proyeccion": requisitos, "incidentes": incidentes, "resenas": resenas},
        "copias_coinciden": not diferencias,
        "diferencias": diferencias,
    }


# ── Escrituras entre motores ────────────────────────────────────────────────
def crear_requisitos(id_funcion: int, experiencias: list, requisitos: list, dcp: dict) -> dict:
    """Crea los requisitos técnicos de una función copiando sus datos desde PostgreSQL."""
    f = db_pg.uno(
        """SELECT f.id_funcion, f.id_sala, sa.id_sede, f.id_pelicula, f.fecha_hora_inicio,
                  f.tipo, f.version, f.estado, sa.formato
             FROM funciones f JOIN salas sa ON sa.id_sala = f.id_sala
            WHERE f.id_funcion = %s""", (id_funcion,))
    if not f:
        raise ErrorCuevana(422, f"La función {id_funcion} no existe en PostgreSQL.", "integracion")
    if f["estado"] != "PROGRAMADA":
        raise ErrorCuevana(422, f"La función {id_funcion} está {f['estado']}; solo se preparan funciones PROGRAMADAS.",
                           "integracion")
    reqs = []
    for r in _bson(requisitos) or []:
        r = dict(r)
        r.setdefault("cumple", None)   # null = todavía no verificado
        reqs.append(r)
    doc = {
        "id_funcion": f["id_funcion"], "id_sala": f["id_sala"], "id_sede": f["id_sede"], "id_pelicula": f["id_pelicula"],
        "funcion": {"fecha_hora_inicio": config.bogota_a_utc(f["fecha_hora_inicio"]), "tipo": f["tipo"],
                    "version": f["version"], "formato_sala": f["formato"]},
        "experiencias": experiencias,
        "requisitos": reqs,
        "dcp": _bson(dcp),
        "verificacion": {"estado": "PENDIENTE"},
        "esquema_version": 1,
        "creado_en": config.ahora_utc(),
    }
    with db_mongo.operacion() as db:
        doc["_id"] = db.requisitos_proyeccion.insert_one(doc).inserted_id
    return doc


def programar_funcion(datos: dict) -> dict:
    """Programa una función en PostgreSQL y, si vienen, sus requisitos en MongoDB.

    Si MongoDB rechaza los requisitos, se borra la función de PostgreSQL (compensación):
    no queda una función a medias en un solo motor.
    """
    _requeridos(datos, ["id_sala", "id_pelicula", "fecha_hora_inicio"])
    with db_pg.transaccion() as conn:
        id_funcion = conn.execute(
            """INSERT INTO funciones (id_sala, id_pelicula, fecha_hora_inicio, tipo, version)
               VALUES (%s, %s, %s::timestamp, %s, %s) RETURNING id_funcion""",
            (datos["id_sala"], datos["id_pelicula"], datos["fecha_hora_inicio"],
             datos.get("tipo", "REGULAR"), datos.get("version", "DOBLADA"))).fetchone()["id_funcion"]
    resultado = {"id_funcion": id_funcion, "postgresql": "función programada", "requisitos": None}
    if datos.get("requisitos"):
        try:
            resultado["requisitos"] = crear_requisitos(id_funcion, **datos["requisitos"])
        except (ErrorCuevana, TypeError) as e:
            db_pg.consultar("DELETE FROM funciones WHERE id_funcion = %s", (id_funcion,))
            if isinstance(e, TypeError):
                e = ErrorCuevana(400, "requisitos debe traer experiencias, requisitos y dcp.", "api")
            e.detalle["compensacion"] = (f"Se borró la función {id_funcion} de PostgreSQL porque sus requisitos "
                                         "no se pudieron guardar en MongoDB.")
            raise e
    return resultado


def publicar_resena(datos: dict) -> dict:
    """Publica una reseña en MongoDB después de comprobar en PostgreSQL espectador, película y venta."""
    _requeridos(datos, ["id_espectador", "id_pelicula", "autor_alias", "calificacion", "texto"])
    id_esp, id_peli, id_venta = datos["id_espectador"], datos["id_pelicula"], datos.get("id_venta")
    id_funcion = None
    with db_pg.transaccion() as conn:
        if not conn.execute("SELECT 1 FROM espectadores WHERE id_espectador = %s", (id_esp,)).fetchone():
            raise ErrorCuevana(422, f"El espectador {id_esp} no existe en PostgreSQL.", "integracion")
        peli = conn.execute("SELECT titulo FROM peliculas WHERE id_pelicula = %s", (id_peli,)).fetchone()
        if not peli:
            raise ErrorCuevana(422, f"La película {id_peli} no existe en PostgreSQL.", "integracion")
        if id_venta is not None:
            v = conn.execute(
                """SELECT v.id_espectador, v.estado, f.id_funcion, f.id_pelicula, f.estado AS estado_funcion,
                          f.fecha_hora_inicio <= LOCALTIMESTAMP(0) AS ya_ocurrio
                     FROM ventas v JOIN funciones f ON f.id_funcion = v.id_funcion
                    WHERE v.id_venta = %s""", (id_venta,)).fetchone()
            if not v:
                raise ErrorCuevana(422, f"La venta {id_venta} no existe en PostgreSQL.", "integracion")
            if v["id_espectador"] != id_esp:
                raise ErrorCuevana(422, f"La venta {id_venta} no es del espectador {id_esp}.", "integracion")
            if v["id_pelicula"] != id_peli:
                raise ErrorCuevana(422, f"La venta {id_venta} es de otra película.", "integracion")
            if v["estado"] != "PAGADA":
                raise ErrorCuevana(422, f"La venta {id_venta} está {v['estado']}.", "integracion")
            if v["estado_funcion"] == "CANCELADA" or not v["ya_ocurrio"]:
                raise ErrorCuevana(422, "Solo se reseña con compra verificada una función que ya ocurrió.",
                                   "integracion")
            id_funcion = v["id_funcion"]
    doc = {
        "id_pelicula": id_peli,
        "pelicula_titulo": peli["titulo"],            # copia tomada de PostgreSQL
        "id_espectador": id_esp,
        "autor_alias": datos["autor_alias"],
        "compra_verificada": id_venta is not None,
        "id_venta": id_venta,
        "calificacion": datos["calificacion"],
        "texto": datos["texto"],
        "fecha": config.ahora_utc(),
        "estado_moderacion": "PUBLICADA",
        "esquema_version": 1,
    }
    if id_funcion is not None:
        doc["id_funcion"] = id_funcion
    for opcional in ("titulo", "aspectos", "contiene_spoilers", "etiquetas", "canal"):
        if datos.get(opcional) is not None:
            doc[opcional] = datos[opcional]
    with db_mongo.operacion() as db:
        doc["_id"] = db.resenas_peliculas.insert_one(doc).inserted_id
    return doc


def _requisitos_no_aplica(id_funcion: int, motivo: str, intentos: int) -> dict:
    ultimo = None
    for i in range(intentos):
        try:
            with db_mongo.operacion() as db:
                r = db.requisitos_proyeccion.update_one(
                    {"id_funcion": id_funcion, "verificacion.estado": {"$ne": "NO_APLICA"}},
                    {"$set": {"verificacion.estado": "NO_APLICA",
                              "verificacion.observaciones": f"Función cancelada en PostgreSQL: {motivo}"}})
            return {"sincronizado": True, "requisitos_actualizados": r.modified_count, "intentos": i + 1}
        except ErrorCuevana as e:
            ultimo = e
            time.sleep(0.5 * 2 ** i)
    return {"sincronizado": False, "intentos": intentos, "error": ultimo.mensaje if ultimo else None,
            "pendiente": "La función quedó cancelada en PostgreSQL. Ejecute POST /integracion/sincronizar-copias "
                         "para pasar sus requisitos a NO_APLICA en MongoDB."}


def cancelar_funcion(id_funcion: int, motivo: str, intentos: int = 3) -> dict:
    """sp_cancelar_funcion en PostgreSQL (todo o nada) y después los requisitos de MongoDB a NO_APLICA."""
    with db_pg.transaccion() as conn:
        conn.execute("CALL sp_cancelar_funcion(%s::int, %s::varchar)", (id_funcion, motivo))
        avisos = db_pg.avisos()
    return {"id_funcion": id_funcion,
            "postgresql": {"cancelada": True, "avisos": avisos},
            "mongodb": _requisitos_no_aplica(id_funcion, motivo, intentos)}
