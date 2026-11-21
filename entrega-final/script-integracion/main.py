"""Ejecuta toda la integración de CuevanaCinema y muestra los resultados.

    python main.py                       conexiones + 3 casos de uso + transacción cruzada
    python main.py --sin-venta           igual, pero sin escribir datos (omite la transacción)
    python main.py --funcion 17 --pelicula 3
    python main.py --guardar             además guarda la salida en evidencias/salida-main.txt
"""
import argparse
import sys
from datetime import datetime
from pathlib import Path

import casos_uso
import transaccion
from conexiones import ErrorConexion, cerrar_conexiones, probar_conexiones

CARPETA = Path(__file__).resolve().parent


class _Duplicador:
    """Escribe a la vez en la consola y en un archivo (para la evidencia de ejecución)."""

    def __init__(self, *destinos):
        self.destinos = destinos

    def write(self, texto):
        for d in self.destinos:
            d.write(texto)

    def flush(self):
        for d in self.destinos:
            d.flush()


def titulo(texto: str) -> None:
    print("\n" + "=" * 78 + f"\n{texto}\n" + "=" * 78)


def ejecutar(args) -> bool:
    print(f"CuevanaCinema · Integración PostgreSQL + MongoDB · {datetime.now():%Y-%m-%d %H:%M:%S}")

    titulo("REQ. 1 · Conexión simultánea a PostgreSQL y MongoDB")
    if not probar_conexiones():
        return False

    titulo("REQ. 2 · Casos de uso de integración")
    try:
        casos_uso.imprimir_caso_1(casos_uso.funcion_con_resenas(args.funcion))
        casos_uso.imprimir_caso_2(casos_uso.pelicula_con_requisitos(args.pelicula))
        casos_uso.imprimir_caso_3(casos_uso.ventas_vs_incidentes_por_sala())
    except casos_uso.CasoNoEncontrado as e:
        print(f"ERROR: {e}")
        return False

    titulo("REQ. 3 · Transacción cruzada entre motores (venta + comprobante)")
    if args.sin_venta:
        print("Omitida (--sin-venta): no se escribió nada en las bases.")
        return True
    return transaccion.demo()


def main() -> int:
    p = argparse.ArgumentParser(description="Integración CuevanaCinema (PostgreSQL + MongoDB)")
    p.add_argument("--funcion", type=int, default=1, help="id de función para el caso 1 (por defecto 1)")
    p.add_argument("--pelicula", type=int, default=8, help="id de película para el caso 2 (por defecto 8)")
    p.add_argument("--sin-venta", action="store_true", help="no ejecuta la transacción (no escribe datos)")
    p.add_argument("--guardar", action="store_true", help="guarda la salida en evidencias/salida-main.txt")
    args = p.parse_args()

    archivo = None
    if args.guardar:
        (CARPETA / "evidencias").mkdir(exist_ok=True)
        archivo = open(CARPETA / "evidencias" / "salida-main.txt", "w", encoding="utf-8")
        sys.stdout = _Duplicador(sys.__stdout__, archivo)
    try:
        ok = ejecutar(args)
    except (ErrorConexion, transaccion.VentaRechazada) as e:
        print(f"ERROR: {e}")
        ok = False
    finally:
        cerrar_conexiones()
        print("\n" + ("TODO OK" if ok else "TERMINÓ CON ERRORES"))
        if archivo:
            sys.stdout = sys.__stdout__
            archivo.close()
    return 0 if ok else 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")   # tildes en la consola de Windows
    sys.exit(main())
