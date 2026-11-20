# CuevanaCinema · Integración PostgreSQL + MongoDB (Python)

Capa de integración del proyecto de Bases de Datos II. Une los dos avances:

- **Avance 1 — PostgreSQL** (Neon, base `cine_avance1`): 10 tablas, 6 triggers, 3 procedimientos, 3 consultas.
- **Avance 2 — MongoDB** (Atlas, base `cine_avance2`): 4 colecciones con `$jsonSchema`, 11 índices, 6 consultas.

Se usa de dos formas, con el mismo paquete `cuevana/`:

| | Para qué | Cómo |
|---|---|---|
| **API REST + Postman** | Sustentación: cada petición muestra qué hace la base y qué rechaza | FastAPI + 4 colecciones Postman |
| **Google Colab** | Explicar paso a paso con tablas | 4 notebooks conectados directo a Neon y Atlas |

```
Postman ──HTTP──► api/ (FastAPI) ──┐
                                   ├──► cuevana/ ──► PostgreSQL (Neon)
Google Colab ──────────────────────┘           └──► MongoDB (Atlas)
```

## Estructura

| Carpeta | Contenido | Responsable |
|---|---|---|
| `cuevana/config, errores, db_pg, db_mongo, serializar, integracion` | Conexiones, traducción de errores, operaciones entre motores | Sergio Hernández |
| `cuevana/consultas_pg, consultas_mongo, procedimientos` · `api/rutas_consultas.py` | Las 3 + 6 consultas y los 3 procedimientos | Juan Buitrago |
| `cuevana/tipos, crud, verificacion, sincronizacion` · `api/rutas_crud.py`, `api/rutas_integridad.py` · `scripts/` | CRUD, tipos BSON, integridad y carga de datos | Nicolas Mateus |
| `tests/` · `docs/casos-conflicto.md` | Pruebas automáticas y casos de conflicto | Nicole Cruz |
| `notebooks/0n_*`, `postman/0n-*` | Uno por integrante (00 Sergio, 01 Juan, 02 Nicolas, 03 Nicole) | |

## 1. Instalación (local)

