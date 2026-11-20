"""Configuración: lee las cadenas de conexión de .env (local) o de los Secretos de Colab."""
import os
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

CARPETA = Path(__file__).resolve().parents[1]      # integracion-python/
RAIZ_REPO = CARPETA.parent                          # raíz del repositorio
SCRIPTS_PG = RAIZ_REPO / "avance1-postgresql" / "scripts"
SCRIPTS_MONGO = RAIZ_REPO / "avance2-mongodb" / "scripts"

ZONA = ZoneInfo("America/Bogota")

try:
    from dotenv import load_dotenv
    load_dotenv(CARPETA / ".env")
except ImportError:  # en Colab no hace falta
    pass


def valor(nombre: str, defecto: str | None = None) -> str | None:
    """Variable de entorno; si no existe, Secreto de Google Colab; si no, el defecto."""
    v = os.environ.get(nombre)
    if v:
        return v
    try:
        from google.colab import userdata  # type: ignore
        return userdata.get(nombre) or defecto
    except Exception:
        return defecto


def pg_url() -> str | None:
    return valor("PG_URL")


def mongo_url() -> str | None:
    return valor("MONGO_URL")


def mongo_db() -> str:
    return valor("MONGO_DB", "cine_avance2")


def hay_credenciales() -> bool:
    return bool(pg_url() and mongo_url())


# PostgreSQL guarda TIMESTAMP sin zona en hora de Bogotá; MongoDB guarda fechas en UTC.
def bogota_a_utc(fecha: datetime) -> datetime:
    """TIMESTAMP de PostgreSQL (hora de Bogotá, sin zona) -> fecha UTC para MongoDB."""
    if fecha.tzinfo is None:
        fecha = fecha.replace(tzinfo=ZONA)
    return fecha.astimezone(timezone.utc)


def utc_a_bogota(fecha: datetime) -> datetime:
    """Fecha de MongoDB (UTC) -> TIMESTAMP sin zona en hora de Bogotá, como en PostgreSQL."""
    if fecha.tzinfo is None:
        fecha = fecha.replace(tzinfo=timezone.utc)
    return fecha.astimezone(ZONA).replace(tzinfo=None)


def ahora_utc() -> datetime:
    return datetime.now(timezone.utc)
