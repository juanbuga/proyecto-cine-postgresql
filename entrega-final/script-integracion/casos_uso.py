"""Casos de uso de integración (requerimiento 2).

Cada caso consulta PostgreSQL y MongoDB por separado y combina los resultados en
Python usando los identificadores compartidos (id_pelicula, id_funcion, id_sala).
Entre los dos motores no hay JOIN posible: la "llave foránea" se resuelve aquí.

    1. funcion_con_resenas(id_funcion)       función + ventas (PG)  + reseñas (Mongo)
    2. pelicula_con_requisitos(id_pelicula)  película + funciones (PG) + ficha y requisitos técnicos (Mongo)
    3. ventas_vs_incidentes_por_sala()       ventas por sala (PG)   + incidentes por sala (Mongo)

Ejecución directa:  python casos_uso.py
"""
import sys
from datetime import timedelta, timezone

from conexiones import ErrorConexion, cerrar_conexiones, conectar_mongo, conectar_postgres

BOGOTA = timezone(timedelta(hours=-5), "America/Bogota")   # Colombia no tiene horario de verano


class CasoNoEncontrado(Exception):
    """El identificador pedido no existe en PostgreSQL."""


def _pg(sql: str, parametros=None) -> list[dict]:
    """Consulta de solo lectura en PostgreSQL; devuelve una lista de diccionarios."""
    conn = conectar_postgres()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, parametros)
            return [dict(f) for f in cur.fetchall()]
    finally:
        conn.rollback()   # solo lectura: cierra la transacción implícita


def a_bogota(fecha):
    """Fecha UTC de MongoDB -> hora de Bogotá sin zona, para compararla con PostgreSQL."""
    return fecha.astimezone(BOGOTA).replace(tzinfo=None) if fecha else None


# --------------------------------------------------------------------------- 1
def funcion_con_resenas(id_funcion: int) -> dict:
    """Una función con su ocupación e ingresos (PostgreSQL) y las reseñas que recibió (MongoDB)."""
    filas = _pg(
        """SELECT f.id_funcion, f.fecha_hora_inicio, f.tipo, f.version, f.estado,
                  p.id_pelicula, p.titulo, sa.id_sala, sa.numero AS sala, sa.formato, sa.capacidad,
                  se.nombre AS sede,
                  COALESCE(SUM(v.cantidad) FILTER (WHERE v.estado = 'PAGADA'), 0) AS boletas_pagadas,
                  COALESCE(SUM(v.cantidad * v.precio_unitario) FILTER (WHERE v.estado = 'PAGADA'), 0) AS ingresos
             FROM funciones f
             JOIN peliculas p ON p.id_pelicula = f.id_pelicula
             JOIN salas sa    ON sa.id_sala = f.id_sala
             JOIN sedes se    ON se.id_sede = sa.id_sede
             LEFT JOIN ventas v ON v.id_funcion = f.id_funcion
            WHERE f.id_funcion = %s
            GROUP BY f.id_funcion, p.id_pelicula, sa.id_sala, se.id_sede""", (id_funcion,))
    if not filas:
        raise CasoNoEncontrado(f"No existe la función {id_funcion} en PostgreSQL.")
    funcion = filas[0]
    funcion["ocupacion_pct"] = round(100 * funcion["boletas_pagadas"] / funcion["capacidad"], 1)

    db = conectar_mongo()
    resenas = list(db.resenas_peliculas.find(
        {"id_funcion": id_funcion, "estado_moderacion": "PUBLICADA"},
        {"_id": 0, "autor_alias": 1, "calificacion": 1, "titulo": 1, "compra_verificada": 1, "fecha": 1},
    ).sort("fecha", -1))
    promedio = round(sum(r["calificacion"] for r in resenas) / len(resenas), 2) if resenas else None

    return {
        "caso": "Función con sus reseñas",
        "postgresql": funcion,
        "mongodb": {"resenas_publicadas": len(resenas), "calificacion_promedio": promedio, "resenas": resenas},
        "combinado": {
            "funcion": f"{funcion['titulo']} · sala {funcion['sala']} ({funcion['formato']}) · {funcion['sede']}",
            "ocupacion_pct": funcion["ocupacion_pct"],
            "calificacion_promedio": promedio,
            "resenas_con_compra_verificada": sum(1 for r in resenas if r.get("compra_verificada")),
        },
    }


