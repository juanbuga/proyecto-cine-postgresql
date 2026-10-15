
SET client_encoding = 'UTF8';

CREATE OR REPLACE FUNCTION fn_trg_ventas_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_funcion funciones.estado%TYPE;
    v_inicio funciones.fecha_hora_inicio%TYPE;
    v_sede_funcion salas.id_sede%TYPE;
    v_formato_sala salas.formato%TYPE;
    v_estado_sala salas.estado%TYPE;
    v_capacidad salas.capacidad%TYPE;
    v_edad_minima peliculas.edad_minima%TYPE;
    v_formato_boleta tipos_boleta.formato%TYPE;
    v_precio tipos_boleta.precio%TYPE;
    v_boleta_activa tipos_boleta.activo%TYPE;
    v_nacimiento espectadores.fecha_nacimiento%TYPE;
    v_cargo staff.cargo%TYPE;
    v_sede_staff staff.id_sede%TYPE;
    v_staff_activo staff.activo%TYPE;
    v_edad INTEGER;
    v_vendidas INTEGER;
    v_validar BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_validar := TRUE;
    ELSE
        v_validar := (NEW.estado = 'PAGADA' AND OLD.estado <> 'PAGADA')
                  OR NEW.id_funcion IS DISTINCT FROM OLD.id_funcion
                  OR NEW.id_tipo_boleta IS DISTINCT FROM OLD.id_tipo_boleta
                  OR NEW.id_espectador IS DISTINCT FROM OLD.id_espectador
                  OR NEW.canal IS DISTINCT FROM OLD.canal
                  OR NEW.id_staff IS DISTINCT FROM OLD.id_staff
                  OR NEW.fecha_venta IS DISTINCT FROM OLD.fecha_venta
                  OR NEW.precio_unitario IS DISTINCT FROM OLD.precio_unitario;
    END IF;

    IF v_validar THEN
        SELECT f.estado, f.fecha_hora_inicio, s.id_sede, s.formato,
               s.estado, p.edad_minima
        INTO v_estado_funcion, v_inicio, v_sede_funcion, v_formato_sala,
             v_estado_sala, v_edad_minima
        FROM funciones f
        JOIN salas s ON s.id_sala = f.id_sala
        JOIN peliculas p ON p.id_pelicula = f.id_pelicula
        WHERE f.id_funcion = NEW.id_funcion;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Venta rechazada: la función % no existe.', NEW.id_funcion;
        END IF;

        SELECT formato, precio, activo
        INTO v_formato_boleta, v_precio, v_boleta_activa
        FROM tipos_boleta
        WHERE id_tipo_boleta = NEW.id_tipo_boleta;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Venta rechazada: el tipo de boleta % no existe.', NEW.id_tipo_boleta;
        END IF;

        SELECT fecha_nacimiento
        INTO v_nacimiento
        FROM espectadores
        WHERE id_espectador = NEW.id_espectador;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Venta rechazada: el espectador % no existe.', NEW.id_espectador;
        END IF;

        IF v_formato_boleta <> v_formato_sala THEN
            RAISE EXCEPTION 'Venta rechazada: la boleta es % y la sala de la función % es %.',
                v_formato_boleta, NEW.id_funcion, v_formato_sala;
        END IF;

        v_edad := EXTRACT(YEAR FROM AGE(NEW.fecha_venta::date, v_nacimiento));

        IF v_edad < v_edad_minima THEN
            RAISE EXCEPTION 'Venta rechazada: la película es para mayores de % años y el espectador tiene %.',
                v_edad_minima, v_edad;
        END IF;

        IF NEW.estado = 'PAGADA' THEN
            IF v_estado_funcion = 'CANCELADA' THEN
                RAISE EXCEPTION 'Venta rechazada: la función % está cancelada.', NEW.id_funcion;
            END IF;

            IF NEW.fecha_venta >= v_inicio THEN
                RAISE EXCEPTION 'Venta rechazada: la función % ya inició (%).',
                    NEW.id_funcion, v_inicio;
            END IF;

            IF v_estado_sala <> 'ACTIVA' THEN
                RAISE EXCEPTION 'Venta rechazada: la sala de la función % no está activa.',
                    NEW.id_funcion;
            END IF;

            IF NOT v_boleta_activa THEN
                RAISE EXCEPTION 'Venta rechazada: el tipo de boleta % está inactivo.',
                    NEW.id_tipo_boleta;
            END IF;
        END IF;

        IF TG_OP = 'INSERT' THEN
            IF NEW.precio_unitario IS NULL THEN
                NEW.precio_unitario := v_precio;
            ELSIF NEW.precio_unitario <> v_precio THEN
                RAISE EXCEPTION 'Venta rechazada: el precio % no coincide con la tarifa vigente %.',
                    NEW.precio_unitario, v_precio;
            END IF;
        ELSIF NEW.id_tipo_boleta IS DISTINCT FROM OLD.id_tipo_boleta
           OR NEW.precio_unitario IS DISTINCT FROM OLD.precio_unitario THEN
            IF NEW.precio_unitario IS NOT DISTINCT FROM OLD.precio_unitario THEN
                NEW.precio_unitario := v_precio;
            ELSIF NEW.precio_unitario <> v_precio THEN
                RAISE EXCEPTION 'Venta rechazada: el precio % no coincide con la tarifa vigente %.',
                    NEW.precio_unitario, v_precio;
            END IF;
        END IF;

        IF NEW.canal = 'TAQUILLA' THEN
            SELECT cargo, id_sede, activo
            INTO v_cargo, v_sede_staff, v_staff_activo
            FROM staff
            WHERE id_staff = NEW.id_staff;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Venta rechazada: una venta en taquilla debe registrar al empleado.';
            END IF;

            IF v_cargo <> 'TAQUILLERO' OR NOT v_staff_activo THEN
                RAISE EXCEPTION 'Venta rechazada: el empleado % no es un taquillero activo.',
                    NEW.id_staff;
            END IF;

            IF v_sede_staff <> v_sede_funcion THEN
                RAISE EXCEPTION 'Venta rechazada: el empleado % es de otra sede.',
                    NEW.id_staff;
            END IF;
        END IF;
    END IF;

    IF NEW.estado = 'PAGADA' THEN
        PERFORM 1
        FROM funciones
        WHERE id_funcion = NEW.id_funcion
        FOR UPDATE;

        SELECT s.capacidad
        INTO v_capacidad
        FROM funciones f
        JOIN salas s ON s.id_sala = f.id_sala
        WHERE f.id_funcion = NEW.id_funcion;

        SELECT COALESCE(SUM(cantidad), 0)
        INTO v_vendidas
        FROM ventas
        WHERE id_funcion = NEW.id_funcion
          AND estado = 'PAGADA'
          AND id_venta IS DISTINCT FROM NEW.id_venta;

        IF v_vendidas + NEW.cantidad > v_capacidad THEN
            RAISE EXCEPTION 'Aforo excedido en la función %: capacidad %, vendidas %, solicitadas %.',
                NEW.id_funcion, v_capacidad, v_vendidas, NEW.cantidad;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ventas_validar ON ventas;

