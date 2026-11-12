// Avance 2 · Capa documental de CuevanaCinema en MongoDB
// 01: crea la base cine_avance2 con sus 4 colecciones, la validación $jsonSchema de cada una y los índices.
// Se puede correr varias veces: borra las colecciones y las vuelve a crear.
// Uso: mongosh "<cadena de conexión>" --file scripts/01_creacion_colecciones.js

db = db.getSiblingDB('cine_avance2');

const COLECCIONES = ['fichas_tecnicas_peliculas', 'requisitos_proyeccion', 'resenas_peliculas', 'reportes_incidentes'];
COLECCIONES.forEach(c => db.getCollection(c).drop());

// Identificador compartido con PostgreSQL: mismo nombre y tipo (INTEGER) que la llave primaria allá
const idPg = referencia => ({ bsonType: 'int', minimum: 1, description: `id de ${referencia} en PostgreSQL` });
const codigoPais = { bsonType: 'string', pattern: '^[A-Z]{2}$', description: 'código ISO 3166-1 de dos letras' };
const codigoIdioma = { bsonType: 'string', pattern: '^[a-z]{2}$', description: 'código ISO 639-1 de dos letras' };
const fecha = { bsonType: 'date' };
const versionEsquema = { bsonType: 'int', minimum: 1, description: 'versión del esquema del documento' };
const COMPONENTES = ['3D', '4D', 'IMAX', 'DOLBY_ATMOS', 'SUBTITULOS', 'CONVERSATORIO', 'PREESTRENO'];


