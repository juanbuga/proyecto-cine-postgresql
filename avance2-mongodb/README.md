# Avance 2 — Capa documental en MongoDB

La base `cine_avance2` guarda la información de CuevanaCinema que cambia de forma entre un documento y otro, que crece rápido o que siempre se lee completa. El núcleo transaccional (ventas, funciones, contratos) sigue en PostgreSQL ([`avance1-postgresql/`](../avance1-postgresql/)). Los dos motores se conectan por identificadores compartidos con el mismo nombre y tipo (`id_pelicula`, `id_funcion`, `id_sala`, `id_sede`, `id_espectador`, `id_venta`, `id_staff`, `id_actor_director`).

## Contenido

```
avance2-mongodb/
├── diagrama-arquitectura-poliglota/   diagrama en PNG y PDF
├── scripts/
│   ├── 01_creacion_colecciones.js     colecciones, $jsonSchema e índices
│   ├── 02_datos_prueba.js             136 documentos + 9 pruebas que deben fallar
│   └── 03_consultas.js                6 consultas (2 find, 4 pipelines)
└── evidencias/                        capturas de la ejecución real
```

## Colecciones

| Colección | Documentos | Por qué está en MongoDB | Ids compartidos |
|---|---|---|---|
| `fichas_tecnicas_peliculas` | 30 (12 enlazadas a PostgreSQL, 18 del catálogo de distribuidoras) | Reparto, versiones, idiomas, subtítulos y clasificación por país cambian entre películas | `id_pelicula`, `id_actor_director`, `id_staff` |
| `requisitos_proyeccion` | 31 (una por función especial) | Un 3D, un 4D, un conversatorio o un preestreno piden requisitos distintos | `id_funcion`, `id_sala`, `id_sede`, `id_pelicula`, `id_staff` |
| `resenas_peliculas` | 40 (19 con compra verificada) | Mucho volumen, texto libre y campos opcionales | `id_pelicula`, `id_espectador`, `id_venta`, `id_funcion`, `id_staff` |
| `reportes_incidentes` | 35 (14 fallas, 13 quejas, 8 de seguridad) | Cada tipo de incidente tiene campos propios (patrón polimórfico) | `id_sede`, `id_sala`, `id_funcion`, `id_espectador`, `id_venta`, `id_staff` |

Las cuatro colecciones tienen validación `$jsonSchema` con `validationLevel: 'strict'` y `validationAction: 'error'`.

## Cómo ejecutar

Primero se cargan los scripts del Avance 1 en PostgreSQL y, **el mismo día**, estos tres en orden (las fechas de prueba son relativas al día de carga, igual que `CURRENT_DATE ± n` en `02_datos_prueba.sql`). Se pueden repetir: `01` borra y vuelve a crear las colecciones y `02` las vacía antes de cargar.

```bash
# Servidor local
mongosh "mongodb://127.0.0.1:27017" --file scripts/01_creacion_colecciones.js
mongosh "mongodb://127.0.0.1:27017" --file scripts/02_datos_prueba.js
mongosh "mongodb://127.0.0.1:27017" --file scripts/03_consultas.js

# Clúster de Atlas (mongosh pide la contraseña; no se escribe en el comando)
mongosh "mongodb+srv://<cluster>.mongodb.net/" --username <usuario> --file scripts/01_creacion_colecciones.js
```

Para correr una sola consulta:

```bash
CONSULTA=3 mongosh "mongodb://127.0.0.1:27017" --file scripts/03_consultas.js          # Bash
$env:CONSULTA=3; mongosh "mongodb://127.0.0.1:27017" --file scripts/03_consultas.js    # PowerShell
```

En MongoDB Compass: pestaña *mongosh* → `load("ruta/scripts/01_creacion_colecciones.js")`, luego `02` y `03`.

## Evidencias

Las capturas de [`evidencias/`](evidencias/) son de una corrida real con mongosh 2.14.1 sobre MongoDB 8.0.23 (la misma versión mayor del clúster de Atlas del equipo). La lista está en [`evidencias/README.md`](evidencias/README.md).