Requiere Python 3.12 y, para cargar MongoDB, [mongosh](https://www.mongodb.com/try/download/shell).

```bash
cd integracion-python
python -m venv ../.venv
../.venv/Scripts/activate          # Windows  (Linux/Mac: source ../.venv/bin/activate)
pip install -r requirements.txt
```

## 2. Credenciales (`.env`)

Copie `.env.example` como `.env` (está en `.gitignore`) y pegue sus cadenas:

- `PG_URL`: Neon → proyecto *CuevanaCinema* → rama **`integracion`** → *Connect* → base `cine_avance1`,
  con **"Connection pooling" desmarcado** (cadena directa).
- `MONGO_URL`: Atlas → `ClusterBaseDatos2` → *Connect* → *Drivers*, con la contraseña real. Si la contraseña
  tiene `@ : / ? # %`, escríbala codificada (`@` → `%40`).
- `MONGO_DB=cine_avance2`.

**Nunca suba el `.env` ni pegue contraseñas en un notebook.**

## 3. Cargar los datos (los dos motores el mismo día)

Las fechas de prueba son relativas al día de carga, así que se cargan juntos (caso C1). Los scripts borran y
recrean todo: úselos solo sobre la rama `integracion` de Neon y la base `cine_avance2`.

```bash
python scripts/cargar_postgres.py --confirmar   # 01→04 de avance1-postgresql/scripts
python scripts/cargar_mongo.py --confirmar      # 01 y 02 de avance2-mongodb/scripts (con mongosh)
```

Resultado esperado: 10 tablas, 6 triggers, 3 procedimientos, 36 funciones, 60 ventas; 4 colecciones,
136 documentos, 11 índices y las 9 pruebas de validación en "RECHAZADA".

## 4. API y Postman

```bash
uvicorn api.main:app --port 8000
```

- Documentación interactiva: <http://localhost:8000/docs>
- `GET /` muestra el estado de las dos conexiones y todas las rutas.

En Postman importe `postman/*.postman_collection.json` y el entorno `postman/CuevanaCinema-local.postman_environment.json`
(`baseUrl = http://localhost:8000`). Corra cada colección en orden (*Run collection*); todas borran lo que crean.

| Colección | Contenido |
|---|---|
| `00-integracion` | Estado, película y función en los dos motores, programar → vender → cancelar con compensación, reseñas validadas |
| `01-consultas-procedimientos` | 3 consultas PG, 6 consultas Mongo, reporte de ocupación, ventas y sus rechazos |
| `02-crud-integridad` | CRUD de las tablas y colecciones, rechazos 400/404/409, verificación de integridad |
| `03-rechazos-validaciones` | Los 6 triggers y las 9 pruebas de `$jsonSchema` |

Desde la terminal (deja la evidencia en `evidencias/`):

```bash
npx -y newman run postman/00-integracion.postman_collection.json -e postman/CuevanaCinema-local.postman_environment.json
```

### Rutas

| Ruta | Qué hace |
|---|---|
| `GET /` | Estado de las conexiones |
| `GET /integracion/peliculas/{id}` · `GET /integracion/funciones/{id}` | Lectura combinada de los dos motores |
| `POST /integracion/funciones` | Programa la función en PG y sus requisitos en Mongo (con compensación) |
| `POST /integracion/funciones/{id}/requisitos` | Crea requisitos copiando los datos de PG |
| `POST /integracion/funciones/{id}/cancelar` | `sp_cancelar_funcion` + requisitos a `NO_APLICA` |
| `POST /integracion/resenas` | Reseña validada contra PG |
| `GET /integracion/verificacion` · `POST /integracion/sincronizar-copias[?simular=true]` | Integridad entre motores |
| `GET /pg/consultas[/{n}]` · `GET /mongo/consultas[/{n}]` | Consultas de los avances |
| `POST /pg/procedimientos/registrar-venta` · `GET …/reporte-ocupacion` · `POST …/cancelar-funcion` | Procedimientos |
| `GET/POST /pg/{tabla}` · `GET/PATCH/PUT/DELETE /pg/{tabla}/{id}` | CRUD de las 10 tablas (filtros: `?id_sede=1&orden=-capacidad`) |
| `GET/POST /mongo/{coleccion}` · `GET/PATCH/PUT/DELETE /mongo/{coleccion}/{_id}` | CRUD de las 4 colecciones (`?filtro={...}` en JSON) |

### Errores

Todas las validaciones las hace la base; la API solo traduce el error a un código HTTP y conserva el mensaje:

| Código | Origen |
|---|---|
| 400 | Petición mal formada, `CHECK` (23514), `NOT NULL`, `GENERATED ALWAYS` (428C9), `$jsonSchema` (121, con `reglas_incumplidas`) |
| 404 | Tabla, colección, consulta o registro inexistente |
| 409 | `UNIQUE` (23505), llave foránea (23503), `ON DELETE RESTRICT` (23001), índice único de Mongo (11000) |
| 422 | `RAISE EXCEPTION` de un trigger o procedimiento (P0001) o regla de la integración |
| 503 | Sin conexión o credenciales rechazadas |

## 5. Google Colab

1. Abra el notebook desde GitHub en Colab (*Archivo → Abrir → GitHub*, repo `juanbuga/proyecto-cine-postgresql`).
2. En *Secretos* 🔑 cree `PG_URL` y `MONGO_URL` y active el acceso del notebook.
3. Ejecute todo. La primera celda clona el repo e instala `requirements.txt`.

> La primera celda clona la rama de `RAMA` (por defecto `main`). Mientras la integración no esté fusionada,
> cámbiela por la rama del pull request. Atlas debe aceptar la IP de Colab (ver caso C6).

| Notebook | Contenido |
|---|---|
| `00_integracion` | Lecturas combinadas, flujo programar → vender → cancelar, compensación, reseñas |
| `01_consultas_procedimientos` | Las 9 consultas como tablas y los 3 procedimientos |
| `02_datos_integridad` | Conteos, tipos BSON, ids huérfanos y sincronización |
| `03_validaciones` | Triggers y `$jsonSchema`, con el mensaje de la base |

## 6. Pruebas automáticas

```bash
python -m pytest
```

Corren contra las bases del `.env`; si falta una conexión, las pruebas de ese motor se marcan *skipped*.
Cada prueba borra los datos que crea. Los casos de conflicto están en [`docs/casos-conflicto.md`](docs/casos-conflicto.md).
