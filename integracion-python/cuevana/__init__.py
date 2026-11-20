"""Acceso a las dos bases de CuevanaCinema.

PostgreSQL (cine_avance1, núcleo transaccional) y MongoDB (cine_avance2, capa
documental) comparten los mismos identificadores. Este paquete lo usan la API
(FastAPI, para Postman) y los notebooks de Google Colab, así que cada consulta
y cada regla entre motores se escribe una sola vez.
"""
