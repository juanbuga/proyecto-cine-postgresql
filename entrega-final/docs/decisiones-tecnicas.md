# Decisiones técnicas de conexión e integración

## Conexión

| Decisión | Motivo |
|---|---|
| **Python 3.12 con `psycopg2-binary` y `pymongo`** | Son los drivers oficiales más usados, no requieren compilar y son los que se vieron en clase |
| **Credenciales en `.env`** (`python-dotenv`); en Git solo `.env.example` | No publicar contraseñas en un repositorio público |
| **Una conexión por motor, reutilizada** | El tier gratuito de Neon y Atlas limita las conexiones. Abrir una por consulta es lento por el TLS |
| **`connect_timeout=30` en PostgreSQL** | Neon suspende la base inactiva y la primera conexión tarda unos segundos en despertarla |
| **`serverSelectionTimeoutMS=15000` en MongoDB** | Si Atlas no responde, falla en 15 s con un mensaje claro en vez de quedarse colgado |
| **Cadena directa de Neon (sin pooler)** | `SET TIME ZONE` y las transacciones largas funcionan sin sorpresas |
| **Errores traducidos** (`ErrorConexion`, `CasoNoEncontrado`, `VentaRechazada`) | El usuario y la API reciben un mensaje en español y el motor que falló, nunca un *traceback* |

## Fechas y zonas horarias

- PostgreSQL guarda `TIMESTAMP` **sin zona en hora de Bogotá**. Neon trabaja en UTC, así que al conectar se
  ejecuta `SET TIME ZONE 'America/Bogota'`. Sin eso, `LOCALTIMESTAMP` iría 5 horas adelantado y los triggers
  rechazarían ventas de funciones que todavía no han empezado.
- MongoDB guarda fechas en **UTC** (`tz_aware=True`). Al copiar de PostgreSQL a MongoDB se suma el desfase de
  Bogotá (UTC−5, sin horario de verano) y al comparar se hace la conversión inversa (`casos_uso.a_bogota`).

## Transacción cruzada

PostgreSQL y MongoDB **no comparten una transacción**: no hay *two-phase commit* entre ellos. Se eligió
una **transacción coordinada con compensación**:

1. Se escribe primero en **PostgreSQL**, que es la fuente de verdad y el que más reglas valida, sin hacer `COMMIT`.
2. Se escribe en **MongoDB**. Si falla, `ROLLBACK` en PostgreSQL.
3. `COMMIT` en PostgreSQL. Si falla, se **compensa** borrando el documento de MongoDB.

Alternativas descartadas:

| Alternativa | Por qué no |
|---|---|
| Escribir primero en MongoDB | MongoDB no valida aforo, edad ni precio. Habría que deshacer más a menudo |
| Transacciones multi-documento de MongoDB | Solo sirven dentro de MongoDB; no coordinan con PostgreSQL |
| Cola de eventos o *outbox* | Es más robusto a gran escala, pero agrega infraestructura que no aporta a la demo |

**Riesgo residual:** si el proceso muere justo entre el `insertOne` y el `COMMIT`, queda un comprobante sin
venta. PostgreSQL hace el `ROLLBACK` solo al cortarse la conexión. Para detectarlo, `verificar_venta(id)` muestra
en qué motor está la venta. A escala real se resolvería con un proceso de conciliación periódico o con el patrón
*outbox*.

## Colección `comprobantes_venta`

- Se crea sola la primera vez (`transaccion.asegurar_coleccion`), con validador `$jsonSchema` en modo `strict`/`error`.
- Tiene **índices únicos** en `id_venta` y `codigo`, así una venta no puede tener dos comprobantes.
- El dinero se guarda como `Decimal128`, nunca `double`, y las fechas como `date`.
- El documento está **desnormalizado**: lleva la función, la película, la sala, la sede, el espectador y la boleta,
  para mostrar o reenviar el comprobante sin volver a PostgreSQL.

## Conflictos entre motores y cómo se resuelven

| # | Conflicto | Solución |
|---|---|---|
| C1 | Fechas de prueba relativas al día de carga | Cargar los dos motores el mismo día. El caso 2 detecta copias con fecha distinta |
| C2 | Escritura en dos motores sin transacción común | Transacción coordinada con ROLLBACK y compensación (arriba) |
| C3 | Ids en MongoDB que no existen en PostgreSQL | Todo lo que se escribe en MongoDB sale de una fila que PostgreSQL acaba de confirmar |
| C4 | Zona horaria (Neon en UTC, datos en Bogotá, Mongo en UTC) | `SET TIME ZONE` y conversión explícita |
| C5 | Tipos BSON (dinero y fechas) | `Decimal128` y `datetime` con zona; el validador rechaza lo demás |
| C6 | Acceso a Atlas por IP | `Network Access` abierto solo durante la entrega y la sustentación |
| C7 | Credenciales en Git | `.env` en `.gitignore` y revisión con `git grep` antes de cada commit |
| C8 | Neon dormido | Timeout de 30 s; `GET /` sirve para despertarlo antes de la demo |
| C9 | Ids `GENERATED ALWAYS` que avanzan | Las pruebas no asumen ids fijos para las ventas: usan el id devuelto y luego borran |
| C10 | Límite de conexiones del tier gratuito | Una conexión por motor y un candado en la API |
| C11 | Varias personas probando a la vez | `buscar_datos_de_prueba()` elige una función con cupo en cada corrida |
