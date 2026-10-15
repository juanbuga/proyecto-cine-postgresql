SET client_encoding = 'UTF8';


DROP TABLE IF EXISTS
    contratos,
    actores_directores,
    ventas,
    staff,
    espectadores,
    tipos_boleta,
    funciones,
    peliculas,
    salas,
    sedes
CASCADE;


-- sedes 
CREATE TABLE sedes (
    id_sede     INTEGER GENERATED ALWAYS AS IDENTITY,
    nombre      VARCHAR(60)  NOT NULL,
    direccion   VARCHAR(120) NOT NULL,
    localidad   VARCHAR(40)  NOT NULL,
    activa      BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_sedes PRIMARY KEY (id_sede),
    CONSTRAINT uq_sedes_nombre UNIQUE (nombre),
    CONSTRAINT ck_sedes_localidad CHECK (localidad IN (
        'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme',
        'Tunjuelito', 'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba',
        'Barrios Unidos', 'Teusaquillo', 'Los Mártires', 'Antonio Nariño',
        'Puente Aranda', 'La Candelaria', 'Rafael Uribe Uribe',
        'Ciudad Bolívar', 'Sumapaz'))
);


-- salas 

CREATE TABLE salas (
    id_sala     INTEGER GENERATED ALWAYS AS IDENTITY,
    id_sede     INTEGER      NOT NULL,
    numero      SMALLINT     NOT NULL,
    formato     VARCHAR(2)   NOT NULL,
    capacidad   SMALLINT     NOT NULL,
    estado      VARCHAR(15)  NOT NULL DEFAULT 'ACTIVA',
    CONSTRAINT pk_salas PRIMARY KEY (id_sala),
    CONSTRAINT fk_salas_sedes FOREIGN KEY (id_sede)
        REFERENCES sedes (id_sede) ON DELETE RESTRICT,
    CONSTRAINT uq_salas_sede_numero UNIQUE (id_sede, numero),
    CONSTRAINT ck_salas_numero CHECK (numero BETWEEN 1 AND 20),
    CONSTRAINT ck_salas_formato CHECK (formato IN ('2D', '3D', '4D')),
    CONSTRAINT ck_salas_capacidad CHECK (capacidad BETWEEN 20 AND 300),
    CONSTRAINT ck_salas_estado CHECK (estado IN ('ACTIVA', 'MANTENIMIENTO', 'INACTIVA'))
);


-- peliculas 

CREATE TABLE peliculas (
    id_pelicula    INTEGER GENERATED ALWAYS AS IDENTITY,
    titulo         VARCHAR(150) NOT NULL,
    genero         VARCHAR(20)  NOT NULL,
    duracion_min   SMALLINT     NOT NULL,
    edad_minima    SMALLINT     NOT NULL DEFAULT 0,
    fecha_estreno  DATE         NOT NULL,
    estado         VARCHAR(15)  NOT NULL DEFAULT 'EN_CARTELERA',
    CONSTRAINT pk_peliculas PRIMARY KEY (id_pelicula),
    CONSTRAINT uq_peliculas_titulo_estreno UNIQUE (titulo, fecha_estreno),
    CONSTRAINT ck_peliculas_genero CHECK (genero IN (
        'ACCION', 'ANIMACION', 'CIENCIA_FICCION', 'COMEDIA', 'DOCUMENTAL',
        'DRAMA', 'FAMILIAR', 'ROMANCE', 'SUSPENSO', 'TERROR')),
    CONSTRAINT ck_peliculas_duracion CHECK (duracion_min BETWEEN 60 AND 240),
    CONSTRAINT ck_peliculas_edad_minima CHECK (edad_minima IN (0, 7, 12, 15, 18)),
    CONSTRAINT ck_peliculas_estado CHECK (estado IN ('PROXIMAMENTE', 'EN_CARTELERA', 'RETIRADA'))
);


-- funciones

