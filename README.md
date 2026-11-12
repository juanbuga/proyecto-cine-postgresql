# Proyecto de Base de Datos II — CuevanaCinema

CuevanaCinema es una cadena multisala de Bogotá D.C. con 3 sedes y 10 salas 2D, 3D y 4D. El proyecto construye su base de datos por avances: un núcleo transaccional en PostgreSQL y una capa documental en MongoDB, conectados por identificadores compartidos.

| Avance | Carpeta | Motor | Estado |
|---|---|---|---|
| Avance 1 — Núcleo transaccional | [`avance1-postgresql/`](avance1-postgresql/) | PostgreSQL | Entregado el 15 de octubre de 2026 |
| Avance 2 — Capa documental y arquitectura políglota | [`avance2-mongodb/`](avance2-mongodb/) | MongoDB | En entrega |

## Integrantes

Sergio Hernandez · Nicolas Mateus · Nicole Cruz · Juan Buitrago

## Estructura

```
avance1-postgresql/
├── modelo-er/                  modelo entidad-relación
├── modelo-relacional/          modelo relacional en 3FN
├── scripts/                    01_creacion_tablas.sql … 05_consultas.sql
└── evidencias/                 capturas de ejecución
avance2-mongodb/
├── diagrama-arquitectura-poliglota/
├── scripts/                    01_creacion_colecciones.js … 03_consultas.js
└── evidencias/
```

## Cómo ejecutar

**Avance 1 (PostgreSQL).** En una base nueva (por ejemplo `cine_avance1`), en este orden:

```bash
psql -d cine_avance1 -f avance1-postgresql/scripts/01_creacion_tablas.sql
psql -d cine_avance1 -f avance1-postgresql/scripts/02_datos_prueba.sql
psql -d cine_avance1 -f avance1-postgresql/scripts/03_triggers.sql
psql -d cine_avance1 -f avance1-postgresql/scripts/04_procedimientos.sql
psql -d cine_avance1 -f avance1-postgresql/scripts/05_consultas.sql
```

**Avance 2 (MongoDB).** El mismo día que se cargan los datos del Avance 1, porque las fechas de prueba son relativas al día de carga. Los comandos están en [`avance2-mongodb/README.md`](avance2-mongodb/README.md).
