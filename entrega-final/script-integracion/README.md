# Script de integración — CuevanaCinema

Script en Python conectado **simultáneamente** a los dos motores de la arquitectura políglota:

| Motor | Servicio | Base | Qué guarda |
|-------|----------|------|------------|
| PostgreSQL | Neon | `cine_avance1` | sedes, salas, películas, funciones, espectadores, ventas… |
| MongoDB | Atlas | `cine_avance2` | fichas técnicas, reseñas, requisitos de proyección, incidentes |

## Archivos

| Archivo | Para qué sirve |
|---------|----------------|
| `conexiones.py` | Abre las conexiones a PostgreSQL y MongoDB y permite probarlas |
| `casos_uso.py` | Los 3 casos de uso que combinan ambas bases (req. 2) |
| `transaccion.py` | La venta que escribe en los dos motores (req. 3) |
| `main.py` | Ejecuta todo en orden y muestra los resultados |
| `tests/` | Pruebas automáticas con pytest contra las bases reales (16 pruebas) |
| `evidencias/` | Salidas reales: `salida-main.txt` y `pytest.txt` |
| `requirements.txt` | Librerías: `psycopg2-binary`, `pymongo`, `python-dotenv` |
| `requirements-dev.txt` | Lo anterior más `pytest` |
| `.env.example` | Plantilla de credenciales (sin contraseñas reales) |

## Uso rápido

```bash
python main.py                          # conexiones + 3 casos de uso + transacción cruzada
python main.py --sin-venta              # igual, sin escribir datos
python main.py --funcion 17 --pelicula 3
python main.py --guardar                # además guarda evidencias/salida-main.txt
```

Termina con `TODO OK` y código 0, o con `TERMINÓ CON ERRORES` y código 1.

## Pruebas automáticas

```bash
pip install -r requirements-dev.txt
python -m pytest
```

| Archivo | Qué comprueba |
|---------|---------------|
| `test_conexiones.py` | Los dos motores responden y la zona horaria es Bogotá. Sin credenciales o con un servidor inalcanzable, el error es legible |
| `test_casos_uso.py` | Los 3 casos traen datos de los dos motores y cuadran con conteos directos en cada uno. Un id inexistente da `CasoNoEncontrado` |
| `test_transaccion.py` | La venta queda en los dos motores. Un rechazo de PG no toca Mongo. Una falla de Mongo provoca ROLLBACK en PG. Una falla del COMMIT borra el comprobante. Además revisa el validador y los índices únicos |

Las ventas que crean las pruebas **se borran al final** en los dos motores. Si no hay `.env`, las pruebas se omiten.

## Requisitos

- Python 3.10 o superior.
- Las bases cargadas con los scripts de `avance1-postgresql/scripts` y `avance2-mongodb/scripts`.
- Acceso de red a Neon y a Atlas (en Atlas, la IP del equipo debe estar en *Network Access*).

## Instalación

```bash
cd entrega-final/script-integracion
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
```

## Credenciales

```bash
cp .env.example .env      # en Windows: copy .env.example .env
```

Abra `.env` y pegue las cadenas de conexión de Neon (`PG_URL`) y de Atlas (`MONGO_URL`).
El archivo `.env` está en `.gitignore`: nunca se sube al repositorio.

## Probar la conexión

```bash
python conexiones.py
```

Salida esperada:

```
== PostgreSQL ==
  Base:    cine_avance1
  Versión: PostgreSQL 18.7 ...
  Hora:    2026-11-20 16:56:43 (America/Bogota)
  sedes             3 filas
  salas            10 filas
  peliculas        12 filas
  funciones        36 filas
  espectadores     40 filas
  ventas           60 filas
== MongoDB ==
  Base:    cine_avance2
  Versión: 8.0.39
  fichas_tecnicas_peliculas  ... documentos
  reportes_incidentes        ... documentos
  requisitos_proyeccion      ... documentos
  resenas_peliculas          ... documentos

Resultado: los dos motores responden.
```

Si falta una credencial o un motor no responde, el script lo indica con un mensaje claro
(por ejemplo `Falta la variable PG_URL. Copie .env.example como .env y complétela.`) y termina con código 1.

## Decisiones técnicas de conexión

