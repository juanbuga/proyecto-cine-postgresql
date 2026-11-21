# Módulo API — CuevanaCinema (requerimiento 4)

API REST en **FastAPI** que expone la integración PostgreSQL + MongoDB, más una **colección Postman documentada**
con pruebas del camino feliz y de los errores.

La API no duplica lógica: importa los módulos de `../script-integracion`
(`conexiones.py`, `casos_uso.py` y `transaccion.py`).

## Cómo levantarla

```bash
cd entrega-final/script-integracion
python -m venv .venv
.venv\Scripts\activate                      # Linux/macOS: source .venv/bin/activate
pip install -r ../modulo-api/requirements.txt
copy .env.example .env                       # y pegue las credenciales (Linux/macOS: cp)

cd ../modulo-api
uvicorn main:app --port 8000
```

- Documentación interactiva (Swagger): <http://localhost:8000/docs>
- El `.env` se lee de `script-integracion/.env`, así que el script y la API usan las mismas credenciales.

## Endpoints

| Método | Ruta | Qué hace | Motores |
|--------|------|----------|---------|
| GET | `/` | Estado de las dos conexiones; 503 si alguna falla | PG + Mongo |
| GET | `/funciones/{id}/resenas` | **Caso 1**: función con ocupación e ingresos, y sus reseñas | PG + Mongo |
| GET | `/peliculas/{id}/requisitos` | **Caso 2**: película y funciones, con ficha y requisitos técnicos | PG + Mongo |
| GET | `/salas/ventas-incidentes` | **Caso 3**: ventas cruzadas con incidentes por sala | PG + Mongo |
| POST | `/ventas` | **Transacción cruzada**: venta en PG y comprobante en Mongo (todo o nada) | PG + Mongo |
| GET | `/ventas/{id}/verificacion` | Comprueba que la venta exista y coincida en los dos motores | PG + Mongo |
| GET | `/demo/datos-venta` | Función futura con cupo, boleta y espectador válidos (para la demo) | PG |

Cuerpo de `POST /ventas`:

```json
{ "id_funcion": 20, "id_espectador": 1, "id_tipo_boleta": 1, "cantidad": 2, "canal": "WEB",
  "id_staff": null, "simular_fallo_mongo": false }
```

## Manejo de errores

Todos los errores responden con el mismo formato:

```json
{ "error": { "estado": 422, "motor": "postgresql", "mensaje": "sp_registrar_venta: cantidad inválida (debe estar entre 1 y 10)",
             "detalle": "La venta no quedó en ningún motor (todo o nada)." } }
```

| Código | Cuándo | `motor` | Ejemplo en Postman |
|--------|--------|---------|--------------------|
| 400 | Cuerpo o parámetro inválido (falta un campo, tipo errado, canal no permitido) | `api` | "Venta sin campos obligatorios", "Id no numérico" |
| 404 | La función, película o venta no existe, o la ruta no existe | `postgresql` / `integracion` / `api` | "Función inexistente" |
| 422 | Regla de negocio rechazada: función finalizada, cantidad fuera de rango, taquilla sin empleado… o MongoDB rechazó el comprobante y se hizo **ROLLBACK** en PostgreSQL | `postgresql` / `mongodb` | "Falla en MongoDB → ROLLBACK" |
| 503 | Un motor no responde (credenciales erradas, sin red, Neon dormido) | `postgresql` / `mongodb` | Se prueba a mano (ver abajo) |
| 500 | Error no previsto; responde un JSON, nunca un *traceback* | `api` | — |

**Probar el 503 a mano.** Detenga la API, cambie `MONGO_URL` en `.env` por `mongodb://127.0.0.1:1`, vuelva a levantarla y
llame a `GET /`: responde 503 con `"conectado": false` y el motivo. Después restaure el `.env`.

## Colección Postman

En `postman/` están `CuevanaCinema-entrega-final.postman_collection.json` y el entorno `CuevanaCinema-local`.

| Carpeta | Peticiones | Qué prueba |
|---------|-----------:|------------|
| 1. Estado de los motores | 1 | La API llega a PostgreSQL y a MongoDB |
| 2. Casos de uso (camino feliz) | 3 | Los 3 casos combinan datos de ambos motores y los totales cuadran |
| 3. Transacción cruzada (camino feliz) | 3 | Vende 1 boleta, comprueba el comprobante en Mongo y verifica que coincidan |
| 4. Manejo de errores | 12 | 400, 404 y 422, incluido el ROLLBACK por falla en MongoDB |

**En Postman:** *Import* → los dos archivos → seleccione el entorno *CuevanaCinema local* → *Run collection*.

**Por consola:**

```bash
npx newman run postman/CuevanaCinema-entrega-final.postman_collection.json -e postman/CuevanaCinema-local.postman_environment.json
```

Resultado real en `evidencias/newman.txt`: **19 peticiones y 64 aserciones, 0 fallidas**.

> La carpeta 3 registra **una venta real** de 1 boleta en cada corrida.
