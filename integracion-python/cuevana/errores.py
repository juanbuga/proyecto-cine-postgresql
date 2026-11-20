"""Un solo formato de error para los dos motores.

La API no repite las reglas del negocio: las aplican los triggers, los
procedimientos y el $jsonSchema. Aquí solo se traduce su mensaje a un código HTTP.
"""
from typing import Any


class ErrorCuevana(Exception):
    def __init__(self, estado: int, mensaje: str, motor: str | None = None, **detalle: Any):
        super().__init__(mensaje)
        self.estado = estado
        self.mensaje = mensaje
        self.motor = motor
        self.detalle = detalle

    def a_dict(self) -> dict:
        cuerpo = {"estado": self.estado, "mensaje": self.mensaje, "motor": self.motor}
        cuerpo.update({k: v for k, v in self.detalle.items() if v is not None})
        return {"error": cuerpo}


# ── PostgreSQL ──────────────────────────────────────────────────────────────
# SQLSTATE -> (código HTTP, qué significa)
_PG = {
    "P0001": (422, "regla del negocio (trigger o procedimiento)"),
    "23505": (409, "valor único repetido"),
    "23503": (409, "llave foránea"),
    "23001": (409, "llave foránea con ON DELETE RESTRICT: hay registros que dependen de este"),
    "23514": (400, "restricción CHECK"),
    "23502": (400, "valor obligatorio (NOT NULL)"),
    "428C9": (400, "columna GENERATED ALWAYS: el id lo asigna PostgreSQL"),
    "42703": (400, "columna inexistente"),
    "42P01": (404, "tabla inexistente"),
}


def traducir_pg(e: Exception) -> ErrorCuevana:
    sqlstate = getattr(e, "sqlstate", None) or ""
    diag = getattr(e, "diag", None)
    mensaje = (getattr(diag, "message_primary", None) or str(e)).strip()
    restriccion = getattr(diag, "constraint_name", None)
    if sqlstate in _PG:
        estado, tipo = _PG[sqlstate]
    elif sqlstate.startswith("22"):
        estado, tipo = 400, "dato inválido"
    elif sqlstate.startswith("08") or sqlstate.startswith("57P"):
        estado, tipo = 503, "sin conexión con PostgreSQL"
    else:
        estado, tipo = 500, "error de PostgreSQL"
    return ErrorCuevana(estado, mensaje, "postgresql", tipo=tipo, sqlstate=sqlstate or None,
                        restriccion=restriccion)


# ── MongoDB ─────────────────────────────────────────────────────────────────
_REGLA = {"bsonType": "tipo no permitido", "minimum": "menor que el mínimo", "maximum": "mayor que el máximo",
          "enum": "valor no permitido", "pattern": "no cumple el patrón", "minLength": "muy corto",
          "maxLength": "muy largo", "minItems": "muy pocos elementos", "maxItems": "demasiados elementos"}


def reglas_incumplidas(err_info: dict | None) -> list[str]:
    """Resume el errInfo de un $jsonSchema en frases cortas (como motivo() de 02_datos_prueba.js)."""
    def hojas(nodo, ruta):
        if isinstance(nodo, list):
            return [h for n in nodo for h in hojas(n, ruta)]
        if not isinstance(nodo, dict):
            return []
        r = ruta + [nodo["propertyName"]] if nodo.get("propertyName") else ruta
        if nodo.get("operatorName") == "oneOf" and nodo.get("schemasNotSatisfied"):
            ramas = [hojas(s.get("details"), r) for s in nodo["schemasNotSatisfied"]]
            propias = [h for h in ramas if not any(x["operador"] == "enum" for x in h)]
            return [x for h in (propias or ramas) for x in h]
        for clave in ("schemaRulesNotSatisfied", "propertiesNotSatisfied", "schemasNotSatisfied", "details"):
            if nodo.get(clave):
                return hojas(nodo[clave], r)
        return [{"campo": ".".join(r), "operador": nodo.get("operatorName"),
                 "valor": nodo.get("consideredValue"), "faltan": nodo.get("missingProperties")}]

    textos = []
    for h in hojas((err_info or {}).get("details"), []):
        if h["faltan"]:
            texto = f"{h['campo'] + ': ' if h['campo'] else ''}falta {', '.join(h['faltan'])}"
        else:
            texto = f"{h['campo']}: {_REGLA.get(h['operador'], h['operador'])} ({h['valor']!r})"
        if texto not in textos:
            textos.append(texto)
    return textos


def traducir_mongo(e: Exception) -> ErrorCuevana:
    from pymongo import errors as me
    if isinstance(e, me.DuplicateKeyError):
        valor = (e.details or {}).get("keyValue")
        return ErrorCuevana(409, f"Valor único repetido: {valor}", "mongodb", tipo="índice único", llave=valor)
    if isinstance(e, (me.ServerSelectionTimeoutError, me.ConnectionFailure, me.ConfigurationError)):
        return ErrorCuevana(503, "Sin conexión con MongoDB Atlas (revise MONGO_URL y Network Access).", "mongodb")
    if isinstance(e, me.OperationFailure) and (e.code in (18, 8000) or "auth" in str(e).lower()):
        # 18 = AuthenticationFailed; Atlas responde 8000 "bad auth"
        return ErrorCuevana(503, "MongoDB Atlas rechazó el usuario o la contraseña de MONGO_URL.", "mongodb",
                            tipo="autenticación")
    if isinstance(e, me.OperationFailure):
        detalles = e.details or {}
        if e.code == 121:  # DocumentValidationFailure
            return ErrorCuevana(400, "El documento no cumple el $jsonSchema de la colección.", "mongodb",
                                tipo="$jsonSchema", reglas_incumplidas=reglas_incumplidas(detalles.get("errInfo")))
        return ErrorCuevana(400, detalles.get("errmsg") or str(e), "mongodb", tipo="operación rechazada", codigo=e.code)
    return ErrorCuevana(500, str(e), "mongodb")
