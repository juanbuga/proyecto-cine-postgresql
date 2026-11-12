
db = db.getSiblingDB('cine_avance2');

const SOLO = typeof process !== 'undefined' && process.env.CONSULTA ? Number(process.env.CONSULTA) : null;
const DIA = 86400e3;

function tabla(filas, columnas) {
  const texto = v => (v === undefined || v === null ? '' : Array.isArray(v) ? v.join(', ') : String(v));
  const anchos = columnas.map(c => Math.max(c.length, ...filas.map(f => texto(f[c]).length)));
  const borde = (i, m, d) => i + anchos.map(a => '─'.repeat(a + 2)).join(m) + d;
  const fila = vals => '│' + vals.map((v, i) => ' ' + (typeof v === 'number' ? texto(v).padStart(anchos[i]) : texto(v).padEnd(anchos[i])) + ' ').join('│') + '│';
  print(borde('┌', '┬', '┐')); print(fila(columnas)); print(borde('├', '┼', '┤'));
  filas.forEach(f => print(fila(columnas.map(c => f[c]))));
  print(borde('└', '┴', '┘'));
}

const horaBogota = d => d.toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

// Imprime el código de la consulta tal como está escrito abajo, la ejecuta y muestra el resultado
function consulta(n, titulo, fn, mostrar) {
  if (SOLO && n !== SOLO) return;
  const lineas = fn.toString().replace(/^\(\)\s*=>\s*/, '').split('\n');
  const sangria = Math.min(...lineas.slice(1).filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  print(`\n═══ Consulta ${n} · ${titulo} ═══`);
  print([lineas[0], ...lineas.slice(1).map(l => l.slice(sangria))].join('\n'));
  const inicio = Date.now();
  const resultado = fn();
  const ms = Date.now() - inicio;
  print(`→ ${resultado.length} documento(s) en ${ms} ms`);
  mostrar(resultado);
}

print(`Consultas sobre ${db.getName()} · ${horaBogota(new Date())} (hora de Bogotá)`);


// C1 (find): películas programadas con subtítulos para personas sordas (SDH), con las versiones que hay
// y su clasificación en Colombia. Sirve para armar la cartelera accesible.
consulta(1, 'Películas en cartelera con subtítulos SDH en español',
  () => db.fichas_tecnicas_peliculas.find(
          { estado_catalogo: 'PROGRAMADA', subtitulos: { $elemMatch: { codigo: 'es', tipo: 'SDH' } } },
          { _id: 0, id_pelicula: 1, titulo: 1, 'versiones.tipo': 1, clasificaciones: { $elemMatch: { pais: 'CO' } } }
        ).sort({ id_pelicula: 1 }).toArray(),
  filas => tabla(filas.map(f => ({
    id_pelicula: f.id_pelicula, titulo: f.titulo,
    versiones: f.versiones.map(v => v.tipo), clasificacion_co: f.clasificaciones[0].clasificacion
  })), ['id_pelicula', 'titulo', 'versiones', 'clasificacion_co']));


// C2 (find): incidentes de cualquier tipo que siguen abiertos con prioridad ALTA o CRITICA.
// Usa solo los campos comunes del patrón polimórfico y muestra el detalle propio de cada tipo.
consulta(2, 'Incidentes abiertos de prioridad alta o crítica',
  () => db.reportes_incidentes.find(
          { estado: { $in: ['ABIERTO', 'EN_PROCESO'] }, prioridad: { $in: ['ALTA', 'CRITICA'] } },
          { _id: 0, codigo: 1, tipo: 1, prioridad: 1, estado: 1, id_sede: 1, id_sala: 1, id_funcion: 1, fecha_reporte: 1,
            'falla.equipo': 1, 'queja.categoria': 1, 'seguridad.categoria': 1 }
        ).sort({ fecha_reporte: -1 }).toArray(),
  filas => tabla(filas.map(f => ({
    ...f, reportado: horaBogota(f.fecha_reporte),
    detalle: (f.falla && f.falla.equipo) || (f.queja && f.queja.categoria) || (f.seguridad && f.seguridad.categoria)
  })), ['codigo', 'tipo', 'prioridad', 'estado', 'id_sede', 'id_sala', 'id_funcion', 'detalle', 'reportado']));


// C3 (pipeline): calificación promedio por película, cuántas reseñas tienen compra verificada en PostgreSQL
// y cuántas respondió la empresa. Se une con la ficha técnica por id_pelicula.
consulta(3, 'Calificación de cada película según sus reseñas publicadas',
  () => db.resenas_peliculas.aggregate([
          { $match: { estado_moderacion: 'PUBLICADA' } },
          { $group: {
              _id: '$id_pelicula',
              resenas: { $sum: 1 },
              promedio: { $avg: '$calificacion' },
              verificadas: { $sum: { $cond: ['$compra_verificada', 1, 0] } },
              respondidas: { $sum: { $cond: [{ $ifNull: ['$respuesta_empresa', false] }, 1, 0] } }
          } },
          { $lookup: {
              from: 'fichas_tecnicas_peliculas', localField: '_id', foreignField: 'id_pelicula', as: 'ficha',
              pipeline: [{ $match: { id_pelicula: { $type: 'int' } } }]   // así usa el índice parcial uq_fichas_id_pelicula
          } },
          { $unwind: '$ficha' },
          { $project: {
              _id: 0, id_pelicula: '$_id', titulo: '$ficha.titulo', resenas: 1, respondidas: 1,
              promedio: { $round: ['$promedio', 2] },
              pct_verificadas: { $round: [{ $multiply: [{ $divide: ['$verificadas', '$resenas'] }, 100] }, 0] },
              clasificacion_co: { $first: { $filter: { input: '$ficha.clasificaciones', cond: { $eq: ['$$this.pais', 'CO'] } } } }
          } },
          { $set: { clasificacion_co: '$clasificacion_co.clasificacion' } },
          { $sort: { promedio: -1, resenas: -1 } }
        ]).toArray(),
  filas => tabla(filas, ['id_pelicula', 'titulo', 'clasificacion_co', 'resenas', 'promedio', 'pct_verificadas', 'respondidas']));


// C4 (pipeline): incidentes de los últimos 60 días por sede y tipo, con abiertos, críticos y horas
// promedio hasta el cierre; $setWindowFields agrega el total de cada sede sin perder el detalle.
consulta(4, 'Incidentes por sede y tipo en los últimos 60 días',
  () => db.reportes_incidentes.aggregate([
          { $match: { fecha_reporte: { $gte: new Date(Date.now() - 60 * DIA) } } },
          { $group: {
              _id: { id_sede: '$id_sede', tipo: '$tipo' },
              total: { $sum: 1 },
              abiertos: { $sum: { $cond: [{ $in: ['$estado', ['ABIERTO', 'EN_PROCESO']] }, 1, 0] } },
              criticos: { $sum: { $cond: [{ $eq: ['$prioridad', 'CRITICA'] }, 1, 0] } },
              minutos: { $avg: { $dateDiff: { startDate: '$fecha_reporte', endDate: '$fecha_cierre', unit: 'minute' } } }
          } },
          { $setWindowFields: { partitionBy: '$_id.id_sede', output: { total_sede: { $sum: '$total' } } } },
          { $project: {
              _id: 0, id_sede: '$_id.id_sede', tipo: '$_id.tipo', total: 1, total_sede: 1, abiertos: 1, criticos: 1,
              horas_hasta_cierre: { $round: [{ $divide: ['$minutos', 60] }, 1] }
          } },
          { $sort: { total_sede: -1, id_sede: 1, total: -1 } }
        ]).toArray(),
  filas => tabla(filas, ['id_sede', 'total_sede', 'tipo', 'total', 'abiertos', 'criticos', 'horas_hasta_cierre']));


// C5 (pipeline): lo que el equipo técnico tiene que alistar en los próximos 7 días: requisitos obligatorios
// de funciones aún sin verificar, agrupados por componente ($unwind del arreglo embebido).
consulta(5, 'Requisitos técnicos pendientes para los próximos 7 días',
  () => db.requisitos_proyeccion.aggregate([
          { $match: { 'verificacion.estado': 'PENDIENTE',
                      'funcion.fecha_hora_inicio': { $gte: new Date(), $lt: new Date(Date.now() + 7 * DIA) } } },
          { $unwind: '$requisitos' },
          { $match: { 'requisitos.obligatorio': true } },
          { $group: {
              _id: '$requisitos.componente',
              funciones: { $sum: 1 },
              ids_funcion: { $push: '$id_funcion' },
              salas: { $addToSet: '$id_sala' },
              primera: { $min: '$funcion.fecha_hora_inicio' }
          } },
          { $project: {
              _id: 0, componente: '$_id', funciones: 1,
              ids_funcion: { $sortArray: { input: '$ids_funcion', sortBy: 1 } },
              salas: { $sortArray: { input: '$salas', sortBy: 1 } },
              primera_funcion: { $dateToString: { date: '$primera', format: '%d/%m %H:%M', timezone: 'America/Bogota' } }
          } },
          { $sort: { funciones: -1, componente: 1 } }
        ]).toArray(),
  filas => tabla(filas, ['componente', 'funciones', 'ids_funcion', 'salas', 'primera_funcion']));


// C6 (pipeline): reseñas de 3 estrellas o menos que mencionan fallas (búsqueda de texto en español)
// cruzadas con los incidentes registrados para la misma función.
consulta(6, 'Reseñas negativas que mencionan fallas y los incidentes de esa función',
  () => db.resenas_peliculas.aggregate([
          { $match: { $text: { $search: 'sonido audio imagen 3D 4D silla butaca calor subtítulos' },
                      calificacion: { $lte: 3 }, id_funcion: { $exists: true } } },
          { $lookup: {
              from: 'reportes_incidentes', localField: 'id_funcion', foreignField: 'id_funcion', as: 'incidentes',
              pipeline: [{ $project: { _id: 0, codigo: 1, tipo: 1 } }]
          } },
          { $project: {
              _id: 0, id_funcion: 1, pelicula_titulo: 1, autor_alias: 1, calificacion: 1,
              relevancia: { $round: [{ $meta: 'textScore' }, 2] },
              respondida: { $cond: [{ $ifNull: ['$respuesta_empresa', false] }, 'sí', 'no'] },
              incidentes: '$incidentes.codigo'
          } },
          { $sort: { relevancia: -1 } }
        ]).toArray(),
  filas => tabla(filas, ['id_funcion', 'pelicula_titulo', 'autor_alias', 'calificacion', 'relevancia', 'respondida', 'incidentes']));