# --------------------------------------------------------------------------- 2
def pelicula_con_requisitos(id_pelicula: int) -> dict:
    """La película y sus funciones (PostgreSQL) con su ficha técnica y los requisitos
    técnicos de proyección de cada función (MongoDB)."""
    peli = _pg("SELECT id_pelicula, titulo, genero, duracion_min, edad_minima, estado "
               "FROM peliculas WHERE id_pelicula = %s", (id_pelicula,))
    if not peli:
        raise CasoNoEncontrado(f"No existe la película {id_pelicula} en PostgreSQL.")
    funciones = _pg(
        """SELECT f.id_funcion, f.fecha_hora_inicio, f.tipo, f.version, f.estado,
                  sa.id_sala, sa.numero AS sala, sa.formato, se.nombre AS sede
             FROM funciones f
             JOIN salas sa ON sa.id_sala = f.id_sala
             JOIN sedes se ON se.id_sede = sa.id_sede
            WHERE f.id_pelicula = %s
            ORDER BY f.fecha_hora_inicio""", (id_pelicula,))

    db = conectar_mongo()
    ficha = db.fichas_tecnicas_peliculas.find_one(
        {"id_pelicula": id_pelicula},
        {"_id": 0, "titulo_original": 1, "anio": 1, "generos": 1, "direccion": 1, "versiones": 1,
         "idiomas_audio": 1, "subtitulos": 1, "clasificaciones": 1})
    requisitos = {
        r["id_funcion"]: r for r in db.requisitos_proyeccion.find(
            {"id_funcion": {"$in": [f["id_funcion"] for f in funciones]}},
            {"_id": 0, "id_funcion": 1, "funcion": 1, "experiencias": 1, "requisitos": 1,
             "dcp.resolucion": 1, "dcp.cifrado": 1, "verificacion.estado": 1})
    }

    # Unión en Python: a cada función de PostgreSQL se le pegan sus requisitos de MongoDB
    detalle, sin_requisitos, copias_distintas = [], [], []
    for f in funciones:
        r = requisitos.get(f["id_funcion"])
        if r is None:
            sin_requisitos.append(f["id_funcion"])
        elif a_bogota(r["funcion"]["fecha_hora_inicio"]) != f["fecha_hora_inicio"]:
            copias_distintas.append(f["id_funcion"])   # la copia en Mongo quedó desactualizada
        detalle.append({
            **f,
            "experiencias": r["experiencias"] if r else None,
            "componentes": [q["componente"] for q in r["requisitos"]] if r else None,
            "dcp": r["dcp"] if r else None,
            "verificacion": r["verificacion"]["estado"] if r else "SIN_REQUISITOS",
        })

    return {
        "caso": "Película con sus requisitos técnicos",
        "postgresql": {"pelicula": peli[0], "funciones": len(funciones)},
        "mongodb": {"ficha_tecnica": ficha, "funciones_con_requisitos": len(requisitos)},
        "combinado": {
            "funciones": detalle,
            "funciones_sin_requisitos": sin_requisitos,
            "copias_desactualizadas": copias_distintas,
        },
    }