CREATE TABLE funciones (
    id_funcion          INTEGER GENERATED ALWAYS AS IDENTITY,
    id_sala             INTEGER      NOT NULL,
    id_pelicula         INTEGER      NOT NULL,
    fecha_hora_inicio   TIMESTAMP(0) NOT NULL,
    tipo                VARCHAR(15)  NOT NULL DEFAULT 'REGULAR',
    version             VARCHAR(12)  NOT NULL DEFAULT 'DOBLADA',
    estado              VARCHAR(12)  NOT NULL DEFAULT 'PROGRAMADA',
    motivo_cancelacion  VARCHAR(200),
    CONSTRAINT pk_funciones PRIMARY KEY (id_funcion),
    CONSTRAINT fk_funciones_salas FOREIGN KEY (id_sala)
        REFERENCES salas (id_sala) ON DELETE RESTRICT,
    CONSTRAINT fk_funciones_peliculas FOREIGN KEY (id_pelicula)
        REFERENCES peliculas (id_pelicula) ON DELETE RESTRICT,
    CONSTRAINT uq_funciones_sala_inicio UNIQUE (id_sala, fecha_hora_inicio),
    CONSTRAINT ck_funciones_horario
        CHECK (fecha_hora_inicio::time BETWEEN TIME '10:00' AND TIME '23:00'),
    CONSTRAINT ck_funciones_tipo CHECK (tipo IN ('REGULAR', 'PREESTRENO', 'CONVERSATORIO')),
    CONSTRAINT ck_funciones_version CHECK (version IN ('DOBLADA', 'SUBTITULADA')),
    CONSTRAINT ck_funciones_estado CHECK (estado IN ('PROGRAMADA', 'FINALIZADA', 'CANCELADA')),
    CONSTRAINT ck_funciones_motivo
        CHECK ((estado = 'CANCELADA') = (motivo_cancelacion IS NOT NULL))
);

-- tipos_boleta

CREATE TABLE tipos_boleta (
    id_tipo_boleta  INTEGER GENERATED ALWAYS AS IDENTITY,
    categoria       VARCHAR(15)   NOT NULL,
    formato         VARCHAR(2)    NOT NULL,
    precio          NUMERIC(10,2) NOT NULL,
    activo          BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_tipos_boleta PRIMARY KEY (id_tipo_boleta),
    CONSTRAINT uq_tipos_boleta_categoria_formato UNIQUE (categoria, formato),
    CONSTRAINT ck_tipos_boleta_categoria
        CHECK (categoria IN ('GENERAL', 'NINO', 'ADULTO_MAYOR', 'ESTUDIANTE')),
    CONSTRAINT ck_tipos_boleta_formato CHECK (formato IN ('2D', '3D', '4D')),
    CONSTRAINT ck_tipos_boleta_precio CHECK (precio > 0)
);


-- espectadores 

CREATE TABLE espectadores (
    id_espectador     INTEGER GENERATED ALWAYS AS IDENTITY,
    tipo_documento    VARCHAR(2)   NOT NULL,
    numero_documento  VARCHAR(15)  NOT NULL,
    nombres           VARCHAR(60)  NOT NULL,
    apellidos         VARCHAR(60)  NOT NULL,
    fecha_nacimiento  DATE         NOT NULL,
    email             VARCHAR(100),
    telefono          VARCHAR(15),
    fecha_registro    DATE         NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT pk_espectadores PRIMARY KEY (id_espectador),
    CONSTRAINT uq_espectadores_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT uq_espectadores_email UNIQUE (email),
    CONSTRAINT ck_espectadores_tipo_documento CHECK (tipo_documento IN ('CC', 'TI', 'CE', 'PA')),
    CONSTRAINT ck_espectadores_numero_documento CHECK (numero_documento ~ '^[0-9A-Za-z]{5,15}$'),
    CONSTRAINT ck_espectadores_fecha_nacimiento CHECK (fecha_nacimiento >= DATE '1900-01-01'),
    CONSTRAINT ck_espectadores_email CHECK (email ~* '^[^@ ]+@[^@ ]+\.[^@ ]+$'),
    CONSTRAINT ck_espectadores_telefono CHECK (telefono ~ '^[0-9+ ]{7,15}$')
);