CREATE TRIGGER trg_ventas_validar
BEFORE INSERT OR UPDATE ON ventas
FOR EACH ROW
EXECUTE FUNCTION fn_trg_ventas_validar();


CREATE OR REPLACE FUNCTION fn_trg_funciones_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_sala salas.estado%TYPE;
    v_estado_peli peliculas.estado%TYPE;
    v_estreno peliculas.fecha_estreno%TYPE;
    v_duracion peliculas.duracion_min%TYPE;
    v_cruces INTEGER;
BEGIN
    IF NEW.estado <> 'PROGRAMADA' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.id_sala = OLD.id_sala
       AND NEW.id_pelicula = OLD.id_pelicula
       AND NEW.fecha_hora_inicio = OLD.fecha_hora_inicio
       AND NEW.tipo = OLD.tipo
       AND NEW.estado = OLD.estado THEN
        RETURN NEW;
    END IF;

    IF NEW.fecha_hora_inicio <= LOCALTIMESTAMP THEN
        RAISE EXCEPTION 'Función rechazada: no se puede programar en el pasado (%).',
            NEW.fecha_hora_inicio;
    END IF;

    SELECT estado
    INTO v_estado_sala
    FROM salas
    WHERE id_sala = NEW.id_sala;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Función rechazada: la sala % no existe.', NEW.id_sala;
    END IF;

    IF v_estado_sala <> 'ACTIVA' THEN
        RAISE EXCEPTION 'Función rechazada: la sala % está en estado %.',
            NEW.id_sala, v_estado_sala;
    END IF;

    SELECT estado, fecha_estreno, duracion_min
    INTO v_estado_peli, v_estreno, v_duracion
    FROM peliculas
    WHERE id_pelicula = NEW.id_pelicula;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Función rechazada: la película % no existe.', NEW.id_pelicula;
    END IF;

    IF v_estado_peli = 'RETIRADA' THEN
        RAISE EXCEPTION 'Función rechazada: la película % está retirada de cartelera.',
            NEW.id_pelicula;
    END IF;

    IF NEW.tipo = 'PREESTRENO'
       AND NEW.fecha_hora_inicio::date >= v_estreno THEN
        RAISE EXCEPTION 'Función rechazada: un preestreno debe ser antes del estreno (%).',
            v_estreno;
    END IF;

    IF NEW.tipo <> 'PREESTRENO'
       AND NEW.fecha_hora_inicio::date < v_estreno THEN
        RAISE EXCEPTION 'Función rechazada: la película se estrena el %; antes solo se permiten preestrenos.',
            v_estreno;
    END IF;

    SELECT COUNT(*)
    INTO v_cruces
    FROM funciones f
    JOIN peliculas p ON p.id_pelicula = f.id_pelicula
    WHERE f.id_sala = NEW.id_sala
      AND f.estado <> 'CANCELADA'
      AND f.id_funcion IS DISTINCT FROM NEW.id_funcion
      AND f.fecha_hora_inicio <
          NEW.fecha_hora_inicio + (v_duracion + 15) * INTERVAL '1 minute'
      AND NEW.fecha_hora_inicio <
          f.fecha_hora_inicio + (p.duracion_min + 15) * INTERVAL '1 minute';

    IF v_cruces > 0 THEN
        RAISE EXCEPTION 'Función rechazada: se cruza con otra función de la sala % (incluye 15 min de aseo).',
            NEW.id_sala;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_funciones_validar ON funciones;

