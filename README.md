# Proyecto de Base de Datos II — CuevanaCinema

**Grupo:** CuevanaCinema · **Integrantes:** Sergio Hernandez · Nicolas Mateus · Nicole Cruz · Juan Buitrago

## La empresa

**CuevanaCinema** es una cadena multisala de Bogotá D.C. con **3 sedes** (Chapinero, Kennedy y Usaquén) y **10 salas** 2D, 3D y 4D.
Vende boletas en taquilla y por web, programa funciones regulares, preestrenos y conversatorios, y gestiona la ficha
técnica de las películas, las reseñas del público, los requisitos de proyección y los incidentes de cada sala.

El proyecto construye su base de datos con una **arquitectura políglota**:

- **PostgreSQL** para el núcleo transaccional: ventas, funciones, salas, contratos.
- **MongoDB** para la información flexible: fichas técnicas, reseñas, requisitos de proyección, incidentes y comprobantes de venta.

Los dos motores se conectan por **identificadores compartidos** (`id_pelicula`, `id_funcion`, `id_sala`, `id_venta`…).

| Fase | Carpeta | Motor | Entrega |
|---|---|---|---|
| 1 — Núcleo transaccional | [`avance1-postgresql/`](avance1-postgresql/) | PostgreSQL (Neon) | 15 de octubre de 2026 |
| 2 — Capa documental y arquitectura políglota | [`avance2-mongodb/`](avance2-mongodb/) | MongoDB (Atlas) | Entregado |
| 3 — Integración funcional | [`entrega-final/`](entrega-final/) | PostgreSQL + MongoDB (Python) | 22 de noviembre de 2026 |

## Estructura

```
avance1-postgresql/
├── modelo-er/  modelo-relacional/     modelos en PNG y PDF
├── scripts/                           01_creacion_tablas.sql … 05_consultas.sql
└── evidencias/
avance2-mongodb/
├── diagrama-arquitectura-poliglota/
├── scripts/                           01_creacion_colecciones.js … 03_consultas.js
└── evidencias/
entrega-final/
├── script-integracion/                conexiones, 3 casos de uso, transacción cruzada, main.py, pruebas
├── modulo-api/                        API FastAPI + colección Postman documentada + evidencias Newman
├── docs/                              arquitectura de integración, flujo de datos, decisiones técnicas
├── informe-final-consolidado.pdf
└── portafolio-individual/             [nombre-estudiante]-reflexion.pdf
```

## Cómo ejecutar las 3 fases

### Fase 1 — PostgreSQL

En una base nueva (por ejemplo `cine_avance1` en Neon), en este orden:

```bash
psql "$PG_URL" -f avance1-postgresql/scripts/01_creacion_tablas.sql
psql "$PG_URL" -f avance1-postgresql/scripts/02_datos_prueba.sql
psql "$PG_URL" -f avance1-postgresql/scripts/03_triggers.sql
psql "$PG_URL" -f avance1-postgresql/scripts/04_procedimientos.sql
psql "$PG_URL" -f avance1-postgresql/scripts/05_consultas.sql
```

### Fase 2 — MongoDB

Hay que cargarla **el mismo día** que la fase 1, porque las fechas de prueba son relativas al día de carga.

```bash
mongosh "$MONGO_URL" --file avance2-mongodb/scripts/01_creacion_colecciones.js
mongosh "$MONGO_URL" --file avance2-mongodb/scripts/02_datos_prueba.js
mongosh "$MONGO_URL" --file avance2-mongodb/scripts/03_consultas.js
```

Más detalles en [`avance2-mongodb/README.md`](avance2-mongodb/README.md).

### Fase 3 — Integración funcional

```bash
cd entrega-final/script-integracion
python -m venv .venv
.venv\Scripts\activate                      # Linux/macOS: source .venv/bin/activate
pip install -r ../modulo-api/requirements.txt -r requirements-dev.txt
copy .env.example .env                      # pegue PG_URL y MONGO_URL (Linux/macOS: cp)

python conexiones.py      # req. 1: conexión simultánea a los dos motores
python main.py            # req. 1, 2 y 3: conexiones + 3 casos de uso + transacción cruzada
python -m pytest          # 16 pruebas automáticas

cd ../modulo-api
uvicorn main:app --port 8000                # req. 4: API en http://localhost:8000/docs
npx newman run postman/CuevanaCinema-entrega-final.postman_collection.json -e postman/CuevanaCinema-local.postman_environment.json
```

Cada parte tiene su README: [script de integración](entrega-final/script-integracion/README.md) ·
[módulo API](entrega-final/modulo-api/README.md) · [documentación técnica](entrega-final/docs/).

## Reglas del repositorio

- Las credenciales van en `.env`, que está en `.gitignore`. En el repositorio solo hay plantillas `.env.example`.
- Cada integrante sube su propia parte desde su cuenta.
