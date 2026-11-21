import pytest

import casos_uso


# Caso 1 · función con sus reseñas
def test_funcion_con_resenas_combina_los_dos_motores(pg, mongo):
    r = casos_uso.funcion_con_resenas(1)
    assert r["postgresql"]["id_funcion"] == 1
    assert 0 <= r["combinado"]["ocupacion_pct"] <= 100
    esperadas = mongo.resenas_peliculas.count_documents({"id_funcion": 1, "estado_moderacion": "PUBLICADA"})
    assert r["mongodb"]["resenas_publicadas"] == esperadas
    if esperadas:
        cal = [x["calificacion"] for x in r["mongodb"]["resenas"]]
        assert r["combinado"]["calificacion_promedio"] == round(sum(cal) / len(cal), 2)


def test_funcion_inexistente():
    with pytest.raises(casos_uso.CasoNoEncontrado, match="función 999999"):
        casos_uso.funcion_con_resenas(999999)


# Caso 2 · película con sus requisitos técnicos
def test_pelicula_con_requisitos(pg, mongo):
    r = casos_uso.pelicula_con_requisitos(8)
    assert r["postgresql"]["pelicula"]["id_pelicula"] == 8
    assert r["mongodb"]["ficha_tecnica"] is not None
    pg.execute("SELECT COUNT(*) AS n FROM funciones WHERE id_pelicula = 8")
    assert len(r["combinado"]["funciones"]) == pg.fetchone()["n"]
    for f in r["combinado"]["funciones"]:   # cada función trae sus requisitos o queda señalada
        assert f["verificacion"] in ("APROBADA", "PENDIENTE", "RECHAZADA", "NO_APLICA", "SIN_REQUISITOS")
    assert r["combinado"]["copias_desactualizadas"] == []


def test_pelicula_inexistente():
    with pytest.raises(casos_uso.CasoNoEncontrado, match="película 999999"):
        casos_uso.pelicula_con_requisitos(999999)


# Caso 3 · ventas con incidentes por sala
def test_ventas_vs_incidentes_cuadra_con_cada_motor(pg, mongo):
    r = casos_uso.ventas_vs_incidentes_por_sala()
    pg.execute("SELECT COUNT(*) AS salas, (SELECT COALESCE(SUM(cantidad), 0) FROM ventas "
               "WHERE estado = 'PAGADA') AS boletas FROM salas")
    esperado = pg.fetchone()
    assert len(r["combinado"]) == esperado["salas"]
    assert sum(f["boletas"] for f in r["combinado"]) == esperado["boletas"]
    assert sum(f["incidentes"] for f in r["combinado"]) == \
        mongo.reportes_incidentes.count_documents({"id_sala": {"$ne": None}})
    for f in r["combinado"]:
        assert f["abiertos"] <= f["incidentes"] and f["alta_o_critica"] <= f["incidentes"]