CREATE TRIGGER trg_funciones_validar
BEFORE INSERT OR UPDATE ON funciones
FOR EACH ROW
EXECUTE FUNCTION fn_trg_funciones_validar();


CREATE OR REPLACE FUNCTION fn_trg_salas_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_programadas INTEGER;
    v_max_vendidas INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_programadas
    FROM funciones
    WHERE id_sala = NEW.id_sala
      AND estado = 'PROGRAMADA'
      AND fecha_hora_inicio > LOCALTIMESTAMP;

    IF NEW.estado <> 'ACTIVA'
       AND OLD.estado = 'ACTIVA'
       AND v_programadas > 0 THEN
        RAISE EXCEPTION 'Sala % no puede pasar a %: tiene % función(es) programada(s).',
            NEW.id_sala, NEW.estado, v_programadas;
    END IF;

    IF NEW.formato <> OLD.formato AND v_programadas > 0 THEN
        RAISE EXCEPTION 'Sala % no puede cambiar de formato: tiene % función(es) programada(s).',
            NEW.id_sala, v_programadas;
    END IF;

    IF NEW.capacidad < OLD.capacidad THEN
        SELECT COALESCE(MAX(x.vendidas), 0)
        INTO v_max_vendidas
        FROM (
            SELECT SUM(v.cantidad) AS vendidas
            FROM ventas v
            JOIN funciones f ON f.id_funcion = v.id_funcion
            WHERE f.id_sala = NEW.id_sala
              AND f.estado = 'PROGRAMADA'
              AND v.estado = 'PAGADA'
            GROUP BY f.id_funcion
        ) x;

        IF NEW.capacidad < v_max_vendidas THEN
            RAISE EXCEPTION 'Sala %: la capacidad % es menor que las % boletas ya vendidas en una función programada.',
                NEW.id_sala, NEW.capacidad, v_max_vendidas;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_salas_validar ON salas;

