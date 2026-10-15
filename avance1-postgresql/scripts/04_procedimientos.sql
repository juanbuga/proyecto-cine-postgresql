-- =====================================================================
--  Base de Datos II · Avance 1 · Núcleo transaccional (PostgreSQL)
--  Empresa:     CuevanaCinema (Bogotá D.C.)
--  Script:      04_procedimientos.sql
--  Responsable: Juan Buitrago · Revisan: Sergio Hernandez y Nicole Cruz
--  Propósito:   Procedimientos almacenados del núcleo. Todos validan sus
--               parámetros y manejan errores con EXCEPTION y RAISE.
--  Requisito:   P1 cálculo o transacción · P2 reporte con agregación ·
--               P3 mantenimiento u operación.
--  Orden:       4 de 5. Después de 01, 02 y 03 (los triggers se disparan
--               dentro de los procedimientos).

-- =====================================================================

SET client_encoding = 'UTF8';

-- ---------------------------------------------------------------------
-- P1 · sp_registrar_venta — cálculo o transacción
-- Propósito:   registrar una compra con todas sus validaciones y devolver id y total
-- Parámetros:  p_id_funcion, p_id_espectador, p_id_tipo_boleta, p_cantidad,
--               p_canal, p_id_staff (opcional), INOUT p_id_venta, INOUT p_total
-- Rechaza:     parámetros nulos, canal inválido, cantidad fuera de rango,
--               espectador/función/tipo de boleta inexistentes o inactivos,
--               función no PROGRAMADA o ya iniciada, y en TAQUILLA: staff
--               inactivo, cargo distinto de TAQUILLERO o de otra sede (R13).
--               El trigger trg_ventas_validar valida además aforo, formato
--               y edad, y fija el precio vigente.
-- ---------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE sp_registrar_venta(
    p_id_funcion     INTEGER,
    p_id_espectador  INTEGER,
    p_id_tipo_boleta INTEGER,
    p_cantidad       INTEGER,
    p_canal          VARCHAR,
    p_id_staff       INTEGER DEFAULT NULL,
    INOUT p_id_venta INTEGER DEFAULT NULL,
    INOUT p_total    NUMERIC DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_precio_unitario NUMERIC(10,2);
    v_fecha_inicio    TIMESTAMP(0);
    v_estado_funcion  VARCHAR(12);
    v_id_sede_funcion INTEGER;
    v_staff_cargo     VARCHAR(20);
    v_staff_activo    BOOLEAN;
    v_staff_id_sede   INTEGER;
    v_tipo_activo     BOOLEAN;
BEGIN
    -- 1. Validar parámetros obligatorios
    IF p_id_funcion IS NULL OR p_id_espectador IS NULL OR p_id_tipo_boleta IS NULL
       OR p_cantidad IS NULL OR p_canal IS NULL THEN
        RAISE EXCEPTION 'sp_registrar_venta: los parámetros son obligatorios';
    END IF;

    -- 2. Validar canal
    IF p_canal NOT IN ('TAQUILLA', 'WEB') THEN
        RAISE EXCEPTION 'sp_registrar_venta: canal inválido (debe ser TAQUILLA o WEB)';
    END IF;

    -- 3. Validar relación canal-staff (R06)
    IF p_canal = 'TAQUILLA' AND p_id_staff IS NULL THEN
        RAISE EXCEPTION 'sp_registrar_venta: en TAQUILLA el empleado (id_staff) es obligatorio';
    END IF;
    IF p_canal = 'WEB' AND p_id_staff IS NOT NULL THEN
        RAISE EXCEPTION 'sp_registrar_venta: en WEB no debe registrarse empleado (id_staff debe ser NULL)';
    END IF;

    -- 4. Validar cantidad (R05)
    IF p_cantidad < 1 OR p_cantidad > 10 THEN
        RAISE EXCEPTION 'sp_registrar_venta: cantidad inválida (debe estar entre 1 y 10)';
    END IF;

    -- 5. Validar existencia y estado de la función
    SELECT f.fecha_hora_inicio, f.estado, s.id_sede
      INTO v_fecha_inicio, v_estado_funcion, v_id_sede_funcion
      FROM funciones f
      JOIN salas s ON s.id_sala = f.id_sala
     WHERE f.id_funcion = p_id_funcion;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sp_registrar_venta: no existe función con id %', p_id_funcion;
    END IF;

    IF v_estado_funcion <> 'PROGRAMADA' THEN
        RAISE EXCEPTION 'sp_registrar_venta: solo se pueden vender funciones PROGRAMADAS (estado actual: %)', v_estado_funcion;
    END IF;

    -- 6. Validar que la función no haya iniciado
    IF v_fecha_inicio <= LOCALTIMESTAMP(0) THEN
        RAISE EXCEPTION 'sp_registrar_venta: la función ya inició o está por iniciar (inicio: %)', v_fecha_inicio;
    END IF;

    -- 7. Validar espectador
    IF NOT EXISTS (SELECT 1 FROM espectadores e WHERE e.id_espectador = p_id_espectador) THEN
        RAISE EXCEPTION 'sp_registrar_venta: no existe espectador con id %', p_id_espectador;
    END IF;

    -- 8. Validar tipo de boleta
    SELECT tb.activo
      INTO v_tipo_activo
      FROM tipos_boleta tb
     WHERE tb.id_tipo_boleta = p_id_tipo_boleta;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sp_registrar_venta: no existe tipo de boleta con id %', p_id_tipo_boleta;
    END IF;

    IF v_tipo_activo IS NOT TRUE THEN
        RAISE EXCEPTION 'sp_registrar_venta: el tipo de boleta está inactivo';
    END IF;

    -- 9. Validación R20 (solo TAQUILLA): empleado activo, cargo válido, misma sede que la función
    IF p_canal = 'TAQUILLA' THEN
        SELECT s.cargo, s.activo, s.id_sede
          INTO v_staff_cargo, v_staff_activo, v_staff_id_sede
          FROM staff s
         WHERE s.id_staff = p_id_staff;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'sp_registrar_venta: no existe empleado (staff) con id %', p_id_staff;
        END IF;

        IF v_staff_activo IS NOT TRUE THEN
            RAISE EXCEPTION 'sp_registrar_venta: el empleado de taquilla no está activo';
        END IF;

        -- Igual que trg_ventas_validar: en taquilla solo vende un TAQUILLERO
        IF v_staff_cargo <> 'TAQUILLERO' THEN
            RAISE EXCEPTION 'sp_registrar_venta: en taquilla solo vende un TAQUILLERO (cargo del empleado: %)', v_staff_cargo;
        END IF;

        IF v_staff_id_sede <> v_id_sede_funcion THEN
            RAISE EXCEPTION 'sp_registrar_venta: el empleado pertenece a otra sede que la función';
        END IF;
    END IF;

    -- 10. Insertar venta. El trigger de ventas valida aforo, formato, edad,
    --     canal/staff y fija precio_unitario con la tarifa vigente cuando llega NULL.
    INSERT INTO ventas (id_tipo_boleta, id_funcion, id_espectador, id_staff, canal, cantidad, precio_unitario, fecha_venta, estado)
    VALUES (p_id_tipo_boleta, p_id_funcion, p_id_espectador, p_id_staff, p_canal, p_cantidad, NULL, LOCALTIMESTAMP(0), 'PAGADA')
    RETURNING id_venta, precio_unitario
    INTO p_id_venta, v_precio_unitario;

    -- 11. Calcular total y devolverlo
    p_total := p_cantidad * v_precio_unitario;

    RAISE NOTICE 'sp_registrar_venta: venta registrada id_venta=% total=%', p_id_venta, p_total;

EXCEPTION
    WHEN raise_exception THEN
        RAISE;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'sp_registrar_venta: error inesperado: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

-- ---------------------------------------------------------------------
-- P2 · sp_reporte_ocupacion — reporte con agregación
-- Propósito:   ocupación e ingresos por sede y formato en un rango de fechas
-- Parámetros:  p_desde DATE, p_hasta DATE, INOUT p_resultado REFCURSOR
-- Rechaza:     fechas nulas, p_desde > p_hasta, rango mayor a 366 días
-- Cómo se ve:  refcursor 'reporte_ocupacion' (se muestra con FETCH ALL)
-- ---------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE sp_reporte_ocupacion(
    p_desde           DATE,
    p_hasta           DATE,
    INOUT p_resultado REFCURSOR DEFAULT 'reporte_ocupacion'
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. Validar parámetros
    IF p_desde IS NULL OR p_hasta IS NULL THEN
        RAISE EXCEPTION 'sp_reporte_ocupacion: rango de fechas inválido (% a %)', p_desde, p_hasta;
    END IF;

    IF p_desde > p_hasta THEN
        RAISE EXCEPTION 'sp_reporte_ocupacion: rango de fechas inválido (% a %)', p_desde, p_hasta;
    END IF;

    -- 2. Validar rango máximo de 366 días
    IF (p_hasta - p_desde) > 366 THEN
        RAISE EXCEPTION 'sp_reporte_ocupacion: rango de fechas superior a 366 días (% a %)', p_desde, p_hasta;
    END IF;

    -- 3. Abrir cursor con reporte por sede y formato
    --    Se calcula primero por función para no contar dos veces la capacidad
    --    al unir con ventas.
    OPEN p_resultado FOR
        WITH funciones_con_datos AS (
            SELECT
                sed.nombre    AS sede,
                sal.formato   AS formato,
                sal.capacidad AS capacidad_sala,
                f.id_funcion  AS id_funcion,
                COALESCE(SUM(v.cantidad) FILTER (WHERE v.estado = 'PAGADA'), 0) AS boletas_pagadas,
                COALESCE(SUM(v.cantidad * v.precio_unitario) FILTER (WHERE v.estado = 'PAGADA'), 0) AS ingresos_funcion
            FROM funciones f
            JOIN salas sal ON sal.id_sala = f.id_sala
            JOIN sedes sed ON sed.id_sede = sal.id_sede
            LEFT JOIN ventas v ON v.id_funcion = f.id_funcion
            WHERE f.estado <> 'CANCELADA'
              AND f.fecha_hora_inicio::date BETWEEN p_desde AND p_hasta
            GROUP BY sed.nombre, sal.formato, sal.capacidad, f.id_funcion
        )
        SELECT
            sede,
            formato,
            COUNT(*)           AS funciones,
            SUM(capacidad_sala) AS capacidad_ofrecida,
            SUM(boletas_pagadas) AS boletas_pagadas,
            ROUND(SUM(boletas_pagadas) * 100.0 / NULLIF(SUM(capacidad_sala), 0), 2) AS ocupacion_porcentaje,
            SUM(ingresos_funcion) AS ingresos
        FROM funciones_con_datos
        GROUP BY sede, formato
        ORDER BY sede, formato;

EXCEPTION
    WHEN raise_exception THEN
        RAISE;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'sp_reporte_ocupacion: error inesperado: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;

-- ---------------------------------------------------------------------
-- P3 · sp_cancelar_funcion — mantenimiento u operación
-- Propósito:   cancelar una función, reembolsar sus ventas y cancelar sus contratos
-- Parámetros:  p_id_funcion INTEGER, p_motivo VARCHAR
-- Rechaza:     parámetros nulos, función inexistente, no PROGRAMADA,
--               ya iniciada o finalizada, motivo con menos de 10 o más de
--               200 caracteres
-- ---------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE sp_cancelar_funcion(
    p_id_funcion INTEGER,
    p_motivo     VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_fecha_inicio   TIMESTAMP(0);
    v_estado_funcion VARCHAR(12);
    v_ventas_reemb   INTEGER := 0;
    v_boletas_reemb  INTEGER := 0;
    v_valor_reemb    NUMERIC(12,2) := 0;
    v_contratos_canc INTEGER := 0;
BEGIN
    -- 1. Validar parámetros
    IF p_id_funcion IS NULL OR p_motivo IS NULL THEN
        RAISE EXCEPTION 'sp_cancelar_funcion: los parámetros son obligatorios';
    END IF;

    IF LENGTH(TRIM(p_motivo)) < 10 THEN
        RAISE EXCEPTION 'sp_cancelar_funcion: el motivo debe tener al menos 10 caracteres';
    END IF;

    IF LENGTH(p_motivo) > 200 THEN
        RAISE EXCEPTION 'sp_cancelar_funcion: el motivo tiene % caracteres y el máximo es 200', LENGTH(p_motivo);
    END IF;

    -- 2. Validar función (y bloquearla hasta terminar, para que no entre
    --    una venta mientras se cancela)
    SELECT f.fecha_hora_inicio, f.estado
      INTO v_fecha_inicio, v_estado_funcion
      FROM funciones f
     WHERE f.id_funcion = p_id_funcion
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sp_cancelar_funcion: no existe función con id %', p_id_funcion;
    END IF;

    IF v_estado_funcion <> 'PROGRAMADA' THEN
        RAISE EXCEPTION 'sp_cancelar_funcion: solo se pueden cancelar funciones PROGRAMADAS (estado actual: %)', v_estado_funcion;
    END IF;

    IF v_fecha_inicio <= LOCALTIMESTAMP(0) THEN
        RAISE EXCEPTION 'sp_cancelar_funcion: no se puede cancelar una función que ya inició';
    END IF;

    -- 3. Obtener conteos antes de actualizar (para el aviso)
    SELECT COUNT(*)::INTEGER,
           COALESCE(SUM(v.cantidad), 0)::INTEGER,
           COALESCE(SUM(v.cantidad * v.precio_unitario), 0)::NUMERIC(12,2)
      INTO v_ventas_reemb, v_boletas_reemb, v_valor_reemb
      FROM ventas v
     WHERE v.id_funcion = p_id_funcion
       AND v.estado = 'PAGADA';

    SELECT COUNT(*)::INTEGER
      INTO v_contratos_canc
      FROM contratos c
     WHERE c.id_funcion = p_id_funcion
       AND c.estado = 'VIGENTE';

    -- 4. Operación atómica: todo o nada
    UPDATE funciones
       SET estado = 'CANCELADA', motivo_cancelacion = p_motivo
     WHERE id_funcion = p_id_funcion;

    UPDATE ventas
       SET estado = 'REEMBOLSADA'
     WHERE id_funcion = p_id_funcion
       AND estado = 'PAGADA';

    UPDATE contratos
       SET estado = 'CANCELADO'
     WHERE id_funcion = p_id_funcion
       AND estado = 'VIGENTE';

    RAISE NOTICE 'sp_cancelar_funcion: función % cancelada. Ventas reembolsadas: % (% boleta(s), valor $%). Contratos cancelados: %',
        p_id_funcion, v_ventas_reemb, v_boletas_reemb, v_valor_reemb, v_contratos_canc;

EXCEPTION
    WHEN raise_exception THEN
        RAISE;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'sp_cancelar_funcion: error inesperado: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;


-- ---------------------------------------------------------------------
-- Verificación — evidencia para evidencias/procedimientos/
-- Lista los procedimientos y funciones creados (sin las de los triggers).
-- ---------------------------------------------------------------------
SELECT p.proname                                  AS nombre,
       CASE p.prokind WHEN 'p' THEN 'procedimiento'
                      WHEN 'f' THEN 'función'
       END                                        AS tipo,
       pg_get_function_identity_arguments(p.oid)  AS parametros
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind IN ('p', 'f')
  AND p.prorettype <> 'trigger'::regtype
ORDER BY tipo DESC, nombre;