- **Una conexión por motor, reutilizada**: `conectar_postgres()` y `conectar_mongo()` crean la conexión la primera vez y la reutilizan después; `cerrar_conexiones()` las cierra al final.
- **Zona horaria**: al abrir la conexión a PostgreSQL se ejecuta `SET TIME ZONE 'America/Bogota'`, porque los `TIMESTAMP` del modelo están en hora local. MongoDB guarda las fechas en UTC (`tz_aware=True`).
- **Tiempos de espera**: 30 s para PostgreSQL, porque Neon suspende la base inactiva y tarda unos segundos en despertar. Para MongoDB son 15 s de selección de servidor.
- **Errores legibles**: cualquier fallo de conexión se convierte en `ErrorConexion` con un mensaje en español, en lugar de un *traceback*.
- **Credenciales fuera del código**: se leen de `.env` con `python-dotenv`; en el repositorio solo está `.env.example`.

## Casos de uso de integración (requerimiento 2)

```bash
python casos_uso.py              # función 1 y película 8 por defecto
python casos_uso.py 17 3         # otra función (17) y otra película (3)
```

Cada caso consulta los dos motores por separado y **une los resultados en Python** con los
identificadores compartidos. Entre PostgreSQL y MongoDB no hay `JOIN`, así que la relación se resuelve en el script.

| # | Caso | PostgreSQL aporta | MongoDB aporta | Llave de unión |
|---|------|-------------------|----------------|----------------|
| 1 | `funcion_con_resenas(id_funcion)` | película, sala, sede, boletas, ingresos y % de ocupación | reseñas publicadas, promedio y compras verificadas (`resenas_peliculas`) | `id_funcion` |
| 2 | `pelicula_con_requisitos(id_pelicula)` | película y todas sus funciones | ficha técnica (`fichas_tecnicas_peliculas`) y requisitos de proyección de cada función (`requisitos_proyeccion`) | `id_pelicula`, `id_funcion` |
| 3 | `ventas_vs_incidentes_por_sala()` | funciones, boletas e ingresos por sala | incidentes por sala, abiertos, de prioridad alta o crítica y los que afectaron una función (`reportes_incidentes`, con `$group`) | `id_sala` |

El caso 2 también señala las funciones **sin requisitos** en MongoDB y las copias cuya fecha ya no coincide con PostgreSQL.
El caso 3 calcula **incidentes por cada 100 boletas** para comparar salas con distinto volumen de ventas.
Si el id no existe, el caso termina con `No existe la función 999 en PostgreSQL.`

## Transacción cruzada entre motores (requerimiento 3)

```bash
python transaccion.py
```

**Evento de negocio: vender boletas.** En una sola operación:

1. **PostgreSQL**: `BEGIN` y `CALL sp_registrar_venta(...)`, todavía sin `COMMIT`. El procedimiento y el trigger
   `trg_ventas_validar` validan la función, el aforo, el formato y la edad, y fijan el precio vigente.
2. **MongoDB**: se inserta el **comprobante de la venta** en la colección `comprobantes_venta`, que se crea sola con un
   validador `$jsonSchema` e índices únicos en `id_venta` y `codigo`. Lleva una copia de los datos de la función,
   la película, la sala y el espectador.
3. **`COMMIT`** en PostgreSQL.

Como los dos motores no comparten una transacción, el script la coordina a mano:

| Falla en… | Qué hace el script | Estado final |
|-----------|--------------------|--------------|
| PostgreSQL (regla de negocio) | `ROLLBACK`; no se toca MongoDB | sin venta en ninguno |
| MongoDB (al insertar el comprobante) | `ROLLBACK` de la venta en PostgreSQL | sin venta en ninguno |
| `COMMIT` de PostgreSQL | se borra el comprobante de MongoDB (compensación) | sin venta en ninguno |

`python transaccion.py` busca sola una función futura con cupo y corre tres escenarios:
- **A**: venta exitosa en los dos motores, con verificación de que coinciden.
- **B**: rechazo en PostgreSQL al vender una función ya finalizada.
- **C**: falla simulada en MongoDB con un comprobante inválido, que provoca el `ROLLBACK`.

Al final muestra los conteos de cada motor antes y después.

> Cada ejecución del escenario A registra **una venta real** (2 boletas) en las dos bases.