// fichas_tecnicas_peliculas
db.createCollection('fichas_tecnicas_peliculas', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      title: 'Ficha técnica de una película',
      required: ['id_pelicula', 'estado_catalogo', 'titulo', 'anio', 'paises_produccion', 'generos', 'direccion',
                 'versiones', 'idiomas_audio', 'subtitulos', 'clasificaciones', 'esquema_version', 'registrado_en'],
      properties: {
        id_pelicula: { bsonType: ['int', 'null'], description: 'peliculas.id_pelicula; null mientras la película no esté programada' },
        estado_catalogo: { enum: ['PROGRAMADA', 'EN_EVALUACION', 'EN_NEGOCIACION', 'DESCARTADA'] },
        titulo: { bsonType: 'string', minLength: 1, maxLength: 150 },
        titulo_original: { bsonType: 'string', maxLength: 150 },
        anio: { bsonType: 'int', minimum: 1900, maximum: 2100 },
        paises_produccion: { bsonType: 'array', minItems: 1, uniqueItems: true, items: codigoPais },
        generos: {
          bsonType: 'array', minItems: 1, maxItems: 3, uniqueItems: true,
          items: { enum: ['ACCION', 'ANIMACION', 'AVENTURA', 'CIENCIA_FICCION', 'COMEDIA', 'DOCUMENTAL', 'DRAMA',
                          'FAMILIAR', 'MUSICAL', 'ROMANCE', 'SUSPENSO', 'TERROR'] }
        },
        sinopsis: { bsonType: 'string', maxLength: 1000 },
        distribuidora: {
          bsonType: 'object', required: ['nombre', 'pais'],
          properties: { nombre: { bsonType: 'string' }, pais: codigoPais, contacto: { bsonType: 'string' } }
        },
        direccion: {
          bsonType: 'array', minItems: 1, maxItems: 5,
          items: {
            bsonType: 'object', required: ['nombre'],
            properties: { nombre: { bsonType: 'string', minLength: 3 }, id_actor_director: idPg('actores_directores') }
          }
        },
        reparto: {
          bsonType: 'array', maxItems: 40,
          items: {
            bsonType: 'object', required: ['nombre', 'personaje'],
            properties: {
              nombre: { bsonType: 'string', minLength: 3 },
              personaje: { bsonType: 'string' },
              participacion: { enum: ['ACTUACION', 'VOZ', 'NARRACION'] },
              id_actor_director: idPg('actores_directores')
            }
          }
        },
        versiones: {
          bsonType: 'array', minItems: 1, maxItems: 8,
          items: {
            bsonType: 'object', required: ['tipo', 'duracion_min', 'formato_imagen'],
            properties: {
              tipo: { enum: ['CINE', 'EXTENDIDA', 'DIRECTOR', '3D', '4D', 'IMAX'] },
              duracion_min: { bsonType: 'int', minimum: 60, maximum: 240 },
              formato_imagen: { enum: ['2D', '3D', '4D', 'IMAX'] },
              relacion_aspecto: { bsonType: 'string', pattern: '^[0-9]\\.[0-9]{2}:1$' },
              sonido: { bsonType: 'array', items: { enum: ['ESTEREO', '5.1', '7.1', 'DOLBY_ATMOS'] } }
            }
          }
        },
        idiomas_audio: {
          bsonType: 'array', minItems: 1,
          items: {
            bsonType: 'object', required: ['codigo', 'tipo'],
            properties: { codigo: codigoIdioma, idioma: { bsonType: 'string' }, tipo: { enum: ['ORIGINAL', 'DOBLAJE', 'AUDIODESCRIPCION'] } }
          }
        },
        subtitulos: {
          bsonType: 'array',
          items: {
            bsonType: 'object', required: ['codigo', 'tipo'],
            properties: { codigo: codigoIdioma, idioma: { bsonType: 'string' }, tipo: { enum: ['ESTANDAR', 'SDH', 'FORZADOS'] } }
          }
        },
        clasificaciones: {
          bsonType: 'array', minItems: 1,
          items: {
            bsonType: 'object', required: ['pais', 'sistema', 'clasificacion', 'edad_minima'],
            properties: {
              pais: codigoPais,
              sistema: { bsonType: 'string' },
              clasificacion: { bsonType: 'string' },
              edad_minima: { bsonType: ['int', 'null'], minimum: 0, maximum: 21 },
              descriptores: { bsonType: 'array', items: { bsonType: 'string' } }
            }
          }
        },
        relacionada_con: {
          bsonType: 'object', required: ['id_pelicula', 'relacion'],
          properties: { id_pelicula: idPg('peliculas'), relacion: { enum: ['SECUELA', 'PRECUELA', 'REMAKE', 'SPIN_OFF'] } }
        },
        evaluacion: {
          bsonType: 'object', required: ['id_staff', 'fecha', 'puntaje'],
          properties: { id_staff: idPg('staff'), fecha: fecha, puntaje: { bsonType: 'number', minimum: 0, maximum: 10 }, comentario: { bsonType: 'string' } }
        },
        esquema_version: versionEsquema,
        registrado_en: fecha,
        actualizado_en: fecha
      },
      // Programada => tiene id en PostgreSQL; en catálogo => todavía no
      oneOf: [
        { properties: { estado_catalogo: { enum: ['PROGRAMADA'] }, id_pelicula: { bsonType: 'int' } } },
        { properties: { estado_catalogo: { enum: ['EN_EVALUACION', 'EN_NEGOCIACION', 'DESCARTADA'] }, id_pelicula: { bsonType: 'null' } } }
      ]
    }
  },
  validationLevel: 'strict',
  validationAction: 'error'
});


