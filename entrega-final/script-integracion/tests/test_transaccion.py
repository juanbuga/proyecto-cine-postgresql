"""La venta debe quedar en los dos motores o en ninguno."""
import psycopg2
import pytest

import transaccion
from conftest import conteos


def test_venta_queda_en_los_dos_motores(datos_venta, limpiar_ventas, mongo):
    antes = conteos()
    r = transaccion.registrar_venta(datos_venta["id_funcion"], datos_venta["id_espectador"],
                                    datos_venta["id_tipo_boleta"], 2)
    limpiar_ventas.append(r["id_venta"])
    assert conteos() == (antes[0] + 1, antes[1] + 1)
    assert transaccion.verificar_venta(r["id_venta"]) == {"en_postgresql": True, "en_mongodb": True,
                                                          "coinciden": True}
    doc = mongo[transaccion.COLECCION].find_one({"id_venta": r["id_venta"]})
    assert doc["codigo"] == f"CV-{r['id_venta']:06d}"
    assert doc["funcion"]["id_funcion"] == datos_venta["id_funcion"]
    assert doc["cantidad"] == 2


def test_rechazo_en_postgresql_no_toca_mongo(datos_venta):
    antes = conteos()
    with pytest.raises(transaccion.VentaRechazada) as e:
        transaccion.registrar_venta(1, datos_venta["id_espectador"], 1, 1)   # función 1 ya FINALIZADA
    assert e.value.motor == "postgresql"
    assert "PROGRAMADAS" in e.value.mensaje
    assert conteos() == antes


@pytest.mark.parametrize("cantidad", [0, 11])
def test_cantidad_fuera_de_rango(datos_venta, cantidad):
    antes = conteos()
    with pytest.raises(transaccion.VentaRechazada, match="cantidad inválida"):
        transaccion.registrar_venta(datos_venta["id_funcion"], datos_venta["id_espectador"],
                                    datos_venta["id_tipo_boleta"], cantidad)
    assert conteos() == antes


def test_falla_en_mongo_hace_rollback_en_postgresql(datos_venta):
    antes = conteos()
    with pytest.raises(transaccion.VentaRechazada) as e:
        transaccion.registrar_venta(datos_venta["id_funcion"], datos_venta["id_espectador"],
                                    datos_venta["id_tipo_boleta"], 1, simular_fallo_mongo=True)
    assert e.value.motor == "mongodb"
    assert "ROLLBACK" in e.value.mensaje
    assert conteos() == antes


class _ConexionQueFallaAlConfirmar:
    """Envuelve la conexión real y hace fallar el COMMIT."""

    def __init__(self, real):
        self._real = real

    def __getattr__(self, nombre):
        return getattr(self._real, nombre)

    def commit(self):
        raise psycopg2.OperationalError("COMMIT simulado que falla")


def test_falla_en_commit_borra_el_comprobante(datos_venta, monkeypatch):
    real = transaccion.conectar_postgres()
    monkeypatch.setattr(transaccion, "conectar_postgres", lambda: _ConexionQueFallaAlConfirmar(real))
    antes = conteos()
    with pytest.raises(transaccion.VentaRechazada, match="Se borró el comprobante"):
        transaccion.registrar_venta(datos_venta["id_funcion"], datos_venta["id_espectador"],
                                    datos_venta["id_tipo_boleta"], 1)
    monkeypatch.undo()
    assert conteos() == antes


def test_validador_de_la_coleccion(mongo):
    transaccion.asegurar_coleccion()
    opciones = mongo[transaccion.COLECCION].options()
    assert "$jsonSchema" in opciones["validator"]
    indices = mongo[transaccion.COLECCION].index_information()
    assert any(i.get("unique") and i["key"] == [("id_venta", 1)] for i in indices.values())
