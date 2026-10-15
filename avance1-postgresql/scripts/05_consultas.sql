SET client_encoding = 'UTF8';

-- C1: muestra, por cada sede, cuántas salas y butacas tiene en total, en servicio y por formato (2D, 3D y 4D).
SELECT se.nombre                                                     AS sede,
       se.localidad,
       COUNT(*)                                                      AS salas,
       COUNT(*) FILTER (WHERE sa.estado = 'ACTIVA')                  AS salas_activas,
       COUNT(*) FILTER (WHERE sa.formato = '2D')                     AS salas_2d,
       COUNT(*) FILTER (WHERE sa.formato = '3D')                     AS salas_3d,
       COUNT(*) FILTER (WHERE sa.formato = '4D')                     AS salas_4d,
       SUM(sa.capacidad)                                             AS butacas,
       COALESCE(SUM(sa.capacidad) FILTER (WHERE sa.estado = 'ACTIVA'), 0) AS butacas_en_servicio,
       COALESCE(SUM(sa.capacidad) FILTER (WHERE sa.formato = '2D'), 0)    AS butacas_2d,
       COALESCE(SUM(sa.capacidad) FILTER (WHERE sa.formato = '3D'), 0)    AS butacas_3d,
       COALESCE(SUM(sa.capacidad) FILTER (WHERE sa.formato = '4D'), 0)    AS butacas_4d
FROM sedes se
JOIN salas sa ON sa.id_sede = se.id_sede
GROUP BY se.id_sede, se.nombre, se.localidad
ORDER BY butacas DESC;

-- C2: lista las películas de mayor a menor ingreso, con boletas vendidas, precio promedio y el porcentaje que aporta cada una al total (solo ventas pagadas).
SELECT p.titulo,
       p.genero,
       p.edad_minima,
       COUNT(DISTINCT f.id_funcion)                                  AS funciones_con_ventas,
       SUM(v.cantidad)                                               AS boletas,
       SUM(v.cantidad * v.precio_unitario)                           AS ingresos,
       ROUND(SUM(v.cantidad * v.precio_unitario) / SUM(v.cantidad))  AS precio_promedio,
       ROUND(100.0 * SUM(v.cantidad * v.precio_unitario)
             / SUM(SUM(v.cantidad * v.precio_unitario)) OVER (), 1)  AS participacion_pct
FROM ventas v
JOIN funciones f ON f.id_funcion = v.id_funcion
JOIN peliculas p ON p.id_pelicula = f.id_pelicula
WHERE v.estado = 'PAGADA'
GROUP BY p.id_pelicula, p.titulo, p.genero, p.edad_minima
ORDER BY ingresos DESC, boletas DESC;



-- C3: muestra las funciones cuya ocupación supera el promedio de su mismo formato, sin contar las canceladas.
WITH ocupacion AS (
    SELECT f.id_funcion,
           se.nombre            AS sede,
           sa.numero            AS sala,
           sa.formato,
           p.titulo,
           f.fecha_hora_inicio,
           f.estado,
           sa.capacidad,
           COALESCE(SUM(v.cantidad) FILTER (WHERE v.estado = 'PAGADA'), 0) AS boletas
    FROM funciones f
    JOIN salas sa      ON sa.id_sala = f.id_sala
    JOIN sedes se      ON se.id_sede = sa.id_sede
    JOIN peliculas p   ON p.id_pelicula = f.id_pelicula
    LEFT JOIN ventas v ON v.id_funcion = f.id_funcion
    WHERE f.estado <> 'CANCELADA'
    GROUP BY f.id_funcion, se.nombre, sa.numero, sa.formato, p.titulo,
             f.fecha_hora_inicio, f.estado, sa.capacidad
)
SELECT o.id_funcion,
       o.sede,
       o.sala,
       o.formato,
       o.titulo,
       o.fecha_hora_inicio,
       o.estado,
       o.capacidad,
       o.boletas,
       ROUND(100.0 * o.boletas / o.capacidad, 1)                     AS ocupacion_pct,
       ROUND(100.0 * (SELECT AVG(x.boletas::numeric / x.capacidad)
                        FROM ocupacion x
                       WHERE x.formato = o.formato), 1)              AS promedio_formato_pct
FROM ocupacion o
WHERE o.boletas::numeric / o.capacidad >
      (SELECT AVG(x.boletas::numeric / x.capacidad)
         FROM ocupacion x
        WHERE x.formato = o.formato)
ORDER BY o.formato, ocupacion_pct DESC;