// requisitos_proyeccion
db.createCollection('requisitos_proyeccion', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      title: 'Requisitos técnicos de una función especial',
      required: ['id_funcion', 'id_sala', 'id_sede', 'id_pelicula', 'funcion', 'experiencias', 'requisitos', 'dcp',
                 'verificacion', 'esquema_version', 'creado_en'],
      properties: {
        id_funcion: idPg('funciones'),
        id_sala: idPg('salas'),
        id_sede: idPg('sedes'),
        id_pelicula: idPg('peliculas'),
        funcion: {
          bsonType: 'object', required: ['fecha_hora_inicio', 'tipo', 'version', 'formato_sala'],
          description: 'copia de los datos de la función en PostgreSQL (referencia extendida)',
          properties: {
            fecha_hora_inicio: fecha,
            tipo: { enum: ['REGULAR', 'PREESTRENO', 'CONVERSATORIO'] },
            version: { enum: ['DOBLADA', 'SUBTITULADA'] },
            formato_sala: { enum: ['2D', '3D', '4D'] }
          }
        },
        experiencias: { bsonType: 'array', minItems: 1, uniqueItems: true, items: { enum: COMPONENTES } },
        requisitos: {
          bsonType: 'array', minItems: 1, maxItems: 15,
          items: {
            bsonType: 'object', required: ['componente', 'obligatorio', 'especificacion', 'cumple'],
            properties: {
              componente: { enum: COMPONENTES },
              obligatorio: { bsonType: 'bool' },
              especificacion: { bsonType: 'object', minProperties: 1 },
              cumple: { bsonType: ['bool', 'null'], description: 'null mientras no se haya verificado' },
              observacion: { bsonType: 'string' }
            }
          }
        },
        dcp: {
          bsonType: 'object', required: ['paquete', 'resolucion', 'cifrado'],
          properties: {
            paquete: { bsonType: 'string' },
            resolucion: { enum: ['2K', '4K'] },
            tamano_gb: { bsonType: 'number', minimum: 1 },
            cifrado: { bsonType: 'bool' },
            kdm: { bsonType: 'object', required: ['valido_desde', 'valido_hasta'], properties: { valido_desde: fecha, valido_hasta: fecha } }
          },
          // Un DCP cifrado no se puede proyectar sin su llave (KDM)
          oneOf: [
            { properties: { cifrado: { enum: [false] } } },
            { properties: { cifrado: { enum: [true] } }, required: ['kdm'] }
          ]
        },
        verificacion: {
          bsonType: 'object', required: ['estado'],
          properties: {
            estado: { enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'NO_APLICA'] },
            id_staff: idPg('staff'),
            fecha: fecha,
            observaciones: { bsonType: 'string' },
            codigo_incidente: { bsonType: 'string', pattern: '^INC-[0-9]{4}$' }
          },
          // Aprobar o rechazar exige quién verificó y cuándo
          oneOf: [
            { properties: { estado: { enum: ['PENDIENTE', 'NO_APLICA'] } } },
            { properties: { estado: { enum: ['APROBADA', 'RECHAZADA'] } }, required: ['id_staff', 'fecha'] }
          ]
        },
        esquema_version: versionEsquema,
        creado_en: fecha
      }
    }
  },
  validationLevel: 'strict',
  validationAction: 'error'
});


