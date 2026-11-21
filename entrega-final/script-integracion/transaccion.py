"""Transacción cruzada entre motores (requerimiento 3).

Evento de negocio: VENDER BOLETAS.
  - PostgreSQL: se registra la venta con sp_registrar_venta (valida función, aforo,
    formato, edad, precio vigente...).
  - MongoDB: en la misma operación se genera el comprobante de la venta en la
    colección comprobantes_venta (copia desnormalizada para consulta rápida).

PostgreSQL y MongoDB no comparten una transacción, así que se coordina a mano:

    1. BEGIN en PostgreSQL y CALL sp_registrar_venta     (sin COMMIT todavía)
    2. Insertar el comprobante en MongoDB
         - si MongoDB falla  -> ROLLBACK en PostgreSQL: la venta no queda en ningún motor
    3. COMMIT en PostgreSQL
         - si el COMMIT falla -> se borra el comprobante de MongoDB (compensación)

Resultado: o la venta queda en los dos motores, o en ninguno.

Ejecución directa (demo con camino feliz y dos rechazos):  python transaccion.py
"""
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import psycopg2
from bson.decimal128 import Decimal128
from pymongo.errors import CollectionInvalid, PyMongoError

from conexiones import ErrorConexion, cerrar_conexiones, conectar_mongo, conectar_postgres

BOGOTA = timezone(timedelta(hours=-5), "America/Bogota")
COLECCION = "comprobantes_venta"

VALIDADOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["id_venta", "codigo", "estado", "fecha_emision", "canal", "cantidad",
                     "precio_unitario", "total", "espectador", "funcion", "pelicula", "sala", "boleta"],
        "properties": {
            "id_venta": {"bsonType": "int", "minimum": 1},
            "codigo": {"bsonType": "string", "pattern": "^CV-[0-9]{6}$"},
            "estado": {"enum": ["EMITIDO", "ANULADO"]},
            "fecha_emision": {"bsonType": "date"},
            "canal": {"enum": ["TAQUILLA", "WEB"]},
            "cantidad": {"bsonType": "int", "minimum": 1, "maximum": 10},
            "precio_unitario": {"bsonType": "decimal"},
            "total": {"bsonType": "decimal"},
            "espectador": {"bsonType": "object", "required": ["id_espectador", "nombre"]},
            "funcion": {"bsonType": "object", "required": ["id_funcion", "fecha_hora_inicio"]},
            "pelicula": {"bsonType": "object", "required": ["id_pelicula", "titulo"]},
            "sala": {"bsonType": "object", "required": ["id_sala", "numero", "formato", "sede"]},
            "boleta": {"bsonType": "object", "required": ["id_tipo_boleta", "categoria"]},
        },
    }
}


class VentaRechazada(Exception):
    """La venta no se hizo. `motor` indica dónde se rechazó; nada quedó a medias."""

    def __init__(self, motor: str, mensaje: str):
        super().__init__(f"[{motor}] {mensaje}")
        self.motor = motor
        self.mensaje = mensaje


def asegurar_coleccion() -> None:
    """Crea comprobantes_venta con su validador e índices únicos si todavía no existe."""
    db = conectar_mongo()
    if COLECCION not in db.list_collection_names():
        try:
            db.create_collection(COLECCION, validator=VALIDADOR, validationLevel="strict",
                                 validationAction="error")
        except CollectionInvalid:
            pass   # otro proceso la creó al mismo tiempo
    db[COLECCION].create_index("id_venta", unique=True)
    db[COLECCION].create_index("codigo", unique=True)


def _a_utc(fecha: datetime) -> datetime:
    """TIMESTAMP de PostgreSQL (hora de Bogotá sin zona) -> UTC para MongoDB."""
    return fecha.replace(tzinfo=BOGOTA).astimezone(timezone.utc)


def _mensaje_pg(e: psycopg2.Error) -> str:
    return (e.diag.message_primary if e.diag and e.diag.message_primary else str(e)).strip()


