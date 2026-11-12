# Evidencias del Avance 2

Capturas de la ejecución real de los scripts con mongosh 2.14.1 sobre MongoDB 8.0.23. Están en el orden en que se corrieron.

| Captura | Qué muestra | Script |
|---|---|---|
| `01_creacion_colecciones.png` | Las 4 colecciones con validación `strict / error` y los 11 índices | `01_creacion_colecciones.js` |
| `01_validador_reportes_incidentes.png` | Reglas `oneOf` del validador de `reportes_incidentes`, leídas desde el servidor | `01_creacion_colecciones.js` |
| `02_datos_prueba.png` | Carga de 30, 31, 40 y 35 documentos y las 9 pruebas rechazadas (8 por `$jsonSchema`, 1 por índice único) | `02_datos_prueba.js` |
| `02_documento_ficha_programada.png` | Ficha de una película enlazada a PostgreSQL (`id_pelicula: 9`) | `02_datos_prueba.js` |
| `02_documento_ficha_catalogo.png` | Ficha del catálogo (`id_pelicula: null`) con `relacionada_con` | `02_datos_prueba.js` |
| `02_documento_requisito_preestreno.png` | Requisitos del preestreno de la función 30 (3D, subtítulos, preestreno, IMAX no disponible, KDM) | `02_datos_prueba.js` |
| `02_documento_resena_verificada.png` | Reseña con compra verificada (venta 48, función 13) y respuesta de la empresa | `02_datos_prueba.js` |
| `02_documento_reportes_por_tipo.png` | Un reporte de cada tipo: seguridad, falla técnica y queja | `02_datos_prueba.js` |
| `03_consulta_1.png` | Películas en cartelera con subtítulos SDH (`find` + `$elemMatch`) | `03_consultas.js` |
| `03_consulta_2.png` | Incidentes abiertos de prioridad alta o crítica (`find`) | `03_consultas.js` |
| `03_consulta_3.png` | Calificación por película (`$group` + `$lookup`) | `03_consultas.js` |
| `03_consulta_4.png` | Incidentes por sede y tipo (`$group` + `$setWindowFields`) | `03_consultas.js` |
| `03_consulta_5.png` | Requisitos pendientes de los próximos 7 días (`$unwind` + `$group`) | `03_consultas.js` |
| `03_consulta_6.png` | Reseñas negativas cruzadas con incidentes (`$text` + `$lookup`) | `03_consultas.js` |