CREATE TRIGGER trg_salas_validar
BEFORE UPDATE OF estado, formato, capacidad ON salas
FOR EACH ROW
EXECUTE FUNCTION fn_trg_salas_validar();


CREATE OR REPLACE FUNCTION fn_trg_contratos_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_tipo_funcion funciones.tipo%TYPE;
    v_estado_funcion funciones.estado%TYPE;
    v_inicio funciones.fecha_hora_inicio%TYPE;
    v_activo actores_directores.activo%TYPE;
    v_tarifa actores_directores.tarifa_base%TYPE;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.estado = 'CANCELADO' THEN
        RETURN NEW;
    END IF;

    SELECT tipo, estado, fecha_hora_inicio
    INTO v_tipo_funcion, v_estado_funcion, v_inicio
    FROM funciones
    WHERE id_funcion = NEW.id_funcion;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contrato rechazado: la función % no existe.', NEW.id_funcion;
    END IF;

    SELECT activo, tarifa_base
    INTO v_activo, v_tarifa
    FROM actores_directores
    WHERE id_actor_director = NEW.id_actor_director;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contrato rechazado: el actor/director % no existe.',
            NEW.id_actor_director;
    END IF;

    IF v_tipo_funcion = 'REGULAR' THEN
        RAISE EXCEPTION 'Contrato rechazado: la función % es REGULAR; solo se contrata para PREESTRENO o CONVERSATORIO.',
            NEW.id_funcion;
    END IF;

    IF NEW.participacion = 'CONVERSATORIO'
       AND v_tipo_funcion <> 'CONVERSATORIO' THEN
        RAISE EXCEPTION 'Contrato rechazado: la participación CONVERSATORIO exige una función CONVERSATORIO.';
    END IF;

    IF NEW.participacion <> 'CONVERSATORIO'
       AND v_tipo_funcion <> 'PREESTRENO' THEN
        RAISE EXCEPTION 'Contrato rechazado: la participación % exige una función PREESTRENO.',
            NEW.participacion;
    END IF;

    IF TG_OP = 'INSERT' AND NOT v_activo THEN
        RAISE EXCEPTION 'Contrato rechazado: el actor/director % está inactivo.',
            NEW.id_actor_director;
    END IF;

    IF (TG_OP = 'INSERT' OR NEW.honorarios IS DISTINCT FROM OLD.honorarios)
       AND NEW.honorarios < v_tarifa THEN
        RAISE EXCEPTION 'Contrato rechazado: los honorarios % son menores que la tarifa base %.',
            NEW.honorarios, v_tarifa;
    END IF;

    IF NEW.fecha_firma > v_inicio::date THEN
        RAISE EXCEPTION 'Contrato rechazado: la firma (%) es posterior a la función (%).',
            NEW.fecha_firma, v_inicio::date;
    END IF;

    IF NEW.estado = 'VIGENTE' AND v_estado_funcion <> 'PROGRAMADA' THEN
        RAISE EXCEPTION 'Contrato rechazado: un contrato VIGENTE exige una función PROGRAMADA (la función % está %).',
            NEW.id_funcion, v_estado_funcion;
    END IF;

    IF NEW.estado = 'CUMPLIDO' AND v_estado_funcion <> 'FINALIZADA' THEN
        RAISE EXCEPTION 'Contrato rechazado: un contrato CUMPLIDO exige una función FINALIZADA (la función % está %).',
            NEW.id_funcion, v_estado_funcion;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contratos_validar ON contratos;