def registrar_venta(id_funcion: int, id_espectador: int, id_tipo_boleta: int, cantidad: int,
                    canal: str = "WEB", id_staff: int | None = None,
                    simular_fallo_mongo: bool = False) -> dict:
    """Registra la venta en PostgreSQL y su comprobante en MongoDB como una sola operación.

    simular_fallo_mongo=True manda a MongoDB un comprobante inválido para demostrar
    que la venta de PostgreSQL se deshace (ROLLBACK).
    """
    asegurar_coleccion()
    conn = conectar_postgres()
    db = conectar_mongo()

    # 1. PostgreSQL: venta dentro de una transacción abierta (todavía sin COMMIT)
    try:
        with conn.cursor() as cur:
            cur.execute("CALL sp_registrar_venta(%s, %s, %s, %s, %s, %s, NULL, NULL)",
                        (id_funcion, id_espectador, id_tipo_boleta, cantidad, canal, id_staff))
            resultado = cur.fetchone()
            id_venta, total = resultado["p_id_venta"], resultado["p_total"]
            cur.execute(
                """SELECT v.id_venta, v.canal, v.cantidad, v.precio_unitario, v.fecha_venta,
                          e.id_espectador, e.nombres || ' ' || e.apellidos AS espectador,
                          f.id_funcion, f.fecha_hora_inicio, f.tipo, f.version,
                          p.id_pelicula, p.titulo,
                          sa.id_sala, sa.numero AS sala, sa.formato, se.id_sede, se.nombre AS sede,
                          tb.id_tipo_boleta, tb.categoria
                     FROM ventas v
                     JOIN espectadores e  ON e.id_espectador = v.id_espectador
                     JOIN funciones f     ON f.id_funcion = v.id_funcion
                     JOIN peliculas p     ON p.id_pelicula = f.id_pelicula
                     JOIN salas sa        ON sa.id_sala = f.id_sala
                     JOIN sedes se        ON se.id_sede = sa.id_sede
                     JOIN tipos_boleta tb ON tb.id_tipo_boleta = v.id_tipo_boleta
                    WHERE v.id_venta = %s""", (id_venta,))
            v = cur.fetchone()
    except psycopg2.Error as e:
        conn.rollback()
        raise VentaRechazada("postgresql", _mensaje_pg(e)) from e

    # 2. MongoDB: comprobante con los datos que acaba de confirmar PostgreSQL
    comprobante = {
        "id_venta": v["id_venta"],
        "codigo": f"CV-{v['id_venta']:06d}",
        "estado": "EMITIDO",
        "fecha_emision": _a_utc(v["fecha_venta"]),
        "canal": v["canal"],
        "cantidad": v["cantidad"],
        "precio_unitario": Decimal128(v["precio_unitario"]),
        "total": Decimal128(Decimal(total)),
        "espectador": {"id_espectador": v["id_espectador"], "nombre": v["espectador"]},
        "funcion": {"id_funcion": v["id_funcion"], "fecha_hora_inicio": _a_utc(v["fecha_hora_inicio"]),
                    "tipo": v["tipo"], "version": v["version"]},
        "pelicula": {"id_pelicula": v["id_pelicula"], "titulo": v["titulo"]},
        "sala": {"id_sala": v["id_sala"], "numero": v["sala"], "formato": v["formato"],
                 "id_sede": v["id_sede"], "sede": v["sede"]},
        "boleta": {"id_tipo_boleta": v["id_tipo_boleta"], "categoria": v["categoria"]},
        "esquema_version": 1,
    }
    if simular_fallo_mongo:
        comprobante["total"] = "no es un número"   # el validador de la colección lo rechaza

    try:
        id_mongo = db[COLECCION].insert_one(comprobante).inserted_id
    except PyMongoError as e:
        conn.rollback()
        raise VentaRechazada("mongodb", f"No se pudo generar el comprobante ({type(e).__name__}). "
                                        f"Se hizo ROLLBACK de la venta {id_venta} en PostgreSQL.") from e

    # 3. COMMIT en PostgreSQL; si falla, se compensa borrando el comprobante
    try:
        conn.commit()
    except psycopg2.Error as e:
        try:
            conn.rollback()
        except psycopg2.Error:
            pass   # si la conexión se cayó, PostgreSQL ya descartó la transacción
        db[COLECCION].delete_one({"_id": id_mongo})
        raise VentaRechazada("postgresql", f"Falló el COMMIT ({_mensaje_pg(e)}). "
                                           "Se borró el comprobante de MongoDB.") from e

    return {
        "id_venta": id_venta,
        "codigo": comprobante["codigo"],
        "total": total,
        "postgresql": {"tabla": "ventas", "id_venta": id_venta, "precio_unitario": v["precio_unitario"]},
        "mongodb": {"coleccion": COLECCION, "_id": str(id_mongo)},
        "resumen": f"{v['cantidad']} x {v['categoria']} · {v['titulo']} · sala {v['sala']} {v['formato']} "
                   f"· {v['sede']} · {v['fecha_hora_inicio']}",
    }