// resenas_peliculas
db.createCollection('resenas_peliculas', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      title: 'Reseña de una película',
      required: ['id_pelicula', 'pelicula_titulo', 'id_espectador', 'autor_alias', 'compra_verificada', 'calificacion',
                 'texto', 'fecha', 'estado_moderacion', 'esquema_version'],
      properties: {
        id_pelicula: idPg('peliculas'),
        pelicula_titulo: { bsonType: 'string' },
        id_espectador: idPg('espectadores'),
        autor_alias: { bsonType: 'string', minLength: 2, maxLength: 40 },
        compra_verificada: { bsonType: 'bool' },
        id_venta: { bsonType: ['int', 'null'], minimum: 1 },
        id_funcion: idPg('funciones'),
        calificacion: { bsonType: 'int', minimum: 1, maximum: 5 },
        titulo: { bsonType: 'string', maxLength: 120 },
        texto: { bsonType: 'string', minLength: 10, maxLength: 3000 },
        fecha: fecha,
        aspectos: { bsonType: 'object', minProperties: 1, additionalProperties: { bsonType: 'int', minimum: 1, maximum: 5 } },
        contiene_spoilers: { bsonType: 'bool' },
        etiquetas: { bsonType: 'array', maxItems: 10, uniqueItems: true, items: { bsonType: 'string' } },
        votos_utiles: { bsonType: 'int', minimum: 0 },
        canal: { enum: ['WEB', 'APP', 'QR_SALA'] },
        estado_moderacion: { enum: ['PUBLICADA', 'EN_REVISION', 'OCULTA'] },
        motivo_moderacion: { bsonType: 'string' },
        respuesta_empresa: {
          bsonType: 'object', required: ['texto', 'fecha', 'id_staff'],
          properties: { texto: { bsonType: 'string', minLength: 10 }, fecha: fecha, id_staff: idPg('staff') }
        },
        esquema_version: versionEsquema
      },
      allOf: [
        { // Compra verificada => apunta a la venta y a la función de PostgreSQL
          oneOf: [
            { properties: { compra_verificada: { enum: [true] }, id_venta: { bsonType: 'int' } }, required: ['id_venta', 'id_funcion'] },
            { properties: { compra_verificada: { enum: [false] }, id_venta: { bsonType: 'null' } } }
          ]
        },
        { // Si moderación la saca de la vista pública, queda el motivo
          oneOf: [
            { properties: { estado_moderacion: { enum: ['PUBLICADA'] } } },
            { properties: { estado_moderacion: { enum: ['EN_REVISION', 'OCULTA'] } }, required: ['motivo_moderacion'] }
          ]
        }
      ]
    }
  },
  validationLevel: 'strict',
  validationAction: 'error'
});