# --------------------------------------------------------------------------- 3
def ventas_vs_incidentes_por_sala() -> dict:
    """Cruce de ventas (PostgreSQL) con incidentes reportados (MongoDB) en cada sala."""
    ventas = _pg(
        """SELECT sa.id_sala, se.nombre AS sede, sa.numero AS sala, sa.formato,
                  COUNT(DISTINCT f.id_funcion) AS funciones,
                  COALESCE(SUM(v.cantidad) FILTER (WHERE v.estado = 'PAGADA'), 0) AS boletas,
                  COALESCE(SUM(v.cantidad * v.precio_unitario) FILTER (WHERE v.estado = 'PAGADA'), 0) AS ingresos
             FROM salas sa
             JOIN sedes se          ON se.id_sede = sa.id_sede
             LEFT JOIN funciones f  ON f.id_sala = sa.id_sala
             LEFT JOIN ventas v     ON v.id_funcion = f.id_funcion
            GROUP BY sa.id_sala, se.nombre
            ORDER BY sa.id_sala""")

    db = conectar_mongo()
    incidentes = {
        i["_id"]: i for i in db.reportes_incidentes.aggregate([
            {"$match": {"id_sala": {"$ne": None}}},
            {"$group": {
                "_id": "$id_sala",
                "total": {"$sum": 1},
                "abiertos": {"$sum": {"$cond": [{"$in": ["$estado", ["ABIERTO", "EN_PROCESO"]]}, 1, 0]}},
                "alta_o_critica": {"$sum": {"$cond": [{"$in": ["$prioridad", ["ALTA", "CRITICA"]]}, 1, 0]}},
                "afectaron_funcion": {"$sum": {"$cond": [{"$eq": ["$falla.afecta_funcion", True]}, 1, 0]}},
            }},
        ])
    }

    filas = []
    for s in ventas:
        inc = incidentes.get(s["id_sala"], {})
        total = inc.get("total", 0)
        filas.append({
            **s,
            "incidentes": total,
            "abiertos": inc.get("abiertos", 0),
            "alta_o_critica": inc.get("alta_o_critica", 0),
            "afectaron_funcion": inc.get("afectaron_funcion", 0),
            "incidentes_x_100_boletas": round(100 * total / s["boletas"], 2) if s["boletas"] else None,
        })
    filas.sort(key=lambda f: (-(f["incidentes"]), -f["ingresos"]))

    return {
        "caso": "Cruce de ventas con incidentes por sala",
        "postgresql": {"salas": len(ventas), "boletas": sum(s["boletas"] for s in ventas)},
        "mongodb": {"incidentes_con_sala": sum(i["total"] for i in incidentes.values())},
        "combinado": filas,
    }


# ------------------------------------------------- plantilla para la sustentación
def caso_nuevo(id_sede: int = 1) -> dict:
    """PLANTILLA para resolver en vivo el caso adicional que proponga el docente.

    Ejemplo ya armado: espectadores con más boletas en una sede (PostgreSQL) y sus reseñas (MongoDB).
    Para otro caso se cambian las dos consultas y el campo de unión; el patrón es siempre el mismo.
    """
    # 1. PostgreSQL: obtener las filas y los ids que se van a cruzar
    filas = _pg(
        """SELECT e.id_espectador, e.nombres || ' ' || e.apellidos AS espectador,
                  SUM(v.cantidad) AS boletas
             FROM ventas v
             JOIN espectadores e ON e.id_espectador = v.id_espectador
             JOIN funciones f    ON f.id_funcion = v.id_funcion
             JOIN salas sa       ON sa.id_sala = f.id_sala
            WHERE sa.id_sede = %s AND v.estado = 'PAGADA'
            GROUP BY e.id_espectador
            ORDER BY boletas DESC
            LIMIT 5""", (id_sede,))
    ids = [f["id_espectador"] for f in filas]

    # 2. MongoDB: traer los documentos de esos ids (find con $in o aggregate con $group)
    por_id = {d["_id"]: d for d in conectar_mongo().resenas_peliculas.aggregate([
        {"$match": {"id_espectador": {"$in": ids}}},
        {"$group": {"_id": "$id_espectador", "resenas": {"$sum": 1}, "promedio": {"$avg": "$calificacion"}}},
    ])}

    # 3. Unir en Python por el id compartido
    for f in filas:
        d = por_id.get(f["id_espectador"], {})
        f["resenas"] = d.get("resenas", 0)
        f["promedio"] = round(d["promedio"], 2) if d.get("promedio") is not None else None
    return {"caso": f"Mejores clientes de la sede {id_sede} y sus reseñas", "combinado": filas}