-- staff 

CREATE TABLE staff (
    id_staff          INTEGER GENERATED ALWAYS AS IDENTITY,
    id_sede           INTEGER       NOT NULL,
    numero_documento  VARCHAR(12)   NOT NULL,
    nombres           VARCHAR(60)   NOT NULL,
    apellidos         VARCHAR(60)   NOT NULL,
    cargo             VARCHAR(20)   NOT NULL,
    email             VARCHAR(100)  NOT NULL,
    fecha_ingreso     DATE          NOT NULL DEFAULT CURRENT_DATE,
    salario           NUMERIC(12,2) NOT NULL,
    activo            BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_staff PRIMARY KEY (id_staff),
    CONSTRAINT fk_staff_sedes FOREIGN KEY (id_sede)
        REFERENCES sedes (id_sede) ON DELETE RESTRICT,
    CONSTRAINT uq_staff_numero_documento UNIQUE (numero_documento),
    CONSTRAINT uq_staff_email UNIQUE (email),
    CONSTRAINT ck_staff_numero_documento CHECK (numero_documento ~ '^[0-9]{6,12}$'),
    CONSTRAINT ck_staff_cargo
        CHECK (cargo IN ('SUPERVISOR', 'TAQUILLERO', 'PROYECCIONISTA', 'SERVICIOS_GENERALES')),
    CONSTRAINT ck_staff_email CHECK (email ~* '^[^@ ]+@[^@ ]+\.[^@ ]+$'),
    CONSTRAINT ck_staff_salario CHECK (salario > 0)
);


-- ventas

CREATE TABLE ventas (
    id_venta         INTEGER GENERATED ALWAYS AS IDENTITY,
    id_tipo_boleta   INTEGER       NOT NULL,
    id_funcion       INTEGER       NOT NULL,
    id_espectador    INTEGER       NOT NULL,
    id_staff         INTEGER,
    canal            VARCHAR(10)   NOT NULL,
    cantidad         SMALLINT      NOT NULL,
    precio_unitario  NUMERIC(10,2) NOT NULL,
    fecha_venta      TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    estado           VARCHAR(12)   NOT NULL DEFAULT 'PAGADA',
    CONSTRAINT pk_ventas PRIMARY KEY (id_venta),
    CONSTRAINT fk_ventas_tipos_boleta FOREIGN KEY (id_tipo_boleta)
        REFERENCES tipos_boleta (id_tipo_boleta) ON DELETE RESTRICT,
    CONSTRAINT fk_ventas_funciones FOREIGN KEY (id_funcion)
        REFERENCES funciones (id_funcion) ON DELETE RESTRICT,
    CONSTRAINT fk_ventas_espectadores FOREIGN KEY (id_espectador)
        REFERENCES espectadores (id_espectador) ON DELETE RESTRICT,
    CONSTRAINT fk_ventas_staff FOREIGN KEY (id_staff)
        REFERENCES staff (id_staff) ON DELETE RESTRICT,
    CONSTRAINT ck_ventas_canal CHECK (canal IN ('TAQUILLA', 'WEB')),
    CONSTRAINT ck_ventas_cantidad CHECK (cantidad BETWEEN 1 AND 10),
    CONSTRAINT ck_ventas_precio_unitario CHECK (precio_unitario > 0),
    CONSTRAINT ck_ventas_estado CHECK (estado IN ('PAGADA', 'REEMBOLSADA')),
    CONSTRAINT ck_ventas_canal_staff CHECK ((canal = 'TAQUILLA') = (id_staff IS NOT NULL))
);


-- actores_directores 