// reportes_incidentes (un solo tipo de documento con tres variantes: falla, queja o seguridad)
db.createCollection('reportes_incidentes', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      title: 'Reporte de incidente',
      required: ['codigo', 'tipo', 'id_sede', 'fecha_reporte', 'prioridad', 'estado', 'descripcion', 'reportado_por',
                 'seguimiento', 'esquema_version'],
      properties: {
        codigo: { bsonType: 'string', pattern: '^INC-[0-9]{4}$' },
        tipo: { enum: ['FALLA_TECNICA', 'QUEJA_SERVICIO', 'INCIDENTE_SEGURIDAD'] },
        id_sede: idPg('sedes'),
        id_sala: idPg('salas'),
        id_funcion: idPg('funciones'),
        fecha_reporte: fecha,
        fecha_cierre: fecha,
        prioridad: { enum: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] },
        estado: { enum: ['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO'] },
        descripcion: { bsonType: 'string', minLength: 10, maxLength: 2000 },
        reportado_por: {
          bsonType: 'object', required: ['rol'],
          properties: { rol: { enum: ['STAFF', 'ESPECTADOR', 'ANONIMO'] }, id_staff: idPg('staff'), id_espectador: idPg('espectadores') },
          oneOf: [
            { properties: { rol: { enum: ['STAFF'] } }, required: ['id_staff'] },
            { properties: { rol: { enum: ['ESPECTADOR'] } }, required: ['id_espectador'] },
            { properties: { rol: { enum: ['ANONIMO'] } } }
          ]
        },
        asignado_a: idPg('staff'),
        falla: {
          bsonType: 'object', required: ['equipo', 'afecta_funcion'],
          properties: {
            equipo: { enum: ['PROYECTOR', 'SERVIDOR_CONTENIDO', 'SONIDO', 'SISTEMA_3D', 'BUTACAS_4D', 'PANTALLA',
                             'CLIMATIZACION', 'INFRAESTRUCTURA', 'TAQUILLA_POS', 'VENTA_WEB'] },
            marca_modelo: { bsonType: 'string' },
            codigo_error: { bsonType: 'string' },
            afecta_funcion: { bsonType: 'bool' },
            minutos_fuera_servicio: { bsonType: 'int', minimum: 0 },
            repuestos: {
              bsonType: 'array', maxItems: 20,
              items: {
                bsonType: 'object', required: ['item', 'cantidad'],
                properties: { item: { bsonType: 'string' }, cantidad: { bsonType: 'int', minimum: 1 }, costo: { bsonType: 'decimal' } }
              }
            }
          }
        },
        queja: {
          bsonType: 'object', required: ['categoria', 'canal'],
          properties: {
            categoria: { enum: ['REEMBOLSO', 'COMUNICACION', 'PROYECCION', 'COMPORTAMIENTO_PUBLICO', 'TIEMPO_ESPERA',
                                'LIMPIEZA', 'CONFITERIA', 'POLITICA_EDAD', 'PROGRAMACION'] },
            canal: { enum: ['TAQUILLA', 'WEB', 'TELEFONO', 'REDES_SOCIALES', 'BUZON'] },
            id_espectador: idPg('espectadores'),
            id_venta: idPg('ventas'),
            compensacion: {
              bsonType: 'object', required: ['tipo', 'valor'],
              properties: { tipo: { enum: ['BONO', 'REEMBOLSO', 'CORTESIA'] }, valor: { bsonType: 'decimal' } }
            }
          }
        },
        seguridad: {
          bsonType: 'object', required: ['categoria', 'nivel', 'autoridades_notificadas'],
          properties: {
            categoria: { enum: ['EMERGENCIA_MEDICA', 'MENOR_EXTRAVIADO', 'HURTO', 'RIÑA', 'GRABACION_ILEGAL',
                                'EVACUACION', 'OBJETO_SOSPECHOSO', 'RIESGO_EVACUACION'] },
            nivel: { enum: ['BAJO', 'MEDIO', 'ALTO'] },
            personas_involucradas: { bsonType: 'int', minimum: 0 },
            autoridades_notificadas: { bsonType: 'bool' },
            entidad: { bsonType: 'string' },
            acciones: { bsonType: 'array', items: { bsonType: 'string' } }
          }
        },
        relacionado_con: { bsonType: 'array', uniqueItems: true, items: { bsonType: 'string', pattern: '^INC-[0-9]{4}$' } },
        seguimiento: {
          bsonType: 'array', minItems: 1, maxItems: 50,
          items: {
            bsonType: 'object', required: ['fecha', 'estado', 'nota'],
            properties: { fecha: fecha, estado: { enum: ['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO'] }, id_staff: idPg('staff'), nota: { bsonType: 'string' } }
          }
        },
        evidencias: {
          bsonType: 'array', maxItems: 20,
          items: {
            bsonType: 'object', required: ['tipo', 'archivo'],
            properties: { tipo: { enum: ['FOTO', 'VIDEO', 'DOCUMENTO', 'AUDIO'] }, archivo: { bsonType: 'string' }, url: { bsonType: 'string' } }
          }
        },
        esquema_version: versionEsquema
      },
      allOf: [
        { // Cada tipo trae su propio subdocumento y solo ese
          oneOf: [
            { properties: { tipo: { enum: ['FALLA_TECNICA'] } }, required: ['falla'], not: { anyOf: [{ required: ['queja'] }, { required: ['seguridad'] }] } },
            { properties: { tipo: { enum: ['QUEJA_SERVICIO'] } }, required: ['queja'], not: { anyOf: [{ required: ['falla'] }, { required: ['seguridad'] }] } },
            { properties: { tipo: { enum: ['INCIDENTE_SEGURIDAD'] } }, required: ['seguridad'], not: { anyOf: [{ required: ['falla'] }, { required: ['queja'] }] } }
          ]
        },
        { // Resuelto o cerrado => tiene fecha de cierre
          oneOf: [
            { properties: { estado: { enum: ['ABIERTO', 'EN_PROCESO'] } } },
            { properties: { estado: { enum: ['RESUELTO', 'CERRADO'] } }, required: ['fecha_cierre'] }
          ]
        }
      ]
    }
  },
  validationLevel: 'strict',
  validationAction: 'error'
});