CREATE TRIGGER trg_contratos_validar
BEFORE INSERT OR UPDATE ON contratos
FOR EACH ROW
EXECUTE FUNCTION fn_trg_contratos_validar();


CREATE OR REPLACE FUNCTION fn_trg_espectadores_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_edad INTEGER;
BEGIN
    NEW.nombres := INITCAP(TRIM(NEW.nombres));
    NEW.apellidos := INITCAP(TRIM(NEW.apellidos));
    NEW.email := LOWER(TRIM(NEW.email));

    IF NEW.fecha_nacimiento > CURRENT_DATE THEN
        RAISE EXCEPTION 'Espectador rechazado: la fecha de nacimiento (%) es futura.',
            NEW.fecha_nacimiento;
    END IF;

    IF NEW.fecha_registro > CURRENT_DATE THEN
        RAISE EXCEPTION 'Espectador rechazado: la fecha de registro (%) es futura.',
            NEW.fecha_registro;
    END IF;

    v_edad := EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.fecha_nacimiento));

    IF NEW.tipo_documento = 'CC' AND v_edad < 18 THEN
        RAISE EXCEPTION 'Espectador rechazado: una persona de % años no puede tener cédula (CC); use TI.',
            v_edad;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_espectadores_validar ON espectadores;

CREATE TRIGGER trg_espectadores_validar
BEFORE INSERT OR UPDATE ON espectadores
FOR EACH ROW
EXECUTE FUNCTION fn_trg_espectadores_validar();


CREATE OR REPLACE FUNCTION fn_trg_staff_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.fecha_ingreso > CURRENT_DATE THEN
        RAISE EXCEPTION 'Empleado rechazado: la fecha de ingreso (%) es futura.',
            NEW.fecha_ingreso;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.salario < OLD.salario THEN
        RAISE EXCEPTION 'Empleado %: el salario no puede reducirse (de % a %).',
            NEW.id_staff, OLD.salario, NEW.salario;
    END IF;

    IF NEW.cargo = 'SUPERVISOR' AND NEW.activo THEN
        IF EXISTS (
            SELECT 1
            FROM staff
            WHERE id_sede = NEW.id_sede
              AND cargo = 'SUPERVISOR'
              AND activo
              AND id_staff IS DISTINCT FROM NEW.id_staff
        ) THEN
            RAISE EXCEPTION 'Empleado rechazado: la sede % ya tiene un supervisor activo.',
                NEW.id_sede;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_validar ON staff;

CREATE TRIGGER trg_staff_validar
BEFORE INSERT OR UPDATE ON staff
FOR EACH ROW
EXECUTE FUNCTION fn_trg_staff_validar();


SELECT c.relname AS tabla,
       t.tgname AS trigger,
       CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END AS momento,
       CONCAT_WS(' OR ',
           CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END,
           CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END,
           CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END) AS eventos,
       p.proname AS funcion
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND c.relnamespace = 'public'::regnamespace
ORDER BY c.relname, t.tgname;

SELECT COUNT(*) AS triggers,
       COUNT(DISTINCT t.tgrelid) AS tablas
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal
  AND c.relnamespace = 'public'::regnamespace;

-- TRIGGER 1 Ventas
-- Verifica que las ventas cumplan las reglas como el precio
-- la edad del espectador y la disponibilidad de puestos

-- TRIGGER 2 Funciones
-- Comprueba que las funciones se puedan programar correctamente
-- que la sala esté activa y que no se crucen los horarios

-- TRIGGER 3 Salas
-- Evita cambios en las salas que puedan afectar las funciones
-- programadas o las boletas que ya se vendieron

-- TRIGGER 4 Contratos
-- Verifica que los contratos cumplan las condiciones de la función
-- los honorarios y el estado del actor o director

-- TRIGGER 5 Espectadores
-- Organiza los datos de los espectadores y valida sus fechas
-- y tipo de documento según la edad

-- TRIGGER 6 Staff
-- Verifica que la fecha de ingreso sea válida que el salario no
-- disminuya y que cada sede tenga un solo supervisor activo