CREATE TABLE actores_directores (
    id_actor_director  INTEGER GENERATED ALWAYS AS IDENTITY,
    numero_documento   VARCHAR(20)   NOT NULL,
    nombres            VARCHAR(60)   NOT NULL,
    apellidos          VARCHAR(60)   NOT NULL,
    tipo               VARCHAR(10)   NOT NULL,
    nacionalidad       VARCHAR(40)   NOT NULL DEFAULT 'Colombia',
    email              VARCHAR(100),
    tarifa_base        NUMERIC(12,2) NOT NULL,
    activo             BOOLEAN       NOT NULL DEFAULT TRUE,
    fecha_registro     DATE          NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT pk_actores_directores PRIMARY KEY (id_actor_director),
    CONSTRAINT uq_actores_directores_numero_documento UNIQUE (numero_documento),
    CONSTRAINT uq_actores_directores_email UNIQUE (email),
    CONSTRAINT ck_actores_directores_numero_documento
        CHECK (numero_documento ~ '^[0-9A-Za-z]{5,20}$'),
    CONSTRAINT ck_actores_directores_tipo CHECK (tipo IN ('ACTOR', 'DIRECTOR', 'AMBOS')),
    CONSTRAINT ck_actores_directores_email CHECK (email ~* '^[^@ ]+@[^@ ]+\.[^@ ]+$'),
    CONSTRAINT ck_actores_directores_tarifa_base CHECK (tarifa_base > 0)
);


-- contratos 

CREATE TABLE contratos (
    id_contrato        INTEGER GENERATED ALWAYS AS IDENTITY,
    id_actor_director  INTEGER       NOT NULL,
    id_funcion         INTEGER       NOT NULL,
    participacion      VARCHAR(20)   NOT NULL,
    fecha_firma        DATE          NOT NULL DEFAULT CURRENT_DATE,
    honorarios         NUMERIC(12,2) NOT NULL,
    estado             VARCHAR(12)   NOT NULL DEFAULT 'VIGENTE',
    CONSTRAINT pk_contratos PRIMARY KEY (id_contrato),
    CONSTRAINT fk_contratos_actores_directores FOREIGN KEY (id_actor_director)
        REFERENCES actores_directores (id_actor_director) ON DELETE RESTRICT,
    CONSTRAINT fk_contratos_funciones FOREIGN KEY (id_funcion)
        REFERENCES funciones (id_funcion) ON DELETE RESTRICT,
    CONSTRAINT uq_contratos_actor_funcion UNIQUE (id_actor_director, id_funcion),
    CONSTRAINT ck_contratos_participacion
        CHECK (participacion IN ('PRESENTACION', 'CONVERSATORIO', 'ALFOMBRA_ROJA')),
    CONSTRAINT ck_contratos_honorarios CHECK (honorarios > 0),
    CONSTRAINT ck_contratos_estado CHECK (estado IN ('VIGENTE', 'CUMPLIDO', 'CANCELADO'))
);

-- 11. Índices básicos

-- FK sin índice propio
CREATE INDEX idx_funciones_id_pelicula     ON funciones (id_pelicula);
CREATE INDEX idx_staff_id_sede             ON staff (id_sede);
CREATE INDEX idx_ventas_id_tipo_boleta     ON ventas (id_tipo_boleta);
CREATE INDEX idx_ventas_id_funcion         ON ventas (id_funcion);
CREATE INDEX idx_ventas_id_espectador      ON ventas (id_espectador);
CREATE INDEX idx_ventas_id_staff           ON ventas (id_staff);
CREATE INDEX idx_contratos_id_funcion      ON contratos (id_funcion);

-- Columnas de búsqueda frecuente
CREATE INDEX idx_funciones_fecha_hora_inicio   ON funciones (fecha_hora_inicio);
CREATE INDEX idx_ventas_fecha_venta            ON ventas (fecha_venta);
CREATE INDEX idx_espectadores_numero_documento ON espectadores (numero_documento);
CREATE INDEX idx_espectadores_apellidos        ON espectadores (apellidos);
CREATE INDEX idx_actores_directores_apellidos  ON actores_directores (apellidos);