// Índices: los id compartidos con PostgreSQL y lo que filtran las consultas de 03
db.fichas_tecnicas_peliculas.createIndex({ id_pelicula: 1 },
  { name: 'uq_fichas_id_pelicula', unique: true, partialFilterExpression: { id_pelicula: { $type: 'int' } } });
db.fichas_tecnicas_peliculas.createIndex({ estado_catalogo: 1, titulo: 1 }, { name: 'idx_fichas_estado_titulo' });

db.requisitos_proyeccion.createIndex({ id_funcion: 1 }, { name: 'uq_requisitos_id_funcion', unique: true });
db.requisitos_proyeccion.createIndex({ 'verificacion.estado': 1, 'funcion.fecha_hora_inicio': 1 }, { name: 'idx_requisitos_estado_fecha' });

db.resenas_peliculas.createIndex({ id_espectador: 1, id_pelicula: 1 }, { name: 'uq_resenas_espectador_pelicula', unique: true });
db.resenas_peliculas.createIndex({ id_pelicula: 1, fecha: -1 }, { name: 'idx_resenas_pelicula_fecha' });
db.resenas_peliculas.createIndex({ titulo: 'text', texto: 'text' }, { name: 'txt_resenas_titulo_texto', default_language: 'spanish' });

db.reportes_incidentes.createIndex({ codigo: 1 }, { name: 'uq_reportes_codigo', unique: true });
db.reportes_incidentes.createIndex({ estado: 1, prioridad: 1, fecha_reporte: -1 }, { name: 'idx_reportes_estado_prioridad' });
db.reportes_incidentes.createIndex({ fecha_reporte: -1 }, { name: 'idx_reportes_fecha_reporte' });
db.reportes_incidentes.createIndex({ id_funcion: 1 },
  { name: 'idx_reportes_id_funcion', partialFilterExpression: { id_funcion: { $exists: true } } });


// Resumen de lo creado
function tabla(filas, columnas) {
  const texto = v => (v === undefined || v === null ? '' : String(v));
  const anchos = columnas.map(c => Math.max(c.length, ...filas.map(f => texto(f[c]).length)));
  const borde = (i, m, d) => i + anchos.map(a => '─'.repeat(a + 2)).join(m) + d;
  const fila = vals => '│' + vals.map((v, i) => ' ' + texto(v).padEnd(anchos[i]) + ' ').join('│') + '│';
  print(borde('┌', '┬', '┐')); print(fila(columnas)); print(borde('├', '┼', '┤'));
  filas.forEach(f => print(fila(columnas.map(c => f[c]))));
  print(borde('└', '┴', '┘'));
}

print(`Base ${db.getName()} creada en MongoDB ${db.version()} (mongosh ${version()})`);
tabla(COLECCIONES.map(c => {
  const { options } = db.getCollectionInfos({ name: c })[0];
  const esquema = options.validator.$jsonSchema;
  return {
    coleccion: c,
    campos_validados: Object.keys(esquema.properties).length,
    obligatorios: esquema.required.length,
    reglas_oneOf: JSON.stringify(esquema).split('"oneOf"').length - 1,
    validacion: `${options.validationLevel} / ${options.validationAction}`
  };
}), ['coleccion', 'campos_validados', 'obligatorios', 'reglas_oneOf', 'validacion']);

print('Índices:');
tabla(COLECCIONES.flatMap(c => db.getCollection(c).getIndexes().filter(i => i.name !== '_id_').map(i => ({
  coleccion: c,
  indice: i.name,
  campos: i.weights ? Object.keys(i.weights).join(', ') + ' (texto)' : Object.entries(i.key).map(([k, v]) => `${k} ${v === 1 ? '↑' : '↓'}`).join(', '),
  opciones: [i.unique ? 'único' : '', i.partialFilterExpression ? 'parcial' : '', i.default_language ? `idioma ${i.default_language}` : '']
    .filter(Boolean).join(', ')
}))), ['coleccion', 'indice', 'campos', 'opciones']);