def verificar_venta(id_venta: int) -> dict:
    """Comprueba en los dos motores si la venta existe y si los datos coinciden."""
    conn = conectar_postgres()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT cantidad, cantidad * precio_unitario AS total FROM ventas WHERE id_venta = %s",
                        (id_venta,))
            pg = cur.fetchone()
    finally:
        conn.rollback()
    mg = conectar_mongo()[COLECCION].find_one({"id_venta": id_venta}, {"_id": 0, "cantidad": 1, "total": 1})
    coinciden = bool(pg and mg and pg["cantidad"] == mg["cantidad"] and pg["total"] == mg["total"].to_decimal())
    return {"en_postgresql": pg is not None, "en_mongodb": mg is not None, "coinciden": coinciden}


def buscar_datos_de_prueba() -> dict | None:
    """Encuentra una combinación válida para vender por WEB: la próxima función PROGRAMADA
    (con aforo y sala activa), la boleta GENERAL de su formato y un espectador con la edad mínima."""
    conn = conectar_postgres()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT f.id_funcion, tb.id_tipo_boleta,
                          (SELECT e.id_espectador FROM espectadores e
                            WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.fecha_nacimiento)) >= GREATEST(p.edad_minima, 18)
                            ORDER BY e.id_espectador LIMIT 1) AS id_espectador
                     FROM funciones f
                     JOIN salas sa        ON sa.id_sala = f.id_sala AND sa.estado = 'ACTIVA'
                     JOIN peliculas p     ON p.id_pelicula = f.id_pelicula
                     JOIN tipos_boleta tb ON tb.formato = sa.formato AND tb.categoria = 'GENERAL' AND tb.activo
                    WHERE f.estado = 'PROGRAMADA'
                      AND f.fecha_hora_inicio > LOCALTIMESTAMP(0) + INTERVAL '1 hour'
                      AND sa.capacidad - COALESCE((SELECT SUM(v.cantidad) FROM ventas v
                                                    WHERE v.id_funcion = f.id_funcion AND v.estado = 'PAGADA'), 0) >= 2
                    ORDER BY f.fecha_hora_inicio
                    LIMIT 1""")
            fila = cur.fetchone()
    finally:
        conn.rollback()
    return dict(fila) if fila else None


def contar_ventas() -> tuple[int, int]:
    conn = conectar_postgres()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM ventas")
            n_pg = cur.fetchone()["n"]
    finally:
        conn.rollback()
    return n_pg, conectar_mongo()[COLECCION].count_documents({})


def demo() -> bool:
    datos = buscar_datos_de_prueba()
    if not datos:
        print("No hay funciones PROGRAMADAS futuras con cupo para la demo.")
        return False
    print(f"Datos de prueba: {datos}")
    ok = True

    print("\n[A] Camino feliz: la venta se escribe en los dos motores")
    antes = contar_ventas()
    r = registrar_venta(datos["id_funcion"], datos["id_espectador"], datos["id_tipo_boleta"], 2)
    print(f"    Venta {r['id_venta']} ({r['codigo']}) total ${r['total']:,.0f}: {r['resumen']}")
    print(f"    PostgreSQL ventas.id_venta={r['id_venta']} · MongoDB {COLECCION}._id={r['mongodb']['_id']}")
    print(f"    Verificación: {verificar_venta(r['id_venta'])} · conteos (PG, Mongo) {antes} -> {contar_ventas()}")
    ok &= verificar_venta(r["id_venta"])["coinciden"]

    print("\n[B] Rechazo en PostgreSQL (función ya finalizada): no se escribe nada en MongoDB")
    antes = contar_ventas()
    try:
        registrar_venta(1, datos["id_espectador"], 1, 1)
        ok = False
    except VentaRechazada as e:
        print(f"    Rechazada {e}")
    print(f"    Conteos (PG, Mongo) {antes} -> {contar_ventas()}")
    ok &= antes == contar_ventas()

    print("\n[C] Falla en MongoDB (comprobante inválido): ROLLBACK de la venta en PostgreSQL")
    antes = contar_ventas()
    try:
        registrar_venta(datos["id_funcion"], datos["id_espectador"], datos["id_tipo_boleta"], 1,
                        simular_fallo_mongo=True)
        ok = False
    except VentaRechazada as e:
        print(f"    Rechazada {e}")
    print(f"    Conteos (PG, Mongo) {antes} -> {contar_ventas()}")
    ok &= antes == contar_ventas()

    print("\nResultado:", "la transacción cruzada se comporta como todo o nada." if ok else "algo no cuadró.")
    return ok


if __name__ == "__main__":
    try:
        exito = demo()
    except (ErrorConexion, VentaRechazada) as e:
        print(f"ERROR: {e}")
        exito = False
    finally:
        cerrar_conexiones()
    sys.exit(0 if exito else 1)