# ----------------------------------------------------------------- impresión
def imprimir_caso_1(r: dict) -> None:
    c = r["combinado"]
    print(f"\n[1] {r['caso']}: {c['funcion']}")
    print(f"    PostgreSQL -> inicio {r['postgresql']['fecha_hora_inicio']}, {r['postgresql']['boletas_pagadas']} boletas, "
          f"ingresos ${r['postgresql']['ingresos']:,.0f}, ocupación {c['ocupacion_pct']} %")
    print(f"    MongoDB    -> {r['mongodb']['resenas_publicadas']} reseñas publicadas, promedio {c['calificacion_promedio']}"
          f" ({c['resenas_con_compra_verificada']} con compra verificada)")
    for res in r["mongodb"]["resenas"]:
        print(f"       * {res['calificacion']}/5  {res['autor_alias']}: {res.get('titulo', '')}")


def imprimir_caso_2(r: dict) -> None:
    p, ficha = r["postgresql"]["pelicula"], r["mongodb"]["ficha_tecnica"] or {}
    print(f"\n[2] {r['caso']}: {p['titulo']} ({ficha.get('titulo_original', 's. d.')}, {ficha.get('anio', '?')})")
    print(f"    PostgreSQL -> {p['genero']}, {p['duracion_min']} min, +{p['edad_minima']}, {r['postgresql']['funciones']} funciones")
    print(f"    MongoDB    -> géneros {ficha.get('generos')}, audio {ficha.get('idiomas_audio')}, "
          f"{r['mongodb']['funciones_con_requisitos']} funciones con requisitos")
    for f in r["combinado"]["funciones"]:
        dcp = f["dcp"] or {}
        print(f"       * función {f['id_funcion']:>2} {f['fecha_hora_inicio']} sala {f['sala']} {f['formato']} "
              f"[{f['estado']}] -> {f['componentes']} DCP {dcp.get('resolucion', '-')} verificación {f['verificacion']}")
    if r["combinado"]["funciones_sin_requisitos"]:
        print(f"    Funciones sin requisitos en MongoDB: {r['combinado']['funciones_sin_requisitos']}")


def imprimir_caso_3(r: dict) -> None:
    print(f"\n[3] {r['caso']}  (PG: {r['postgresql']['boletas']} boletas · Mongo: {r['mongodb']['incidentes_con_sala']} incidentes)")
    print(f"    {'sede':<25}{'sala':>4} {'fmt':>3} {'func':>5} {'boletas':>8} {'ingresos':>12} {'incid':>6} "
          f"{'abiert':>6} {'alta+':>6} {'x100bol':>8}")
    for f in r["combinado"]:
        print(f"    {f['sede']:<25}{f['sala']:>4} {f['formato']:>3} {f['funciones']:>5} {f['boletas']:>8} "
              f"{f['ingresos']:>12,.0f} {f['incidentes']:>6} {f['abiertos']:>6} {f['alta_o_critica']:>6} "
              f"{str(f['incidentes_x_100_boletas']):>8}")


if __name__ == "__main__":
    try:
        imprimir_caso_1(funcion_con_resenas(int(sys.argv[1]) if len(sys.argv) > 1 else 1))
        imprimir_caso_2(pelicula_con_requisitos(int(sys.argv[2]) if len(sys.argv) > 2 else 8))
        imprimir_caso_3(ventas_vs_incidentes_por_sala())
    except (ErrorConexion, CasoNoEncontrado) as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        cerrar_conexiones()
