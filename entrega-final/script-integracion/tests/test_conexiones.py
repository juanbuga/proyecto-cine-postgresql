import pytest

import conexiones


def test_postgres_responde(pg):
    pg.execute("SELECT current_database() AS base, current_setting('TimeZone') AS zona")
    fila = pg.fetchone()
    assert fila["base"] == "cine_avance1"
    assert fila["zona"] == "America/Bogota"


def test_mongo_responde(mongo):
    assert mongo.name == "cine_avance2"
    assert {"fichas_tecnicas_peliculas", "resenas_peliculas", "requisitos_proyeccion",
            "reportes_incidentes"} <= set(mongo.list_collection_names())


def test_sin_credenciales_da_error_legible(monkeypatch):
    monkeypatch.setattr(conexiones, "_conexion_pg", None)
    monkeypatch.setattr(conexiones, "_cliente_mongo", None)
    monkeypatch.delenv("PG_URL", raising=False)
    monkeypatch.delenv("MONGO_URL", raising=False)
    with pytest.raises(conexiones.ErrorConexion, match="Falta la variable PG_URL"):
        conexiones.conectar_postgres()
    with pytest.raises(conexiones.ErrorConexion, match="Falta la variable MONGO_URL"):
        conexiones.conectar_mongo()


def test_postgres_inalcanzable_da_error_legible(monkeypatch):
    monkeypatch.setattr(conexiones, "_conexion_pg", None)
    monkeypatch.setenv("PG_URL", "postgresql://nadie:x@127.0.0.1:1/nada?connect_timeout=2")
    with pytest.raises(conexiones.ErrorConexion, match="No se pudo conectar a PostgreSQL"):
        conexiones.conectar_postgres()
