// Avance 2 · Capa documental de CuevanaCinema en MongoDB
// 02: datos de prueba. Usan los mismos id que 02_datos_prueba.sql del Avance 1 (películas, funciones, salas,
// sedes, staff, espectadores, ventas y actores_directores), así las colecciones quedan listas para integrarse.
// Correr después de 01 y el mismo día que se cargó PostgreSQL: las fechas son relativas al día de carga,
// igual que CURRENT_DATE ± n allá. Al final van pruebas que deben ser rechazadas por la validación.
// Uso: mongosh "<cadena de conexión>" --file scripts/02_datos_prueba.js

db = db.getSiblingDB('cine_avance2');

const COLECCIONES = ['fichas_tecnicas_peliculas', 'requisitos_proyeccion', 'resenas_peliculas', 'reportes_incidentes'];
COLECCIONES.forEach(c => db.getCollection(c).deleteMany({}));

// dia(-15, '19:00') equivale a CURRENT_DATE - 15 + TIME '19:00' en Bogotá (UTC-5 todo el año)
const HOY = (() => { const b = new Date(Date.now() - 5 * 3600e3); return Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()); })();
const dia = (n, hora = '00:00') => { const [h, m] = hora.split(':').map(Number); return new Date(HOY + n * 86400e3 + (h + 5) * 3600e3 + m * 60e3); };
const haceHoras = h => new Date(Date.now() - h * 3600e3);
const pesos = valor => NumberDecimal(valor);   // dinero como NUMERIC de PostgreSQL

// Clasificación colombiana: debe coincidir con peliculas.edad_minima
const CO = edad => ({ pais: 'CO', sistema: 'Comité de Clasificación de Películas (MinCultura)', clasificacion: edad === 0 ? 'T' : String(edad), edad_minima: edad });
const CO_PENDIENTE = { pais: 'CO', sistema: 'Comité de Clasificación de Películas (MinCultura)', clasificacion: 'PENDIENTE', edad_minima: null };
const audio = (codigo, idioma, tipo = 'ORIGINAL') => ({ codigo, idioma, tipo });
const subs = (codigo, idioma, tipo = 'ESTANDAR') => ({ codigo, idioma, tipo });


// ─────────────────────────────────────────────────────────────────────────────
// fichas_tecnicas_peliculas: 12 películas de PostgreSQL + 18 que ofrecen las distribuidoras
// ─────────────────────────────────────────────────────────────────────────────
const fichas = [
  {
    id_pelicula: 1, estado_catalogo: 'PROGRAMADA',
    titulo: 'El Último Faro', titulo_original: 'O Último Farol', anio: 2026,
    paises_produccion: ['BR', 'CO'], generos: ['SUSPENSO', 'DRAMA'],
    sinopsis: 'Una fotógrafa colombiana llega a un faro abandonado de Bahía para documentar su demolición. En sus fotos aparece alguien que no debería estar ahí.',
    distribuidora: { nombre: 'Atlántico Films', pais: 'BR', contacto: 'programacion@atlanticofilms.example' },
    direccion: [{ nombre: 'Fernando Restrepo Acosta', id_actor_director: 1 }],
    reparto: [
      { nombre: 'Carolina Cárdenas Vargas', personaje: 'Marina Duarte', participacion: 'ACTUACION', id_actor_director: 9 },
      { nombre: 'Rodrigo Mendoza Cárdenas', personaje: 'Capitán Elías Rentería', participacion: 'ACTUACION', id_actor_director: 17 },
      { nombre: 'Bruna Teixeira', personaje: 'Dona Rosa', participacion: 'ACTUACION' },
      { nombre: 'Paulo Henrique Lima', personaje: 'Tião, el farero', participacion: 'ACTUACION' }
    ],
    versiones: [
      { tipo: 'CINE', duracion_min: 118, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['5.1'] },
      { tipo: '3D', duracion_min: 118, formato_imagen: '3D', relacion_aspecto: '2.39:1', sonido: ['5.1'] }
    ],
    idiomas_audio: [audio('pt', 'portugués'), audio('es', 'español')],
    subtitulos: [subs('es', 'español'), subs('en', 'inglés')],
    clasificaciones: [
      CO(12),
      { pais: 'BR', sistema: 'ClassInd', clasificacion: '14', edad_minima: 14, descriptores: ['violencia', 'miedo'] },
      { pais: 'AR', sistema: 'INCAA', clasificacion: '+13', edad_minima: 13 }
    ],
    festivales: [{ nombre: 'Festival Internacional de Cine del Caribe', anio: 2026, seccion: 'Selección oficial' }],
    esquema_version: 1, registrado_en: dia(-95, '10:00')
  },
  {
    id_pelicula: 2, estado_catalogo: 'PROGRAMADA',
    titulo: 'Aventuras en el Páramo', anio: 2026,
    paises_produccion: ['CO'], generos: ['ANIMACION', 'FAMILIAR', 'AVENTURA'],
    sinopsis: 'Lía, una frailejona curiosa, y Tomás, un oso de anteojos, cruzan el páramo de Sumapaz para salvar el nacimiento del río que abastece a su valle.',
    distribuidora: { nombre: 'Cóndor Animación', pais: 'CO', contacto: 'distribucion@condoranimacion.example' },
    direccion: [{ nombre: 'Sofía Torres Acosta', id_actor_director: 31 }],
    reparto: [
      { nombre: 'Gabriela Salazar Gómez', personaje: 'Lía (voz)', participacion: 'VOZ', id_actor_director: 15 },
      { nombre: 'Julián Jiménez Martínez', personaje: 'Tomás (voz)', participacion: 'VOZ', id_actor_director: 5 },
      { nombre: 'Mateo Rincón', personaje: 'Abuelo Cóndor (voz)', participacion: 'VOZ' }
    ],
    versiones: [
      { tipo: 'CINE', duracion_min: 92, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1', 'DOLBY_ATMOS'] },
      { tipo: '3D', duracion_min: 92, formato_imagen: '3D', relacion_aspecto: '1.85:1', sonido: ['5.1', 'DOLBY_ATMOS'] },
      { tipo: '4D', duracion_min: 92, formato_imagen: '4D', relacion_aspecto: '1.85:1', sonido: ['7.1'] }
    ],
    idiomas_audio: [audio('es', 'español'), audio('es', 'español', 'AUDIODESCRIPCION')],
    subtitulos: [subs('es', 'español', 'SDH')],
    clasificaciones: [CO(0), { pais: 'MX', sistema: 'RTC', clasificacion: 'AA', edad_minima: 0 }, { pais: 'ES', sistema: 'ICAA', clasificacion: 'APTA', edad_minima: 0 }],
    esquema_version: 1, registrado_en: dia(-80, '09:30')
  },
  {
    id_pelicula: 3, estado_catalogo: 'PROGRAMADA',
    titulo: 'Cumbia de Medianoche', anio: 2026,
    paises_produccion: ['CO'], generos: ['COMEDIA', 'MUSICAL'],
    sinopsis: 'Una orquesta de cumbia en decadencia tiene una sola noche para ganar el concurso del barrio y salvar el salón de baile de Doña Yolanda.',
    distribuidora: { nombre: 'Barranquilla Pictures', pais: 'CO' },
    direccion: [{ nombre: 'Paula Castro Caicedo', id_actor_director: 32 }],
    reparto: [
      { nombre: 'Daniela Ortiz García', personaje: 'Yolanda Mercado', participacion: 'ACTUACION', id_actor_director: 3 },
      { nombre: 'Óscar Villamil López', personaje: 'Toño Barrios', participacion: 'ACTUACION', id_actor_director: 4 },
      { nombre: 'Esteban Pérez López', personaje: 'Don Abel', participacion: 'ACTUACION', id_actor_director: 35 },
      { nombre: 'Kelly Johana Ríos', personaje: 'La Nena', participacion: 'ACTUACION' }
    ],
    versiones: [{ tipo: 'CINE', duracion_min: 104, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1', 'DOLBY_ATMOS'] }],
    idiomas_audio: [audio('es', 'español')],
    subtitulos: [],
    clasificaciones: [CO(7), { pais: 'MX', sistema: 'RTC', clasificacion: 'A', edad_minima: 0 }],
    banda_sonora: { compositor: 'Orquesta La Medianoche', canciones: 14, disponible_en_plataformas: true },
    esquema_version: 1, registrado_en: dia(-75, '11:00')
  },
  {
    id_pelicula: 4, estado_catalogo: 'PROGRAMADA',
    titulo: 'Sombras de Monserrate', titulo_original: 'Shadows of Monserrate', anio: 2026,
    paises_produccion: ['US', 'CO'], generos: ['TERROR'],
    sinopsis: 'Un equipo de restauración trabaja de noche en una capilla del cerro de Monserrate. Cada noche falta uno de ellos al amanecer.',
    distribuidora: { nombre: 'Nightfall Releasing', pais: 'US', contacto: 'latam@nightfall.example' },
    direccion: [{ nombre: 'Rodrigo Miguel Duarte Medina', id_actor_director: 39 }],
    reparto: [
      { nombre: 'Isabela Isabela Jiménez Torres', personaje: 'Clara Ibáñez', participacion: 'ACTUACION', id_actor_director: 33 },
      { nombre: 'Rodrigo Díaz Cortés', personaje: 'Padre Ignacio', participacion: 'ACTUACION', id_actor_director: 28 },
      { nombre: 'Michael Hart', personaje: 'Dr. Evan Price', participacion: 'ACTUACION' }
    ],
    versiones: [{ tipo: 'CINE', duracion_min: 97, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['5.1', 'DOLBY_ATMOS'] }],
    idiomas_audio: [audio('en', 'inglés'), audio('es', 'español')],
    subtitulos: [subs('es', 'español')],
    clasificaciones: [
      CO(18),
      { pais: 'US', sistema: 'MPA', clasificacion: 'R', edad_minima: 17, descriptores: ['violencia sangrienta', 'imágenes perturbadoras', 'lenguaje fuerte'] },
      { pais: 'ES', sistema: 'ICAA', clasificacion: '18', edad_minima: 18 },
      { pais: 'MX', sistema: 'RTC', clasificacion: 'C', edad_minima: 18 }
    ],
    advertencias: ['Luces estroboscópicas', 'Escenas de violencia gráfica'],
    esquema_version: 1, registrado_en: dia(-70, '15:20')
  },
  {
    id_pelicula: 5, estado_catalogo: 'PROGRAMADA',
    titulo: 'Galaxia Cero', titulo_original: 'Zero Galaxy', anio: 2026,
    paises_produccion: ['GB', 'US'], generos: ['CIENCIA_FICCION', 'AVENTURA'],
    sinopsis: 'La última nave de rescate de la Tierra cruza una galaxia donde el tiempo corre al revés. Para volver, la tripulación tendrá que olvidar todo lo que sabe.',
    distribuidora: { nombre: 'Orbital Pictures', pais: 'GB', contacto: 'bookings@orbitalpictures.example' },
    direccion: [{ nombre: 'Eleanor Whitfield' }],
    reparto: [
      { nombre: 'Thomas Reed', personaje: 'Comandante Hale', participacion: 'ACTUACION' },
      { nombre: 'Andrea Diana Ruiz Torres', personaje: 'Ingeniera Vega', participacion: 'ACTUACION', id_actor_director: 14 },
      { nombre: 'Daniel Salazar Gutiérrez', personaje: 'Dr. Ferro', participacion: 'ACTUACION', id_actor_director: 16 },
      { nombre: 'Amara Okafor', personaje: 'ZERO (voz de la nave)', participacion: 'VOZ' }
    ],
    versiones: [
      { tipo: 'CINE', duracion_min: 132, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['7.1', 'DOLBY_ATMOS'] },
      { tipo: '3D', duracion_min: 132, formato_imagen: '3D', relacion_aspecto: '2.39:1', sonido: ['7.1', 'DOLBY_ATMOS'] },
      { tipo: '4D', duracion_min: 132, formato_imagen: '4D', relacion_aspecto: '2.39:1', sonido: ['7.1'] },
      { tipo: 'IMAX', duracion_min: 132, formato_imagen: 'IMAX', relacion_aspecto: '1.90:1', sonido: ['7.1'] }
    ],
    idiomas_audio: [audio('en', 'inglés'), audio('es', 'español', 'DOBLAJE'), audio('pt', 'portugués', 'DOBLAJE')],
    subtitulos: [subs('es', 'español'), subs('es', 'español', 'SDH'), subs('pt', 'portugués')],
    clasificaciones: [
      CO(12),
      { pais: 'US', sistema: 'MPA', clasificacion: 'PG-13', edad_minima: 13, descriptores: ['violencia de ciencia ficción', 'lenguaje breve'] },
      { pais: 'GB', sistema: 'BBFC', clasificacion: '12A', edad_minima: 12 },
      { pais: 'ES', sistema: 'ICAA', clasificacion: '12', edad_minima: 12 },
      { pais: 'MX', sistema: 'RTC', clasificacion: 'B', edad_minima: 12 }
    ],
    esquema_version: 1, registrado_en: dia(-110, '08:45'), actualizado_en: dia(-20, '16:00')
  },
  {
    id_pelicula: 6, estado_catalogo: 'PROGRAMADA',
    titulo: 'Corazones en Bogotá', titulo_original: 'Cœurs à Bogota', anio: 2026,
    paises_produccion: ['FR', 'CO'], generos: ['ROMANCE', 'COMEDIA'],
    sinopsis: 'Un chef francés llega a Bogotá para abrir un restaurante y termina aprendiendo a cocinar ajiaco con la vecina que le hace la vida imposible.',
    distribuidora: { nombre: 'Lumière Sud', pais: 'FR' },
    direccion: [{ nombre: 'Andrea Tatiana Cortés García', id_actor_director: 34 }],
    reparto: [
      { nombre: 'Mariana Villamil Osorio', personaje: 'Camila Rojas', participacion: 'ACTUACION', id_actor_director: 10 },
      { nombre: 'Julien Moreau', personaje: 'Antoine Lefèvre', participacion: 'ACTUACION' },
      { nombre: 'Margaux Petit', personaje: 'Élise', participacion: 'ACTUACION' }
    ],
    versiones: [{ tipo: 'CINE', duracion_min: 109, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('fr', 'francés'), audio('es', 'español')],
    subtitulos: [subs('es', 'español')],
    clasificaciones: [CO(12), { pais: 'FR', sistema: 'CNC', clasificacion: 'Tous publics', edad_minima: 0 }, { pais: 'ES', sistema: 'ICAA', clasificacion: '7', edad_minima: 7 }],
    esquema_version: 1, registrado_en: dia(-85, '10:10')
  },
  {
    id_pelicula: 7, estado_catalogo: 'PROGRAMADA',
    titulo: 'Operación Cóndor Andino', titulo_original: 'Operation Andean Condor', anio: 2026,
    paises_produccion: ['US'], generos: ['ACCION'],
    sinopsis: 'Un agente estadounidense y una teniente colombiana persiguen por los Andes a una red que trafica especies en peligro de extinción.',
    distribuidora: { nombre: 'Summit Ridge Studios', pais: 'US', contacto: 'colombia@summitridge.example' },
    direccion: [{ nombre: 'Fernando Parra Parra', id_actor_director: 20 }],
    reparto: [
      { nombre: 'Jack Turner', personaje: 'Agente Cole Bennett', participacion: 'ACTUACION' },
      { nombre: 'Verónica Díaz Arias', personaje: 'Teniente Sara Quiroga', participacion: 'ACTUACION', id_actor_director: 13 },
      { nombre: 'Fernando Camilo Mendoza Pardo', personaje: 'El Halcón', participacion: 'ACTUACION', id_actor_director: 18 }
    ],
    versiones: [
      { tipo: 'CINE', duracion_min: 126, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['7.1', 'DOLBY_ATMOS'] },
      { tipo: '3D', duracion_min: 126, formato_imagen: '3D', relacion_aspecto: '2.39:1', sonido: ['7.1', 'DOLBY_ATMOS'] },
      { tipo: 'EXTENDIDA', duracion_min: 141, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['7.1'] }
    ],
    idiomas_audio: [audio('en', 'inglés'), audio('es', 'español', 'DOBLAJE')],
    subtitulos: [subs('es', 'español'), subs('es', 'español', 'SDH')],
    clasificaciones: [
      CO(15),
      { pais: 'US', sistema: 'MPA', clasificacion: 'R', edad_minima: 17, descriptores: ['violencia intensa', 'lenguaje'] },
      { pais: 'MX', sistema: 'RTC', clasificacion: 'B15', edad_minima: 15 },
      { pais: 'ES', sistema: 'ICAA', clasificacion: '16', edad_minima: 16 },
      { pais: 'AR', sistema: 'INCAA', clasificacion: '+16', edad_minima: 16 }
    ],
    esquema_version: 1, registrado_en: dia(-90, '14:00')
  },
  {
    id_pelicula: 8, estado_catalogo: 'PROGRAMADA',
    titulo: 'La Casa del Río', titulo_original: 'The River House', anio: 2025,
    paises_produccion: ['MX', 'US'], generos: ['DRAMA'],
    sinopsis: 'Dos hermanos que no se hablan hace veinte años vuelven a la casa familiar a orillas del río Bravo para venderla.',
    distribuidora: { nombre: 'Frontera Films', pais: 'MX' },
    direccion: [{ nombre: 'Luisa Navarro Pardo', id_actor_director: 7 }],
    reparto: [
      { nombre: 'Juan Ruiz Osorio', personaje: 'Tomás Herrera', participacion: 'ACTUACION', id_actor_director: 24 },
      { nombre: 'Sofía Catalina Beltrán Jiménez', personaje: 'Elena Herrera', participacion: 'ACTUACION', id_actor_director: 36 },
      { nombre: 'Grace Miller', personaje: 'Ruth', participacion: 'ACTUACION' }
    ],
    versiones: [{ tipo: 'CINE', duracion_min: 115, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('en', 'inglés'), audio('es', 'español')],
    subtitulos: [subs('es', 'español')],
    clasificaciones: [
      CO(15),
      { pais: 'MX', sistema: 'RTC', clasificacion: 'B15', edad_minima: 15 },
      { pais: 'US', sistema: 'MPA', clasificacion: 'R', edad_minima: 17, descriptores: ['temas adultos', 'lenguaje'] }
    ],
    premios: [{ certamen: 'Festival Iberoamericano de Cine de Frontera', categoria: 'Mejor actuación masculina', resultado: 'GANADOR', anio: 2025 }],
    esquema_version: 1, registrado_en: dia(-120, '09:00')
  },
  {
    id_pelicula: 9, estado_catalogo: 'PROGRAMADA',
    titulo: 'Mi Amigo el Dragón', titulo_original: 'My Friend the Dragon', anio: 2026,
    paises_produccion: ['CA'], generos: ['FAMILIAR', 'ANIMACION'],
    sinopsis: 'Leo encuentra un huevo de dragón en el jardín de su abuela y tiene que esconder a Ember hasta que aprenda a volar.',
    distribuidora: { nombre: 'Maple Leaf Family', pais: 'CA' },
    direccion: [{ nombre: 'Sarah Lindqvist' }],
    reparto: [
      { nombre: 'Noah Bennett', personaje: 'Leo (voz)', participacion: 'VOZ' },
      { nombre: 'Ivy Chen', personaje: 'Ember (voz)', participacion: 'VOZ' }
    ],
    reparto_doblaje: {
      idioma: 'es',
      voces: [
        { nombre: 'Julián Jiménez Martínez', personaje: 'Leo', id_actor_director: 5 },
        { nombre: 'Gabriela Salazar Gómez', personaje: 'Ember', id_actor_director: 15 }
      ]
    },
    versiones: [{ tipo: 'CINE', duracion_min: 88, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1', 'DOLBY_ATMOS'] }],
    idiomas_audio: [audio('en', 'inglés'), audio('es', 'español', 'DOBLAJE')],
    subtitulos: [subs('es', 'español'), subs('es', 'español', 'SDH')],
    clasificaciones: [CO(0), { pais: 'US', sistema: 'MPA', clasificacion: 'PG', edad_minima: 0, descriptores: ['peligro leve'] }, { pais: 'MX', sistema: 'RTC', clasificacion: 'A', edad_minima: 0 }],
    esquema_version: 1, registrado_en: dia(-60, '13:30')
  },
  {
    id_pelicula: 10, estado_catalogo: 'PROGRAMADA',
    titulo: 'Voces del Cañón', anio: 2026,
    paises_produccion: ['PE', 'CO'], generos: ['DOCUMENTAL'],
    sinopsis: 'Arrieros, cronistas y comunidades quechuas cuentan cómo cambió la vida en los cañones andianos desde que llegó la carretera.',
    distribuidora: { nombre: 'Andes Docs', pais: 'PE' },
    direccion: [{ nombre: 'Camila Arias Arias', id_actor_director: 37 }],
    reparto: [
      { nombre: 'Héctor Óscar Gómez Rodríguez', personaje: 'Narrador', participacion: 'NARRACION', id_actor_director: 12 },
      { nombre: 'Rodrigo Ruiz Díaz', personaje: 'Voz de los cronistas', participacion: 'NARRACION', id_actor_director: 22 },
      { nombre: 'David Moreno Quintero', personaje: 'Voz del arriero', participacion: 'NARRACION', id_actor_director: 38 }
    ],
    versiones: [{ tipo: 'CINE', duracion_min: 84, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['ESTEREO'] }],
    idiomas_audio: [audio('qu', 'quechua'), audio('es', 'español')],
    subtitulos: [subs('es', 'español'), subs('en', 'inglés')],
    clasificaciones: [CO(7), { pais: 'CL', sistema: 'CCC', clasificacion: 'TE+7', edad_minima: 7 }],
    festivales: [{ nombre: 'Festival Andino de Cine Documental', anio: 2026, seccion: 'Competencia oficial' }],
    esquema_version: 1, registrado_en: dia(-55, '10:45')
  },
  {
    id_pelicula: 11, estado_catalogo: 'PROGRAMADA',
    titulo: 'Eclipse Final', titulo_original: 'Final Eclipse', anio: 2026,
    paises_produccion: ['PE', 'US'], generos: ['CIENCIA_FICCION', 'ACCION'],
    sinopsis: 'Durante el último eclipse antes de que la Luna se aleje para siempre, una científica peruana descubre que la órbita fue alterada a propósito.',
    distribuidora: { nombre: 'Orbital Pictures', pais: 'GB', contacto: 'bookings@orbitalpictures.example' },
    direccion: [
      { nombre: 'Valentina Ramírez Londoño', id_actor_director: 8 },
      { nombre: 'Miguel Miguel Beltrán Cortés', id_actor_director: 26 }
    ],
    reparto: [
      { nombre: 'Gabriela Duarte Cuervo', personaje: 'Dra. Inés Calderón', participacion: 'ACTUACION', id_actor_director: 25 },
      { nombre: 'Juan Ruiz Osorio', personaje: 'Capitán Mateo Ríos', participacion: 'ACTUACION', id_actor_director: 24 },
      { nombre: 'Carolina Cárdenas Vargas', personaje: 'Luna', participacion: 'ACTUACION', id_actor_director: 9 },
      { nombre: 'Fernando Restrepo Rodríguez', personaje: 'General Ortega', participacion: 'ACTUACION', id_actor_director: 27 }
    ],
    versiones: [
      { tipo: 'CINE', duracion_min: 140, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['7.1', 'DOLBY_ATMOS'] },
      { tipo: '3D', duracion_min: 140, formato_imagen: '3D', relacion_aspecto: '2.39:1', sonido: ['7.1', 'DOLBY_ATMOS'] },
      { tipo: 'IMAX', duracion_min: 140, formato_imagen: 'IMAX', relacion_aspecto: '1.90:1', sonido: ['7.1'] }
    ],
    idiomas_audio: [audio('en', 'inglés'), audio('es', 'español', 'DOBLAJE')],
    subtitulos: [subs('es', 'español'), subs('es', 'español', 'SDH')],
    clasificaciones: [
      CO(12),
      { pais: 'US', sistema: 'MPA', clasificacion: 'PG-13', edad_minima: 13, descriptores: ['secuencias de acción', 'imágenes intensas'] },
      { pais: 'MX', sistema: 'RTC', clasificacion: 'B', edad_minima: 12 },
      { pais: 'BR', sistema: 'ClassInd', clasificacion: '12', edad_minima: 12 }
    ],
    embargo_resenas_hasta: dia(10, '00:00'),
    esquema_version: 1, registrado_en: dia(-40, '11:15')
  },
  {
    id_pelicula: 12, estado_catalogo: 'PROGRAMADA',
    titulo: 'Noches de Salsa', anio: 2026,
    paises_produccion: ['CO', 'MX'], generos: ['COMEDIA'],
    sinopsis: 'Una bailarina española llega a Cali para un concurso de salsa y termina compartiendo pareja con el peor bailarín de la ciudad.',
    distribuidora: { nombre: 'Pacífico Cine', pais: 'CO' },
    direccion: [{ nombre: 'Miguel Pérez Osorio', id_actor_director: 30 }],
    reparto: [
      { nombre: 'Tatiana Arias Navarro', personaje: 'Lucía Montaño', participacion: 'ACTUACION', id_actor_director: 19 },
      { nombre: 'Óscar Daniel Jiménez Sánchez', personaje: 'Ramiro "El Rey" Caicedo', participacion: 'ACTUACION', id_actor_director: 11 },
      { nombre: 'Yesenia Valencia', personaje: 'Doña Fanny', participacion: 'ACTUACION' }
    ],
    versiones: [{ tipo: 'CINE', duracion_min: 101, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('es', 'español')],
    subtitulos: [subs('en', 'inglés')],
    clasificaciones: [CO(7), { pais: 'MX', sistema: 'RTC', clasificacion: 'A', edad_minima: 0 }],
    esquema_version: 1, registrado_en: dia(-180, '09:20')
  },

  // Catálogo de distribuidoras: todavía no existen en PostgreSQL (id_pelicula null)
  {
    id_pelicula: null, estado_catalogo: 'EN_NEGOCIACION',
    titulo: 'Marea Alta', anio: 2026, paises_produccion: ['CO'], generos: ['DRAMA'],
    sinopsis: 'Tres hermanas vuelven a Tumaco para decidir qué hacer con la lancha de su padre.',
    distribuidora: { nombre: 'Pacífico Cine', pais: 'CO' },
    direccion: [{ nombre: 'Andrea Tatiana Cortés García', id_actor_director: 34 }],
    reparto: [
      { nombre: 'Daniela Ortiz García', personaje: 'Yesenia', participacion: 'ACTUACION', id_actor_director: 3 },
      { nombre: 'Luz Dary Angulo', personaje: 'Mamá Chela', participacion: 'ACTUACION' }
    ],
    versiones: [{ tipo: 'CINE', duracion_min: 98, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('es', 'español')], subtitulos: [subs('en', 'inglés')],
    clasificaciones: [CO(12)],
    evaluacion: { id_staff: 1, fecha: dia(-6, '15:00'), puntaje: 8.5, comentario: 'Buena opción para la franja de cine colombiano en Chapinero.' },
    propuesta_exhibicion: { semanas: 3, copias: 2, formato: 'DCP 2K', desde: dia(30) },
    esquema_version: 1, registrado_en: dia(-12, '10:00')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_EVALUACION',
    titulo: 'El Silencio del Nevado', anio: 2026, paises_produccion: ['CO', 'CL'], generos: ['SUSPENSO'],
    distribuidora: { nombre: 'Cordillera Films', pais: 'CL' },
    direccion: [{ nombre: 'Rodrigo Miguel Duarte Medina', id_actor_director: 39 }],
    reparto: [
      { nombre: 'Gabriela Duarte Cuervo', personaje: 'Ana Lucía', participacion: 'ACTUACION', id_actor_director: 25 },
      { nombre: 'Matías Fuenzalida', personaje: 'Guía Ramiro', participacion: 'ACTUACION' }
    ],
    versiones: [{ tipo: 'CINE', duracion_min: 112, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('es', 'español')], subtitulos: [],
    clasificaciones: [{ pais: 'CL', sistema: 'CCC', clasificacion: '14', edad_minima: 14 }, CO_PENDIENTE],
    esquema_version: 1, registrado_en: dia(-9, '16:40')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_EVALUACION',
    titulo: 'Los Hijos del Volcán', anio: 2025, paises_produccion: ['EC'], generos: ['AVENTURA', 'FAMILIAR'],
    sinopsis: 'Cuatro niños de un pueblo al pie del Cotopaxi organizan su propio plan de evacuación cuando nadie les cree que el volcán despertó.',
    distribuidora: { nombre: 'Mitad del Mundo Films', pais: 'EC' },
    direccion: [{ nombre: 'Paola Andrade Cevallos' }],
    versiones: [
      { tipo: 'CINE', duracion_min: 96, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] },
      { tipo: '3D', duracion_min: 96, formato_imagen: '3D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }
    ],
    idiomas_audio: [audio('es', 'español')], subtitulos: [subs('es', 'español', 'SDH')],
    clasificaciones: [CO(0)],
    festivales: [{ nombre: 'Festival de Cine Infantil de los Andes', anio: 2025, seccion: 'Competencia' }],
    esquema_version: 1, registrado_en: dia(-20, '09:00')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_NEGOCIACION',
    titulo: 'Café para Dos', anio: 2026, paises_produccion: ['CO'], generos: ['ROMANCE', 'COMEDIA'],
    distribuidora: { nombre: 'Barranquilla Pictures', pais: 'CO' },
    direccion: [{ nombre: 'Julián Jiménez Martínez', id_actor_director: 5 }],
    reparto: [
      { nombre: 'Mariana Villamil Osorio', personaje: 'Paula', participacion: 'ACTUACION', id_actor_director: 10 },
      { nombre: 'Esteban Pérez López', personaje: 'Andrés', participacion: 'ACTUACION', id_actor_director: 35 }
    ],
    versiones: [{ tipo: 'CINE', duracion_min: 95, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('es', 'español')], subtitulos: [subs('en', 'inglés')],
    clasificaciones: [CO(7)],
    propuesta_exhibicion: { semanas: 4, copias: 3, formato: 'DCP 2K', desde: dia(45) },
    esquema_version: 1, registrado_en: dia(-7, '12:30')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_EVALUACION',
    titulo: 'La Ruta del Oro', anio: 2026, paises_produccion: ['CO', 'ES'], generos: ['ACCION', 'AVENTURA'],
    distribuidora: { nombre: 'Iberia Screen', pais: 'ES' },
    direccion: [{ nombre: 'Fernando Parra Parra', id_actor_director: 20 }],
    reparto: [
      { nombre: 'Isabela Isabela Jiménez Torres', personaje: 'Inspectora Vidal', participacion: 'ACTUACION', id_actor_director: 33 },
      { nombre: 'Rodrigo Díaz Cortés', personaje: 'El Mono', participacion: 'ACTUACION', id_actor_director: 28 }
    ],
    versiones: [
      { tipo: 'CINE', duracion_min: 121, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['5.1', 'DOLBY_ATMOS'] },
      { tipo: '3D', duracion_min: 121, formato_imagen: '3D', relacion_aspecto: '2.39:1', sonido: ['5.1', 'DOLBY_ATMOS'] }
    ],
    idiomas_audio: [audio('es', 'español')], subtitulos: [subs('es', 'español', 'SDH')],
    clasificaciones: [{ pais: 'ES', sistema: 'ICAA', clasificacion: '16', edad_minima: 16 }, CO_PENDIENTE],
    esquema_version: 1, registrado_en: dia(-15, '17:10')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_EVALUACION',
    titulo: 'Luces del Norte', titulo_original: 'Nordlys', anio: 2025, paises_produccion: ['NO'], generos: ['DRAMA'],
    distribuidora: { nombre: 'Fjord Distribution', pais: 'NO' },
    direccion: [{ nombre: 'Ingrid Solberg' }],
    reparto: [{ nombre: 'Henrik Aasen', personaje: 'Lars', participacion: 'ACTUACION' }],
    versiones: [{ tipo: 'CINE', duracion_min: 104, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('no', 'noruego')], subtitulos: [subs('es', 'español'), subs('en', 'inglés')],
    clasificaciones: [{ pais: 'NO', sistema: 'Medietilsynet', clasificacion: '9', edad_minima: 9 }, CO_PENDIENTE],
    premios: [{ certamen: 'Festival Nórdico de Cine Independiente', categoria: 'Mejor guion', resultado: 'GANADOR', anio: 2025 }],
    esquema_version: 1, registrado_en: dia(-25, '08:30')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_NEGOCIACION',
    titulo: 'El Huerto de Cristal', titulo_original: 'The Glass Orchard', anio: 2026, paises_produccion: ['GB'], generos: ['DRAMA', 'ROMANCE'],
    distribuidora: { nombre: 'Thames Arthouse', pais: 'GB' },
    direccion: [{ nombre: 'Oliver Grant' }],
    reparto: [{ nombre: 'Emily Hayes', personaje: 'Rose', participacion: 'ACTUACION' }],
    versiones: [
      { tipo: 'CINE', duracion_min: 117, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] },
      { tipo: 'DIRECTOR', duracion_min: 128, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }
    ],
    idiomas_audio: [audio('en', 'inglés')], subtitulos: [subs('es', 'español')],
    clasificaciones: [{ pais: 'GB', sistema: 'BBFC', clasificacion: '12A', edad_minima: 12 }, CO_PENDIENTE],
    evaluacion: { id_staff: 7, fecha: dia(-4, '11:00'), puntaje: 7.8, comentario: 'Funciona para la sala 3 de Usaquén entre semana.' },
    esquema_version: 1, registrado_en: dia(-18, '10:20')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_EVALUACION',
    titulo: 'El Camino de la Lluvia', titulo_original: 'Ame no Michi', anio: 2026, paises_produccion: ['JP'], generos: ['ANIMACION', 'FAMILIAR'],
    distribuidora: { nombre: 'Sakura Animation', pais: 'JP' },
    direccion: [{ nombre: 'Haruka Mori' }],
    reparto: [{ nombre: 'Yui Takeda', personaje: 'Sora (voz)', participacion: 'VOZ' }],
    versiones: [{ tipo: 'CINE', duracion_min: 101, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('ja', 'japonés'), audio('es', 'español', 'DOBLAJE')], subtitulos: [subs('es', 'español')],
    clasificaciones: [{ pais: 'JP', sistema: 'Eirin', clasificacion: 'G', edad_minima: 0 }, CO_PENDIENTE],
    esquema_version: 1, registrado_en: dia(-11, '14:00')
  },
  {
    id_pelicula: null, estado_catalogo: 'DESCARTADA',
    titulo: 'El Último Tren', titulo_original: 'Le Dernier Train', anio: 2025, paises_produccion: ['FR', 'BE'], generos: ['SUSPENSO'],
    distribuidora: { nombre: 'Lumière Sud', pais: 'FR' },
    direccion: [{ nombre: 'Camille Laurent' }],
    versiones: [{ tipo: 'CINE', duracion_min: 108, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('fr', 'francés')], subtitulos: [subs('es', 'español')],
    clasificaciones: [{ pais: 'FR', sistema: 'CNC', clasificacion: '-12', edad_minima: 12 }, CO_PENDIENTE],
    evaluacion: { id_staff: 7, fecha: dia(-14, '10:00'), puntaje: 5.5, comentario: 'Ritmo lento para la programación de fin de semana; se descarta por ahora.' },
    esquema_version: 1, registrado_en: dia(-30, '09:40')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_EVALUACION',
    titulo: 'Selva Adentro', anio: 2026, paises_produccion: ['CO'], generos: ['DOCUMENTAL'],
    sinopsis: 'Un año con los guardabosques del Amazonas colombiano.',
    distribuidora: { nombre: 'Andes Docs', pais: 'PE' },
    direccion: [{ nombre: 'Camila Arias Arias', id_actor_director: 37 }],
    reparto: [{ nombre: 'Héctor Óscar Gómez Rodríguez', personaje: 'Narrador', participacion: 'NARRACION', id_actor_director: 12 }],
    versiones: [{ tipo: 'CINE', duracion_min: 79, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('es', 'español'), audio('es', 'español', 'AUDIODESCRIPCION')],
    subtitulos: [subs('es', 'español', 'SDH'), subs('en', 'inglés')],
    clasificaciones: [CO(0)],
    esquema_version: 1, registrado_en: dia(-5, '15:30')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_NEGOCIACION',
    titulo: 'Robots en el Recreo', anio: 2026, paises_produccion: ['MX'], generos: ['ANIMACION', 'COMEDIA'],
    distribuidora: { nombre: 'Frontera Films', pais: 'MX' },
    direccion: [{ nombre: 'Diego Arriaga' }],
    reparto: [{ nombre: 'Andrea Diana Ruiz Torres', personaje: 'Robotina (voz)', participacion: 'VOZ', id_actor_director: 14 }],
    versiones: [
      { tipo: 'CINE', duracion_min: 89, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] },
      { tipo: '3D', duracion_min: 89, formato_imagen: '3D', relacion_aspecto: '1.85:1', sonido: ['5.1'] },
      { tipo: '4D', duracion_min: 89, formato_imagen: '4D', relacion_aspecto: '1.85:1', sonido: ['7.1'] }
    ],
    idiomas_audio: [audio('es', 'español')], subtitulos: [],
    clasificaciones: [{ pais: 'MX', sistema: 'RTC', clasificacion: 'AA', edad_minima: 0 }, CO_PENDIENTE],
    propuesta_exhibicion: { semanas: 5, copias: 4, formato: 'DCP 2K + 3D + archivo 4D', desde: dia(60) },
    esquema_version: 1, registrado_en: dia(-3, '09:15')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_EVALUACION',
    titulo: 'Medianoche en Medellín', anio: 2026, paises_produccion: ['CO'], generos: ['TERROR', 'SUSPENSO'],
    distribuidora: { nombre: 'Barranquilla Pictures', pais: 'CO' },
    direccion: [{ nombre: 'Sebastián Bermúdez Jiménez', id_actor_director: 21 }],
    reparto: [
      { nombre: 'Sofía Catalina Beltrán Jiménez', personaje: 'Valeria', participacion: 'ACTUACION', id_actor_director: 36 },
      { nombre: 'Óscar Villamil López', personaje: 'Don Fabio', participacion: 'ACTUACION', id_actor_director: 4 }
    ],
    versiones: [{ tipo: 'CINE', duracion_min: 94, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['5.1', 'DOLBY_ATMOS'] }],
    idiomas_audio: [audio('es', 'español')], subtitulos: [subs('en', 'inglés')],
    clasificaciones: [CO_PENDIENTE],
    esquema_version: 1, registrado_en: dia(-8, '18:00')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_EVALUACION',
    titulo: 'El Puente', titulo_original: 'A Ponte', anio: 2025, paises_produccion: ['BR'], generos: ['DRAMA'],
    distribuidora: { nombre: 'Atlántico Films', pais: 'BR' },
    direccion: [{ nombre: 'Lucas Ferreira' }],
    versiones: [{ tipo: 'CINE', duracion_min: 110, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('pt', 'portugués')], subtitulos: [subs('es', 'español')],
    clasificaciones: [{ pais: 'BR', sistema: 'ClassInd', clasificacion: '16', edad_minima: 16 }, CO_PENDIENTE],
    esquema_version: 1, registrado_en: dia(-22, '11:45')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_NEGOCIACION',
    titulo: 'Tango del Sur', anio: 2026, paises_produccion: ['AR'], generos: ['MUSICAL', 'DRAMA'],
    distribuidora: { nombre: 'Río de la Plata Cine', pais: 'AR' },
    direccion: [{ nombre: 'Ricardo Andrés Sánchez Rojas', id_actor_director: 29 }],
    reparto: [
      { nombre: 'Esteban Sebastián Díaz García', personaje: 'Julián', participacion: 'ACTUACION', id_actor_director: 2 },
      { nombre: 'Fernando Restrepo Rodríguez', personaje: 'Don Ernesto', participacion: 'ACTUACION', id_actor_director: 27 }
    ],
    versiones: [{ tipo: 'CINE', duracion_min: 113, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('es', 'español')], subtitulos: [subs('en', 'inglés')],
    clasificaciones: [{ pais: 'AR', sistema: 'INCAA', clasificacion: 'ATP', edad_minima: 0 }, CO_PENDIENTE],
    evaluacion: { id_staff: 12, fecha: dia(-2, '17:30'), puntaje: 8, comentario: 'Se puede acompañar de un conversatorio con el elenco.' },
    esquema_version: 1, registrado_en: dia(-10, '13:00')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_NEGOCIACION',
    titulo: 'Operación Cóndor Andino 2: Tormenta', titulo_original: 'Operation Andean Condor 2: Storm', anio: 2027,
    paises_produccion: ['US'], generos: ['ACCION'],
    relacionada_con: { id_pelicula: 7, relacion: 'SECUELA' },
    distribuidora: { nombre: 'Summit Ridge Studios', pais: 'US', contacto: 'colombia@summitridge.example' },
    direccion: [{ nombre: 'Fernando Parra Parra', id_actor_director: 20 }],
    reparto: [
      { nombre: 'Jack Turner', personaje: 'Agente Cole Bennett', participacion: 'ACTUACION' },
      { nombre: 'Verónica Díaz Arias', personaje: 'Teniente Sara Quiroga', participacion: 'ACTUACION', id_actor_director: 13 }
    ],
    versiones: [
      { tipo: 'CINE', duracion_min: 131, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['7.1', 'DOLBY_ATMOS'] },
      { tipo: '3D', duracion_min: 131, formato_imagen: '3D', relacion_aspecto: '2.39:1', sonido: ['7.1', 'DOLBY_ATMOS'] },
      { tipo: 'IMAX', duracion_min: 131, formato_imagen: 'IMAX', relacion_aspecto: '1.90:1', sonido: ['7.1'] }
    ],
    idiomas_audio: [audio('en', 'inglés'), audio('es', 'español', 'DOBLAJE')],
    subtitulos: [subs('es', 'español'), subs('es', 'español', 'SDH')],
    clasificaciones: [{ pais: 'US', sistema: 'MPA', clasificacion: 'PENDIENTE', edad_minima: null }, CO_PENDIENTE],
    propuesta_exhibicion: { semanas: 6, copias: 6, formato: 'DCP 4K + 3D', desde: dia(200) },
    esquema_version: 1, registrado_en: dia(-2, '10:00')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_EVALUACION',
    titulo: 'Planeta Agua', titulo_original: 'Wasserplanet', anio: 2025, paises_produccion: ['DE'], generos: ['DOCUMENTAL'],
    distribuidora: { nombre: 'Rhein Dokumentarfilm', pais: 'DE' },
    direccion: [{ nombre: 'Jonas Becker' }],
    versiones: [{ tipo: 'CINE', duracion_min: 88, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('de', 'alemán'), audio('es', 'español', 'DOBLAJE')], subtitulos: [subs('es', 'español')],
    clasificaciones: [{ pais: 'DE', sistema: 'FSK', clasificacion: '0', edad_minima: 0 }, CO_PENDIENTE],
    esquema_version: 1, registrado_en: dia(-16, '15:00')
  },
  {
    id_pelicula: null, estado_catalogo: 'EN_EVALUACION',
    titulo: 'La Abuela Rockera', anio: 2026, paises_produccion: ['CO'], generos: ['COMEDIA', 'FAMILIAR'],
    distribuidora: { nombre: 'Cóndor Animación', pais: 'CO' },
    direccion: [{ nombre: 'Paula Castro Caicedo', id_actor_director: 32 }],
    reparto: [{ nombre: 'Gabriela Salazar Gómez', personaje: 'Abuela Chepa', participacion: 'ACTUACION', id_actor_director: 15 }],
    versiones: [{ tipo: 'CINE', duracion_min: 97, formato_imagen: '2D', relacion_aspecto: '1.85:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('es', 'español')], subtitulos: [subs('es', 'español', 'SDH')],
    clasificaciones: [CO(7)],
    esquema_version: 1, registrado_en: dia(-1, '16:20')
  },
  {
    id_pelicula: null, estado_catalogo: 'DESCARTADA',
    titulo: 'Hielo Negro', titulo_original: 'Glace noire', anio: 2025, paises_produccion: ['CA'], generos: ['SUSPENSO'],
    distribuidora: { nombre: 'Maple Leaf Family', pais: 'CA' },
    direccion: [{ nombre: 'Marc Tremblay' }],
    versiones: [{ tipo: 'CINE', duracion_min: 99, formato_imagen: '2D', relacion_aspecto: '2.39:1', sonido: ['5.1'] }],
    idiomas_audio: [audio('fr', 'francés'), audio('en', 'inglés')], subtitulos: [subs('es', 'español')],
    clasificaciones: [{ pais: 'CA', sistema: 'Régie du cinéma (Quebec)', clasificacion: '13+', edad_minima: 13 }, CO_PENDIENTE],
    evaluacion: { id_staff: 12, fecha: dia(-21, '10:30'), puntaje: 6, comentario: 'La distribuidora no tiene a tiempo la copia con subtítulos en español.' },
    esquema_version: 1, registrado_en: dia(-35, '12:00')
  }
];


// ─────────────────────────────────────────────────────────────────────────────
// requisitos_proyeccion: una ficha técnica por cada función especial
// ─────────────────────────────────────────────────────────────────────────────
// funciones de 02_datos_prueba.sql: id_funcion -> [id_sala, id_pelicula, día, hora, tipo, versión]
const FUNCIONES = {
  1: [8, 8, -15, '19:00', 'REGULAR', 'SUBTITULADA'],   2: [1, 1, -14, '18:00', 'REGULAR', 'SUBTITULADA'],
  3: [5, 6, -13, '17:30', 'REGULAR', 'SUBTITULADA'],   4: [2, 3, -12, '16:00', 'REGULAR', 'DOBLADA'],
  5: [3, 5, -11, '19:30', 'REGULAR', 'SUBTITULADA'],   6: [1, 7, -10, '20:30', 'REGULAR', 'DOBLADA'],
  7: [2, 12, -9, '19:00', 'REGULAR', 'DOBLADA'],       8: [4, 5, -8, '21:00', 'REGULAR', 'SUBTITULADA'],
  9: [5, 12, -7, '20:00', 'CONVERSATORIO', 'DOBLADA'], 10: [6, 2, -6, '14:00', 'REGULAR', 'DOBLADA'],
  11: [7, 9, -5, '15:00', 'REGULAR', 'DOBLADA'],       12: [8, 10, -4, '16:30', 'CONVERSATORIO', 'SUBTITULADA'],
  13: [9, 5, -3, '20:00', 'REGULAR', 'SUBTITULADA'],   14: [7, 3, -2, '18:00', 'REGULAR', 'DOBLADA'],
  15: [1, 4, -2, '21:30', 'REGULAR', 'SUBTITULADA'],   16: [3, 7, -1, '20:00', 'REGULAR', 'DOBLADA'],
  17: [1, 2, 1, '14:30', 'REGULAR', 'DOBLADA'],        18: [2, 9, 1, '15:30', 'REGULAR', 'DOBLADA'],
  19: [1, 1, 1, '18:00', 'REGULAR', 'SUBTITULADA'],    20: [5, 3, 2, '17:00', 'REGULAR', 'DOBLADA'],
  21: [3, 5, 2, '19:00', 'REGULAR', 'SUBTITULADA'],    22: [8, 7, 2, '19:30', 'REGULAR', 'DOBLADA'],
  23: [1, 7, 2, '20:30', 'REGULAR', 'SUBTITULADA'],    24: [7, 10, 3, '16:00', 'CONVERSATORIO', 'SUBTITULADA'],
  25: [2, 6, 3, '19:00', 'REGULAR', 'SUBTITULADA'],    26: [4, 5, 3, '21:30', 'REGULAR', 'SUBTITULADA'],
  27: [4, 2, 4, '17:00', 'REGULAR', 'DOBLADA'],        28: [6, 5, 4, '19:30', 'REGULAR', 'SUBTITULADA'],
  29: [9, 1, 4, '19:30', 'CONVERSATORIO', 'SUBTITULADA'], 30: [3, 11, 5, '21:00', 'PREESTRENO', 'SUBTITULADA'],
  31: [7, 4, 5, '21:00', 'REGULAR', 'SUBTITULADA'],    32: [8, 8, 6, '18:00', 'CONVERSATORIO', 'SUBTITULADA'],
  33: [5, 11, 6, '20:00', 'PREESTRENO', 'SUBTITULADA'], 34: [6, 11, 7, '21:30', 'PREESTRENO', 'SUBTITULADA'],
  35: [9, 1, 8, '20:00', 'REGULAR', 'SUBTITULADA'],    36: [9, 11, 9, '19:00', 'PREESTRENO', 'SUBTITULADA']
};
// salas de PostgreSQL: id_sala -> [id_sede, formato]
const SALAS = { 1: [1, '2D'], 2: [1, '2D'], 3: [1, '3D'], 4: [1, '4D'], 5: [2, '2D'], 6: [2, '3D'], 7: [2, '2D'], 8: [3, '2D'], 9: [3, '3D'], 10: [3, '2D'] };
const PROYECCIONISTA = { 1: 5, 2: 10, 3: 15 };   // staff.id_staff por sede

// Datos del paquete de cine digital (DCP) que entrega cada distribuidora
const PELIS = {
  1: { dcp: 'ELULTIMOFARO', idioma: 'PT', aspecto: 'S', atmos: false, res: '2K', gb: 182.4, co: '12' },
  2: { dcp: 'AVENTURASPARAMO', idioma: 'ES', aspecto: 'F', atmos: true, res: '2K', gb: 148.9, co: 'T', efectos4d: ['MOVIMIENTO', 'VIENTO', 'BURBUJAS', 'AROMA', 'AGUA'] },
  3: { dcp: 'CUMBIAMEDIANOCHE', idioma: 'ES', aspecto: 'F', atmos: true, res: '2K', gb: 165.2, co: '7' },
  4: { dcp: 'SOMBRASMONSERRATE', idioma: 'EN', aspecto: 'S', atmos: true, res: '2K', gb: 158.7, co: '18' },
  5: { dcp: 'GALAXIACERO', idioma: 'EN', aspecto: 'S', atmos: true, res: '4K', gb: 286.3, co: '12', efectos4d: ['MOVIMIENTO', 'VIBRACION', 'VIENTO', 'AGUA', 'DESTELLOS', 'HUMO'] },
  6: { dcp: 'CORAZONESBOGOTA', idioma: 'FR', aspecto: 'F', atmos: false, res: '2K', gb: 171.0, co: '12' },
  7: { dcp: 'OPCONDORANDINO', idioma: 'EN', aspecto: 'S', atmos: true, res: '2K', gb: 204.6, co: '15' },
  8: { dcp: 'CASADELRIO', idioma: 'EN', aspecto: 'F', atmos: false, res: '2K', gb: 176.2, co: '15' },
  9: { dcp: 'MIAMIGODRAGON', idioma: 'EN', aspecto: 'F', atmos: true, res: '2K', gb: 139.8, co: 'T' },
  10: { dcp: 'VOCESDELCANON', idioma: 'QU', aspecto: 'F', atmos: false, res: '2K', gb: 121.5, co: '7' },
  11: { dcp: 'ECLIPSEFINAL', idioma: 'EN', aspecto: 'S', atmos: true, res: '4K', gb: 312.7, co: '12' },
  12: { dcp: 'NOCHESDESALSA', idioma: 'ES', aspecto: 'F', atmos: false, res: '2K', gb: 160.4, co: '7' }
};

// Requisito por componente; la especificación cambia según la sala y la película
const SISTEMA_3D = {
  3: { sistema: 'RealD XL', gafas: 'PASIVAS_POLARIZACION_CIRCULAR', pantalla: 'Plateada 12 x 5 m', luminancia_min_fl: 4.5, gafas_disponibles: 140 },
  6: { sistema: 'Dolby 3D', gafas: 'PASIVAS_ESPECTRALES', pantalla: 'Blanca mate 11 x 4,6 m', luminancia_min_fl: 4.0, gafas_disponibles: 125 },
  9: { sistema: 'XpanD', gafas: 'ACTIVAS_OBTURADOR', emisor_sincronizacion: 'Infrarrojo', pantalla: 'Blanca 12 x 5 m', luminancia_min_fl: 3.5, gafas_cargadas_min: 150 }
};
const ATMOS = {
  1: { procesador: 'Dolby CP950A', altavoces: 34, altavoces_techo: 8 },
  5: { procesador: 'Dolby CP950A', altavoces: 28, altavoces_techo: 6 },
  8: { procesador: 'Dolby CP950A', altavoces: 38, altavoces_techo: 10 }
};
const tresD = (f, extra = {}) => ({ componente: '3D', obligatorio: true, especificacion: SISTEMA_3D[FUNCIONES[f][0]], ...extra });
const cuatroD = f => ({
  componente: '4D', obligatorio: true,
  especificacion: { butacas_moviles: 60, grados_libertad: 3, efectos: PELIS[FUNCIONES[f][1]].efectos4d,
                    archivo_efectos: `${PELIS[FUNCIONES[f][1]].dcp}_4D_FX.xml`, estatura_minima_cm: 100, edad_minima_recomendada: 4 }
});
const atmos = f => ({ componente: 'DOLBY_ATMOS', obligatorio: true, especificacion: { ...ATMOS[FUNCIONES[f][0]], pista: 'IAB (audio inmersivo) incluida en el DCP' } });
const subtitulos = f => {
  const [id_sala, p] = FUNCIONES[f];
  const espec = { idioma: 'es', tipo: 'ESTANDAR', formato: 'SMPTE Timed Text (XML) dentro del DCP', idioma_audio: PELIS[p].idioma.toLowerCase(),
                  posicion: 'INFERIOR', tamano_fuente_px: 42 };
  if (SALAS[id_sala][1] === '3D') espec.paralaje = 'negativo: el texto queda delante de la imagen';
  return { componente: 'SUBTITULOS', obligatorio: true, especificacion: espec };
};
const conversatorio = (invitados, duracion_min) => ({
  componente: 'CONVERSATORIO', obligatorio: true,
  especificacion: { invitados, microfonos_inalambricos: invitados + 1, sillas_escenario: invitados + 1,
                    iluminacion_escenario: 'Frontal cálida al 60 %', duracion_min, traduccion_simultanea: false }
});
const preestreno = (alfombra_roja, prensa_acreditada, guardias) => ({
  componente: 'PREESTRENO', obligatorio: true,
  especificacion: { alfombra_roja, prensa_acreditada, apertura_puertas_min_antes: 45,
                    control_antipirateria: { revision_celulares: true, visores_nocturnos: true, guardias } }
});
const imax = () => ({
  componente: 'IMAX', obligatorio: false, cumple: false,
  especificacion: { relacion_aspecto: '1.90:1', proyeccion: 'Láser doble 4K', certificacion_sala: 'requerida' },
  observacion: 'Ninguna sala de CuevanaCinema tiene certificación IMAX; la distribuidora autorizó el DCP estándar.'
});

function dcp(f) {
  const [id_sala, p, d, , tipo, version] = FUNCIONES[f];
  const formato = SALAS[id_sala][1];
  const peli = PELIS[p];
  const pistas = version === 'DOBLADA' ? 'ES-XX' : `${peli.idioma}-ES`;
  return {
    paquete: [peli.dcp, formato === '3D' ? 'FTR-3D' : 'FTR', peli.aspecto, pistas, `CO-${peli.co}`, peli.atmos ? 'ATMOS' : '51', peli.res, 'SMPTE_OV'].join('_'),
    resolucion: peli.res,
    tamano_gb: Math.round(peli.gb * (formato === '3D' ? 1.4 : 1) * 10) / 10,
    cifrado: true,
    kdm: tipo === 'PREESTRENO'
      ? { valido_desde: dia(d, '12:00'), valido_hasta: dia(d, '23:59') }   // llave válida solo el día del preestreno
      : { valido_desde: dia(d - 2, '00:00'), valido_hasta: dia(d + 3, '23:59') }
  };
}

function req(f, componentes, verificacion) {
  const [id_sala, id_pelicula, d, hora, tipo, version] = FUNCIONES[f];
  const [id_sede, formato_sala] = SALAS[id_sala];
  const inicio = dia(d, hora);
  const v = verificacion || (inicio < new Date()
    ? { estado: 'APROBADA', id_staff: PROYECCIONISTA[id_sede], fecha: new Date(inicio.getTime() - 90 * 60e3) }
    : { estado: 'PENDIENTE' });
  const requisitos = componentes.map(c => c.obligatorio
    ? { ...c, cumple: c.cumple !== undefined ? c.cumple : (v.estado === 'APROBADA' ? true : null) }
    : c);
  return {
    id_funcion: f, id_sala, id_sede, id_pelicula,
    funcion: { fecha_hora_inicio: inicio, tipo, version, formato_sala },
    experiencias: requisitos.filter(r => r.obligatorio).map(r => r.componente),
    requisitos,
    dcp: dcp(f),
    verificacion: v,
    esquema_version: 1,
    creado_en: dia(Math.min(d - 3, -1), '09:00')
  };
}

const requisitos = [
  req(1, [subtitulos(1)], { estado: 'APROBADA', id_staff: 15, fecha: dia(-15, '17:30'), observaciones: 'Durante la función se cayó el canal central del audio (ver INC-0005).', codigo_incidente: 'INC-0005' }),
  req(2, [subtitulos(2)]),
  req(3, [subtitulos(3)]),
  req(5, [tresD(5), subtitulos(5)]),
  req(6, [atmos(6)]),
  req(8, [cuatroD(8), subtitulos(8)], { estado: 'APROBADA', id_staff: 5, fecha: dia(-8, '19:30'), observaciones: 'Durante la función fallaron seis butacas de la fila C (ver INC-0016).', codigo_incidente: 'INC-0016' }),
  req(9, [conversatorio(2, 45)]),
  req(10, [tresD(10)]),
  req(12, [subtitulos(12), conversatorio(1, 40)]),
  req(13, [tresD(13), subtitulos(13)], { estado: 'APROBADA', id_staff: 15, fecha: dia(-3, '18:30'), observaciones: 'Prueba previa correcta; el emisor 3D falló a mitad de la función (ver INC-0024).', codigo_incidente: 'INC-0024' }),
  req(15, [subtitulos(15), atmos(15)]),
  req(16, [tresD(16, { cumple: false, observacion: 'El proyector no encendió: error del módulo láser.' })],
       { estado: 'RECHAZADA', id_staff: 5, fecha: dia(-1, '18:55'), observaciones: 'Función cancelada en PostgreSQL y ventas reembolsadas.', codigo_incidente: 'INC-0031' }),
  req(17, [atmos(17)]),
  req(19, [subtitulos(19)]),
  req(20, [atmos(20)]),
  req(21, [tresD(21), subtitulos(21)]),
  req(22, [atmos(22)]),
  req(23, [subtitulos(23), atmos(23)]),
  req(24, [subtitulos(24), conversatorio(2, 40)]),
  req(25, [subtitulos(25)]),
  req(26, [cuatroD(26), subtitulos(26)]),
  req(27, [cuatroD(27)]),
  req(28, [tresD(28), subtitulos(28)]),
  req(29, [tresD(29), subtitulos(29), conversatorio(2, 30)], { estado: 'NO_APLICA', observaciones: 'Conversatorio cancelado en PostgreSQL por indisponibilidad del invitado.' }),
  req(30, [tresD(30), subtitulos(30), preestreno(true, 25, 6), imax()]),
  req(31, [subtitulos(31)]),
  req(32, [subtitulos(32), conversatorio(1, 45)]),
  req(33, [subtitulos(33), atmos(33), preestreno(true, 30, 6), imax()]),
  req(34, [tresD(34), subtitulos(34), preestreno(false, 10, 4), imax()]),
  req(35, [tresD(35), subtitulos(35)]),
  req(36, [tresD(36), subtitulos(36), preestreno(true, 20, 5), imax()])
];


// ─────────────────────────────────────────────────────────────────────────────
// resenas_peliculas: 19 con compra verificada (ventas de funciones finalizadas) y 21 sin compra propia
// ─────────────────────────────────────────────────────────────────────────────
const resenas = [
  { id_pelicula: 8, pelicula_titulo: 'La Casa del Río', id_espectador: 4, autor_alias: 'Andrea C.', compra_verificada: true, id_venta: 5, id_funcion: 1,
    calificacion: 2, titulo: 'Buena película, mala función',
    texto: 'La historia de los hermanos Herrera me tocó, pero a la mitad se fue el sonido de los diálogos casi diez minutos y nadie avisó nada. Con los subtítulos se podía seguir, pero así no se disfruta.',
    fecha: dia(-15, '22:40'), aspectos: { imagen: 4, sonido: 1, comodidad: 3, atencion: 3 }, canal: 'WEB', votos_utiles: 14, estado_moderacion: 'PUBLICADA',
    respuesta_empresa: { texto: 'Andrea, qué pena con usted. Esa noche falló el procesador de audio de la sala 1 de Kennedy y ya quedó revisado. Le enviamos al correo un bono para otra función.', fecha: dia(-14, '10:15'), id_staff: 12 },
    esquema_version: 1 },
  { id_pelicula: 8, pelicula_titulo: 'La Casa del Río', id_espectador: 20, autor_alias: 'camilo.v', compra_verificada: true, id_venta: 6, id_funcion: 1,
    calificacion: 4, titulo: 'Actuaciones enormes',
    texto: 'Juan Ruiz Osorio está impresionante. Es lenta al principio, pero el final lo compensa. El corte de sonido fue molesto, aunque lo arreglaron rápido.',
    fecha: dia(-14, '08:50'), aspectos: { imagen: 5, sonido: 3 }, etiquetas: ['drama', 'actuación'], canal: 'APP', votos_utiles: 6, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 1, pelicula_titulo: 'El Último Faro', id_espectador: 32, autor_alias: 'Lina B.', compra_verificada: true, id_venta: 2, id_funcion: 2,
    calificacion: 5, titulo: 'Suspenso del bueno',
    texto: 'Fui con mi familia y no pudimos despegar los ojos de la pantalla. La fotografía del faro es hermosa y el giro final nadie lo vio venir.',
    fecha: dia(-14, '21:35'), aspectos: { imagen: 5, sonido: 4, comodidad: 5 }, etiquetas: ['suspenso', 'fotografía'], contiene_spoilers: false, canal: 'WEB', votos_utiles: 22, estado_moderacion: 'PUBLICADA',
    respuesta_empresa: { texto: '¡Gracias, Lina! Nos alegra que la hayan disfrutado en familia.', fecha: dia(-13, '09:00'), id_staff: 1 },
    esquema_version: 1 },
  { id_pelicula: 6, pelicula_titulo: 'Corazones en Bogotá', id_espectador: 31, autor_alias: 'Juan Alejandro H.', compra_verificada: true, id_venta: 3, id_funcion: 3,
    calificacion: 3, titulo: 'Linda, pero los subtítulos…',
    texto: 'La química entre Camila y Antoine es muy bonita y Bogotá se ve preciosa. Lo malo fue que en los primeros minutos los subtítulos iban adelantados.',
    fecha: dia(-13, '20:10'), aspectos: { imagen: 4, sonido: 4, comodidad: 4 }, canal: 'WEB', votos_utiles: 3, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 6, pelicula_titulo: 'Corazones en Bogotá', id_espectador: 12, autor_alias: 'Santiago G.', compra_verificada: true, id_venta: 4, id_funcion: 3,
    calificacion: 4, titulo: 'Romántica sin ser cursi',
    texto: 'Me gustó que la mitad sea en francés y la otra en español, se siente real. Llevé a mi esposa y salimos contentos.',
    fecha: dia(-12, '10:30'), canal: 'APP', votos_utiles: 2, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 3, pelicula_titulo: 'Cumbia de Medianoche', id_espectador: 37, autor_alias: 'Iván R.', compra_verificada: true, id_venta: 1, id_funcion: 4,
    calificacion: 5, titulo: 'Para reírse en familia',
    texto: 'Fuimos cinco y nos reímos de principio a fin. La música es buenísima, salimos cantando. Don Abel se roba la película.',
    fecha: dia(-12, '19:05'), aspectos: { sonido: 5, comodidad: 4, atencion: 5 }, etiquetas: ['comedia', 'música', 'familia'], canal: 'WEB', votos_utiles: 9, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 5, pelicula_titulo: 'Galaxia Cero', id_espectador: 36, autor_alias: 'FerVargas', compra_verificada: true, id_venta: 8, id_funcion: 5,
    calificacion: 5, titulo: 'El mejor 3D que he visto',
    texto: 'La escena de la nave entrando al agujero negro en 3D es impresionante. Imagen muy brillante, nada de esa sensación oscura de otras salas.',
    fecha: dia(-11, '23:15'), aspectos: { imagen: 5, sonido: 5, comodidad: 4 }, etiquetas: ['3D', 'ciencia ficción'], canal: 'APP', votos_utiles: 31, estado_moderacion: 'PUBLICADA',
    respuesta_empresa: { texto: '¡Gracias, Fernando! La sala 3 de Chapinero tiene pantalla plateada para 3D; qué bueno que se notó.', fecha: dia(-10, '09:20'), id_staff: 1 },
    esquema_version: 1 },
  { id_pelicula: 7, pelicula_titulo: 'Operación Cóndor Andino', id_espectador: 32, autor_alias: 'Lina B.', compra_verificada: true, id_venta: 9, id_funcion: 6,
    calificacion: 3, titulo: 'Acción buena, público pésimo',
    texto: 'La película cumple: persecuciones, explosiones y buen sonido. Pero atrás había un grupo hablando y con el celular prendido toda la función.',
    fecha: dia(-10, '23:40'), aspectos: { imagen: 4, sonido: 4, comodidad: 2, atencion: 2 }, canal: 'WEB', votos_utiles: 11, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 7, pelicula_titulo: 'Operación Cóndor Andino', id_espectador: 22, autor_alias: 'Natalia M.', compra_verificada: true, id_venta: 10, id_funcion: 6,
    calificacion: 2, titulo: 'Se armó una pelea en la sala',
    texto: 'Dos señores discutieron por los puestos y pararon la función como diez minutos. Seguridad llegó tarde. Además el sonido retumbaba en las escenas de explosiones.',
    fecha: dia(-10, '23:55'), aspectos: { sonido: 2, atencion: 2 }, canal: 'APP', votos_utiles: 17, estado_moderacion: 'PUBLICADA',
    respuesta_empresa: { texto: 'Natalia, lamentamos lo ocurrido. Seguridad atendió la situación y el subwoofer de la sala ya fue revisado. Le escribimos al correo para compensarla.', fecha: dia(-9, '11:30'), id_staff: 1 },
    esquema_version: 1 },
  { id_pelicula: 7, pelicula_titulo: 'Operación Cóndor Andino', id_espectador: 21, autor_alias: 'Daniela S.', compra_verificada: true, id_venta: 11, id_funcion: 6,
    calificacion: 3,
    texto: 'Entretenida pero muy larga. Hubo problemas con otros espectadores y nadie de la sala intervino a tiempo.',
    fecha: dia(-9, '08:15'), canal: 'WEB', votos_utiles: 1, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 12, pelicula_titulo: 'Noches de Salsa', id_espectador: 5, autor_alias: 'Luisa P.', compra_verificada: true, id_venta: 17, id_funcion: 7,
    calificacion: 4, titulo: 'Mucha salsa',
    texto: 'La película es chévere y Tatiana Arias baila increíble. Lo único, la fila en taquilla: casi media hora con una sola taquilla abierta.',
    fecha: dia(-9, '22:20'), aspectos: { comodidad: 4, atencion: 2 }, etiquetas: ['comedia', 'baile'], canal: 'APP', votos_utiles: 4, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 5, pelicula_titulo: 'Galaxia Cero', id_espectador: 20, autor_alias: 'camilo.v', compra_verificada: true, id_venta: 12, id_funcion: 8,
    calificacion: 3, titulo: '4D a medias',
    texto: 'La película me encantó, pero mi silla no se movió en toda la función y las de al lado sí. Pagué 4D y vi una película normal con viento.',
    fecha: dia(-8, '23:35'), aspectos: { imagen: 5, sonido: 5, comodidad: 2 }, etiquetas: ['4D'], canal: 'WEB', votos_utiles: 8, estado_moderacion: 'PUBLICADA',
    respuesta_empresa: { texto: 'Camilo, tiene razón: fallaron varias butacas de la fila C. Ya cambiamos los actuadores y le enviamos un bono 4D.', fecha: dia(-7, '10:05'), id_staff: 1 },
    esquema_version: 1 },
  { id_pelicula: 2, pelicula_titulo: 'Aventuras en el Páramo', id_espectador: 36, autor_alias: 'FerVargas', compra_verificada: true, id_venta: 36, id_funcion: 10,
    calificacion: 4, titulo: 'Mis sobrinos felices',
    texto: 'Llevé a cuatro sobrinos y salieron imitando al oso de anteojos. El 3D está bien, aunque las gafas les quedaban grandes a los niños.',
    fecha: dia(-6, '18:40'), aspectos: { imagen: 4, comodidad: 4 }, etiquetas: ['familia', 'animación', '3D'], canal: 'APP', votos_utiles: 5, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 9, pelicula_titulo: 'Mi Amigo el Dragón', id_espectador: 17, autor_alias: 'Catalina O.', compra_verificada: true, id_venta: 41, id_funcion: 11,
    calificacion: 4, titulo: 'Muy tierna',
    texto: 'Fui con mi nieta y le encantó el dragón. La sala estaba demasiado caliente, el aire no estaba funcionando bien.',
    fecha: dia(-5, '19:30'), aspectos: { comodidad: 2 }, canal: 'WEB', votos_utiles: 3, estado_moderacion: 'PUBLICADA',
    respuesta_empresa: { texto: 'Gracias, Catalina. Esa tarde falló el aire acondicionado de la sala 3 de Usaquén y ya quedó reparado.', fecha: dia(-4, '09:10'), id_staff: 7 },
    esquema_version: 1 },
  { id_pelicula: 10, pelicula_titulo: 'Voces del Cañón', id_espectador: 24, autor_alias: 'Iván Ramírez', compra_verificada: true, id_venta: 39, id_funcion: 12,
    calificacion: 5, titulo: 'El conversatorio valió la pena',
    texto: 'El documental es hermoso y escuchar después al narrador contando cómo grabaron en el cañón fue lo mejor. Ojalá hagan más funciones así.',
    fecha: dia(-4, '20:00'), aspectos: { imagen: 5, sonido: 4 }, etiquetas: ['documental', 'conversatorio'], canal: 'WEB', votos_utiles: 7, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 5, pelicula_titulo: 'Galaxia Cero', id_espectador: 11, autor_alias: 'Fernando P.', compra_verificada: true, id_venta: 48, id_funcion: 13,
    calificacion: 1, titulo: 'Imagen doble y dolor de cabeza',
    texto: 'Desde la mitad el 3D se veía doble, como si las gafas se desincronizaran. Avisamos y nos dijeron que era el emisor. Salí con dolor de cabeza.',
    fecha: dia(-3, '23:05'), aspectos: { imagen: 1, sonido: 4, atencion: 3 }, etiquetas: ['3D'], canal: 'APP', votos_utiles: 19, estado_moderacion: 'PUBLICADA',
    respuesta_empresa: { texto: 'Fernando, le ofrecemos disculpas. Falló el emisor de sincronización de las gafas 3D de la sala 2 de Kennedy y ya fue reemplazado. Le enviamos un bono para repetir la función.', fecha: dia(-2, '11:20'), id_staff: 12 },
    esquema_version: 1 },
  { id_pelicula: 3, pelicula_titulo: 'Cumbia de Medianoche', id_espectador: 15, autor_alias: 'Luisa S.', compra_verificada: true, id_venta: 58, id_funcion: 14,
    calificacion: 4, titulo: 'Muy divertida',
    texto: 'Fuimos un grupo de amigas y nos reímos muchísimo. La banda sonora es lo mejor.',
    fecha: dia(-2, '21:10'), canal: 'APP', votos_utiles: 0, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 4, pelicula_titulo: 'Sombras de Monserrate', id_espectador: 13, autor_alias: 'Héctor R.', compra_verificada: true, id_venta: 27, id_funcion: 15,
    calificacion: 4, titulo: 'Terror de verdad',
    texto: 'Muy buena atmósfera y sustos bien logrados. A una persona le dio un desmayo y detuvieron la función, pero el personal actuó rápido y bien.',
    fecha: dia(-1, '00:40'), aspectos: { imagen: 4, sonido: 5, atencion: 5 }, etiquetas: ['terror'], canal: 'WEB', votos_utiles: 12, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 4, pelicula_titulo: 'Sombras de Monserrate', id_espectador: 22, autor_alias: 'Natalia M.', compra_verificada: true, id_venta: 35, id_funcion: 15,
    calificacion: 3, titulo: 'Se cortó el ritmo',
    texto: 'Me gustó, pero con la pausa por la emergencia se perdió la tensión. Ojo: el final tiene una escena muy fuerte.',
    fecha: dia(-1, '10:25'), contiene_spoilers: true, canal: 'APP', votos_utiles: 2, estado_moderacion: 'PUBLICADA', esquema_version: 1 },

  // Sin compra propia: fueron de acompañantes o compraron en otro lado
  { id_pelicula: 5, pelicula_titulo: 'Galaxia Cero', id_espectador: 1, autor_alias: 'Gabriela P.', compra_verificada: false, id_funcion: 5,
    calificacion: 5, titulo: 'Fui de invitada',
    texto: 'Un amigo compró las boletas y me invitó. La mejor película de ciencia ficción del año, y en 3D se ve espectacular.',
    fecha: dia(-10, '12:00'), canal: 'WEB', votos_utiles: 3, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 1, pelicula_titulo: 'El Último Faro', id_espectador: 14, autor_alias: 'Diana R.', compra_verificada: false, id_funcion: 2,
    calificacion: 4, titulo: 'Muy buena',
    texto: 'Una historia de suspenso que te atrapa. Los subtítulos en español se leían perfecto.',
    fecha: dia(-13, '08:30'), canal: 'APP', votos_utiles: 1, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 3, pelicula_titulo: 'Cumbia de Medianoche', id_espectador: 19, autor_alias: 'Andrés A.', compra_verificada: false, id_funcion: 4,
    calificacion: 4, titulo: 'Me reí mucho',
    texto: 'Comedia sencilla pero muy bien hecha. Ideal para ir con niños.',
    fecha: dia(-11, '14:00'), canal: 'WEB', votos_utiles: 0, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 6, pelicula_titulo: 'Corazones en Bogotá', id_espectador: 28, autor_alias: 'Mateo C.', compra_verificada: false,
    calificacion: 3,
    texto: 'La vi con mi esposa. La música y los paisajes de Bogotá son lo mejor, pero la historia es predecible.',
    fecha: dia(-9, '17:45'), canal: 'WEB', votos_utiles: 2, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 9, pelicula_titulo: 'Mi Amigo el Dragón', id_espectador: 33, autor_alias: 'Valentina M.', compra_verificada: false, id_funcion: 11,
    calificacion: 5, titulo: 'Para toda la familia',
    texto: 'Mi hermana me llevó con su nieta. Hacía calor en la sala, pero la película es una ternura.',
    fecha: dia(-5, '20:10'), canal: 'APP', votos_utiles: 1, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 12, pelicula_titulo: 'Noches de Salsa', id_espectador: 10, autor_alias: 'Valentina D.', compra_verificada: false,
    calificacion: 4, titulo: 'Alegre y bailable',
    texto: 'Me recordó las películas de antes. Buena para pasar un rato alegre.',
    fecha: dia(-20, '16:00'), canal: 'WEB', votos_utiles: 0, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 7, pelicula_titulo: 'Operación Cóndor Andino', id_espectador: 2, autor_alias: 'Camilo H.', compra_verificada: false, id_funcion: 6,
    calificacion: 2, titulo: 'Mala experiencia',
    texto: 'Fui con mi hija y hubo una pelea a dos filas de nosotros. La película bien, la experiencia mal.',
    fecha: dia(-9, '09:40'), canal: 'WEB', votos_utiles: 5, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 4, pelicula_titulo: 'Sombras de Monserrate', id_espectador: 7, autor_alias: 'Sofía M.', compra_verificada: false, id_funcion: 15,
    calificacion: 5, titulo: 'Me morí del susto',
    texto: 'De las mejores de terror que he visto. Hasta la pausa por la emergencia dio más miedo, jaja.',
    fecha: dia(-1, '01:15'), etiquetas: ['terror'], canal: 'APP', votos_utiles: 4, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 10, pelicula_titulo: 'Voces del Cañón', id_espectador: 8, autor_alias: 'Andrea S.', compra_verificada: false, id_funcion: 12,
    calificacion: 5, titulo: 'Hermoso documental',
    texto: 'Los paisajes y las voces de los arrieros son conmovedores. El conversatorio fue muy enriquecedor.',
    fecha: dia(-4, '21:30'), canal: 'WEB', votos_utiles: 2, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 2, pelicula_titulo: 'Aventuras en el Páramo', id_espectador: 16, autor_alias: 'andreasalazar', compra_verificada: false,
    calificacion: 3, titulo: 'Bonita pero corta',
    texto: 'A mis sobrinos les gustó, a mí se me hizo corta. La música andina está muy bien.',
    fecha: dia(-15, '13:00'), canal: 'APP', votos_utiles: 0, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 5, pelicula_titulo: 'Galaxia Cero', id_espectador: 18, autor_alias: 'Santiago J.', compra_verificada: false, id_funcion: 13,
    calificacion: 2, titulo: 'El 3D falló',
    texto: 'La película es buena, pero la imagen se veía doble en la segunda mitad. Mi amigo pidió compensación.',
    fecha: dia(-2, '09:00'), aspectos: { imagen: 1 }, canal: 'WEB', votos_utiles: 6, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 8, pelicula_titulo: 'La Casa del Río', id_espectador: 23, autor_alias: 'Miguel P.', compra_verificada: false, id_funcion: 1,
    calificacion: 3, titulo: 'Le faltó audio',
    texto: 'Drama bien actuado, pero el problema de audio dañó la mitad de la función.',
    fecha: dia(-14, '12:30'), canal: 'WEB', votos_utiles: 1, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 1, pelicula_titulo: 'El Último Faro', id_espectador: 25, autor_alias: 'Alejandro J.', compra_verificada: false,
    calificacion: 4, titulo: 'Recomendada',
    texto: 'Muy buen suspenso brasileño-colombiano. La fotografía es de otro nivel.',
    fecha: dia(-30, '18:00'), canal: 'WEB', votos_utiles: 3, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 7, pelicula_titulo: 'Operación Cóndor Andino', id_espectador: 26, autor_alias: 'Juan C.', compra_verificada: false,
    calificacion: 2, titulo: 'Más de lo mismo',
    texto: 'Muy predecible. Las escenas de acción están bien, pero el guion es flojo.',
    fecha: dia(-40, '20:00'), canal: 'APP', votos_utiles: 2, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 5, pelicula_titulo: 'Galaxia Cero', id_espectador: 29, autor_alias: 'Nicolás P.', compra_verificada: false,
    calificacion: 4, titulo: 'Muy buena',
    texto: 'Muy buena también en 2D. Los efectos y la música de la nave son lo máximo.',
    fecha: dia(-50, '19:00'), canal: 'WEB', votos_utiles: 0, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 10, pelicula_titulo: 'Voces del Cañón', id_espectador: 35, autor_alias: 'Juan R.', compra_verificada: false,
    calificacion: 5,
    texto: 'Un documental necesario. Debería verse en los colegios.',
    fecha: dia(-12, '11:00'), canal: 'WEB', votos_utiles: 1, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 6, pelicula_titulo: 'Corazones en Bogotá', id_espectador: 39, autor_alias: 'Lina V.', compra_verificada: false, id_funcion: 3,
    calificacion: 4, titulo: 'Bonita',
    texto: 'Romántica y con buen humor. Los subtítulos se descuadraron al principio, pero luego los arreglaron.',
    fecha: dia(-13, '21:00'), canal: 'APP', votos_utiles: 0, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 3, pelicula_titulo: 'Cumbia de Medianoche', id_espectador: 40, autor_alias: 'Valentina C.', compra_verificada: false, id_funcion: 14,
    calificacion: 5, titulo: '¡Me encantó!',
    texto: 'Fuimos cinco amigas y salimos bailando. Recomendadísima.',
    fecha: dia(-2, '20:45'), canal: 'APP', votos_utiles: 1, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 12, pelicula_titulo: 'Noches de Salsa', id_espectador: 27, autor_alias: 'Carolina L.', compra_verificada: false, id_funcion: 9,
    calificacion: 4, titulo: 'El conversatorio estuvo genial',
    texto: 'Ver la película y después escuchar al director y a Tatiana Arias fue muy chévere.',
    fecha: dia(-7, '23:00'), canal: 'WEB', votos_utiles: 2, estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  { id_pelicula: 7, pelicula_titulo: 'Operación Cóndor Andino', id_espectador: 1, autor_alias: 'Gabriela P.', compra_verificada: false,
    calificacion: 1, titulo: 'Pésima',
    texto: 'Una basura de película, los actores son unos ***** y el director no sabe lo que hace.',
    fecha: dia(-6, '02:10'), canal: 'APP', votos_utiles: 0, estado_moderacion: 'OCULTA', motivo_moderacion: 'Lenguaje ofensivo contra personas', esquema_version: 1 },
  { id_pelicula: 9, pelicula_titulo: 'Mi Amigo el Dragón', id_espectador: 26, autor_alias: 'Juan C.', compra_verificada: false,
    calificacion: 5, titulo: '¡Excelente!',
    texto: 'Excelente película. Más reseñas y concursos en mi canal, búsquenme como juancine en redes.',
    fecha: dia(-3, '16:20'), canal: 'WEB', votos_utiles: 0, estado_moderacion: 'EN_REVISION', motivo_moderacion: 'Posible publicidad (spam)', esquema_version: 1 }
];


// ─────────────────────────────────────────────────────────────────────────────
// reportes_incidentes: fallas técnicas, quejas de servicio e incidentes de seguridad
// ─────────────────────────────────────────────────────────────────────────────
const staff = (id_staff) => ({ rol: 'STAFF', id_staff });
const espectador = (id_espectador) => ({ rol: 'ESPECTADOR', id_espectador });
const paso = (fecha, estado, id_staff, nota) => ({ fecha, estado, id_staff, nota });

const reportes = [
  { codigo: 'INC-0001', tipo: 'FALLA_TECNICA', id_sede: 2, id_sala: 6, fecha_reporte: dia(-30, '10:20'), fecha_cierre: dia(-28, '17:00'),
    prioridad: 'BAJA', estado: 'CERRADO', descripcion: 'En la revisión semanal aparecieron 35 pares de gafas 3D rayados o con las patas rotas.',
    reportado_por: staff(10), asignado_a: 7,
    falla: { equipo: 'SISTEMA_3D', marca_modelo: 'Gafas Dolby 3D', afecta_funcion: false, repuestos: [{ item: 'Gafas Dolby 3D', cantidad: 40, costo: pesos('3200000.00') }] },
    seguimiento: [paso(dia(-30, '10:20'), 'ABIERTO', 10, 'Se retiran las gafas dañadas del inventario.'),
                  paso(dia(-29, '09:00'), 'EN_PROCESO', 7, 'Pedido de 40 pares al proveedor.'),
                  paso(dia(-28, '17:00'), 'CERRADO', 7, 'Llegaron las gafas nuevas; inventario completo.')],
    esquema_version: 1 },
  { codigo: 'INC-0002', tipo: 'FALLA_TECNICA', id_sede: 2, id_sala: 5, fecha_reporte: dia(-25, '16:45'), fecha_cierre: dia(-22, '12:00'),
    prioridad: 'MEDIA', estado: 'CERRADO', descripcion: 'Goteras en el techo de la sala después del aguacero; cuatro butacas de la fila F quedaron mojadas.',
    reportado_por: staff(11), asignado_a: 7,
    falla: { equipo: 'INFRAESTRUCTURA', afecta_funcion: false },
    seguimiento: [paso(dia(-25, '16:45'), 'ABIERTO', 11, 'Se bloquean las butacas F7 a F10.'),
                  paso(dia(-24, '08:00'), 'EN_PROCESO', 7, 'Contratista impermeabiliza la cubierta.'),
                  paso(dia(-22, '12:00'), 'CERRADO', 7, 'Cubierta reparada y butacas secas.')],
    evidencias: [{ tipo: 'FOTO', archivo: 'usaquen_sala1_goteras.jpg' }],
    esquema_version: 1 },
  { codigo: 'INC-0003', tipo: 'FALLA_TECNICA', id_sede: 2, fecha_reporte: dia(-20, '11:05'), fecha_cierre: dia(-20, '13:10'),
    prioridad: 'MEDIA', estado: 'RESUELTO', descripcion: 'El datáfono de la taquilla perdió conexión; durante dos horas solo se recibió efectivo.',
    reportado_por: staff(8), asignado_a: 7,
    falla: { equipo: 'TAQUILLA_POS', codigo_error: 'E-102 sin conexión', afecta_funcion: false, minutos_fuera_servicio: 125 },
    seguimiento: [paso(dia(-20, '11:05'), 'ABIERTO', 8, 'Se avisa en la fila que solo se recibe efectivo.'),
                  paso(dia(-20, '13:10'), 'RESUELTO', 7, 'El proveedor cambió el módem del datáfono.')],
    esquema_version: 1 },
  { codigo: 'INC-0004', tipo: 'INCIDENTE_SEGURIDAD', id_sede: 1, id_sala: 4, fecha_reporte: dia(-20, '15:30'), fecha_cierre: dia(-20, '16:40'),
    prioridad: 'ALTA', estado: 'CERRADO', descripcion: 'Se activó la alarma de humo de la sala 4 por un sensor defectuoso y se evacuó la sala de forma preventiva.',
    reportado_por: staff(1), asignado_a: 1,
    seguridad: { categoria: 'EVACUACION', nivel: 'ALTO', personas_involucradas: 38, autoridades_notificadas: true, entidad: 'Bomberos de Bogotá',
                 acciones: ['Evacuación de la sala en 4 minutos', 'Revisión del sensor con bomberos', 'Reanudación de la función a las 16:05'] },
    seguimiento: [paso(dia(-20, '15:30'), 'ABIERTO', 1, 'Evacuación preventiva de la sala 4.'),
                  paso(dia(-20, '16:40'), 'CERRADO', 1, 'Bomberos confirma falsa alarma; se cambia el sensor.')],
    esquema_version: 1 },
  { codigo: 'INC-0005', tipo: 'FALLA_TECNICA', id_sede: 3, id_sala: 8, id_funcion: 1, fecha_reporte: dia(-15, '19:40'), fecha_cierre: dia(-15, '20:05'),
    prioridad: 'MEDIA', estado: 'RESUELTO', descripcion: 'Se perdió el audio del canal central (los diálogos) durante 8 minutos. Se reinició el procesador.',
    reportado_por: staff(15), asignado_a: 15,
    falla: { equipo: 'SONIDO', marca_modelo: 'Dolby CP950A', codigo_error: 'Canal C sin señal', afecta_funcion: true, minutos_fuera_servicio: 8 },
    seguimiento: [paso(dia(-15, '19:40'), 'ABIERTO', 15, 'Sin diálogos en la sala.'),
                  paso(dia(-15, '20:05'), 'RESUELTO', 15, 'Procesador reiniciado; se programa revisión del amplificador.')],
    esquema_version: 1 },
  { codigo: 'INC-0006', tipo: 'QUEJA_SERVICIO', id_sede: 3, id_sala: 8, id_funcion: 1, fecha_reporte: dia(-15, '21:20'), fecha_cierre: dia(-14, '10:15'),
    prioridad: 'MEDIA', estado: 'CERRADO', descripcion: 'La espectadora reporta que la función se quedó sin sonido varios minutos y nadie dio explicación.',
    reportado_por: espectador(4), asignado_a: 12,
    queja: { categoria: 'PROYECCION', canal: 'WEB', id_espectador: 4, id_venta: 5, compensacion: { tipo: 'BONO', valor: pesos('16000.00') } },
    relacionado_con: ['INC-0005'],
    seguimiento: [paso(dia(-15, '21:20'), 'ABIERTO', 12, 'Queja recibida por la web.'),
                  paso(dia(-14, '10:15'), 'CERRADO', 12, 'Se envía bono por una boleta 2D y se responde la reseña.')],
    esquema_version: 1 },
  { codigo: 'INC-0007', tipo: 'INCIDENTE_SEGURIDAD', id_sede: 1, id_sala: 1, id_funcion: 2, fecha_reporte: dia(-14, '18:40'), fecha_cierre: dia(-14, '18:55'),
    prioridad: 'MEDIA', estado: 'CERRADO', descripcion: 'Un espectador grababa la película con el celular. Se le pidió borrar el video.',
    reportado_por: staff(6), asignado_a: 1,
    seguridad: { categoria: 'GRABACION_ILEGAL', nivel: 'BAJO', personas_involucradas: 1, autoridades_notificadas: false,
                 acciones: ['Borrado del video frente al personal', 'Advertencia verbal'] },
    seguimiento: [paso(dia(-14, '18:40'), 'ABIERTO', 6, 'Se avisa al supervisor.'),
                  paso(dia(-14, '18:55'), 'CERRADO', 1, 'Video borrado; el espectador continúa en la función.')],
    esquema_version: 1 },
  { codigo: 'INC-0008', tipo: 'QUEJA_SERVICIO', id_sede: 2, id_sala: 5, id_funcion: 3, fecha_reporte: dia(-13, '18:05'), fecha_cierre: dia(-13, '18:20'),
    prioridad: 'BAJA', estado: 'RESUELTO', descripcion: 'Los subtítulos aparecían un par de segundos antes que los diálogos.',
    reportado_por: espectador(31), asignado_a: 10,
    queja: { categoria: 'PROYECCION', canal: 'TAQUILLA', id_espectador: 31, id_venta: 3 },
    seguimiento: [paso(dia(-13, '18:05'), 'ABIERTO', 9, 'El espectador sale a avisar en taquilla.'),
                  paso(dia(-13, '18:20'), 'RESUELTO', 10, 'El proyeccionista ajustó el desfase del subtítulo en el servidor.')],
    esquema_version: 1 },
  { codigo: 'INC-0009', tipo: 'FALLA_TECNICA', id_sede: 1, id_sala: 2, id_funcion: 4, fecha_reporte: dia(-12, '15:20'), fecha_cierre: dia(-12, '15:50'),
    prioridad: 'MEDIA', estado: 'RESUELTO', descripcion: 'El servidor de contenido de la sala no tenía espacio para terminar la ingesta del DCP.',
    reportado_por: staff(5), asignado_a: 5,
    falla: { equipo: 'SERVIDOR_CONTENIDO', marca_modelo: 'Dolby IMS3000', codigo_error: 'Disco al 98 %', afecta_funcion: false },
    seguimiento: [paso(dia(-12, '15:20'), 'ABIERTO', 5, 'La ingesta se detiene al 80 %.'),
                  paso(dia(-12, '15:50'), 'RESUELTO', 5, 'Se borran dos DCP retirados de cartelera y termina la ingesta.')],
    esquema_version: 1 },
  { codigo: 'INC-0010', tipo: 'QUEJA_SERVICIO', id_sede: 1, fecha_reporte: dia(-12, '17:40'), fecha_cierre: dia(-12, '18:00'),
    prioridad: 'BAJA', estado: 'RESUELTO', descripcion: 'Le cobraron dos veces el combo de crispetas en la confitería.',
    reportado_por: espectador(37), asignado_a: 1,
    queja: { categoria: 'CONFITERIA', canal: 'TAQUILLA', id_espectador: 37, compensacion: { tipo: 'REEMBOLSO', valor: pesos('18500.00') } },
    seguimiento: [paso(dia(-12, '17:40'), 'ABIERTO', 2, 'Se revisa el cierre del datáfono.'),
                  paso(dia(-12, '18:00'), 'RESUELTO', 1, 'Se reversa el cobro duplicado.')],
    esquema_version: 1 },
  { codigo: 'INC-0011', tipo: 'FALLA_TECNICA', id_sede: 1, id_sala: 3, id_funcion: 5, fecha_reporte: dia(-11, '18:30'), fecha_cierre: dia(-11, '19:10'),
    prioridad: 'ALTA', estado: 'RESUELTO', descripcion: 'Alerta de temperatura alta en el proyector una hora antes de la función. Se limpiaron los filtros y la temperatura bajó.',
    reportado_por: staff(5), asignado_a: 5,
    falla: { equipo: 'PROYECTOR', marca_modelo: 'Christie CP4440-RGB', codigo_error: 'TEMP-WARN 0x31', afecta_funcion: false },
    seguimiento: [paso(dia(-11, '18:30'), 'ABIERTO', 5, 'Alerta en el panel del proyector.'),
                  paso(dia(-11, '19:10'), 'RESUELTO', 5, 'Filtros limpios; temperatura normal antes de abrir la sala.')],
    esquema_version: 1 },
  { codigo: 'INC-0012', tipo: 'QUEJA_SERVICIO', id_sede: 1, id_sala: 1, id_funcion: 6, fecha_reporte: dia(-10, '21:10'), fecha_cierre: dia(-9, '11:00'),
    prioridad: 'BAJA', estado: 'CERRADO', descripcion: 'Un grupo habló y usó el celular durante toda la película y nadie del personal intervino.',
    reportado_por: espectador(21), asignado_a: 1,
    queja: { categoria: 'COMPORTAMIENTO_PUBLICO', canal: 'WEB', id_espectador: 21, id_venta: 11 },
    relacionado_con: ['INC-0013'],
    seguimiento: [paso(dia(-10, '21:10'), 'ABIERTO', 1, 'Queja recibida por la web.'),
                  paso(dia(-9, '11:00'), 'CERRADO', 1, 'Se refuerza la ronda del personal de sala en funciones de la noche.')],
    esquema_version: 1 },
  { codigo: 'INC-0013', tipo: 'INCIDENTE_SEGURIDAD', id_sede: 1, id_sala: 1, id_funcion: 6, fecha_reporte: dia(-10, '21:35'), fecha_cierre: dia(-10, '21:50'),
    prioridad: 'ALTA', estado: 'CERRADO', descripcion: 'Dos espectadores discutieron por los puestos y empezaron a empujarse. Se pausó la función mientras seguridad los separaba.',
    reportado_por: staff(1), asignado_a: 1,
    seguridad: { categoria: 'RIÑA', nivel: 'MEDIO', personas_involucradas: 2, autoridades_notificadas: false,
                 acciones: ['Pausa de la proyección (9 minutos)', 'Reubicación de uno de los espectadores'] },
    relacionado_con: ['INC-0012'],
    seguimiento: [paso(dia(-10, '21:35'), 'ABIERTO', 4, 'Aviso por radio desde la sala 1.'),
                  paso(dia(-10, '21:50'), 'CERRADO', 1, 'Situación controlada; se reanuda la función.')],
    esquema_version: 1 },
  { codigo: 'INC-0014', tipo: 'FALLA_TECNICA', id_sede: 1, id_sala: 1, id_funcion: 6, fecha_reporte: dia(-10, '22:30'), fecha_cierre: dia(-9, '12:00'),
    prioridad: 'MEDIA', estado: 'RESUELTO', descripcion: 'El subwoofer distorsiona en las escenas de explosiones.',
    reportado_por: staff(5), asignado_a: 5,
    falla: { equipo: 'SONIDO', marca_modelo: 'Subwoofer 18"', afecta_funcion: true, repuestos: [{ item: 'Cono de subwoofer de 18"', cantidad: 1, costo: pesos('1250000.00') }] },
    seguimiento: [paso(dia(-10, '22:30'), 'ABIERTO', 5, 'Distorsión en frecuencias bajas.'),
                  paso(dia(-9, '12:00'), 'RESUELTO', 5, 'Cono cambiado y sistema calibrado.')],
    esquema_version: 1 },
  { codigo: 'INC-0015', tipo: 'QUEJA_SERVICIO', id_sede: 1, id_sala: 2, id_funcion: 7, fecha_reporte: dia(-9, '18:20'), fecha_cierre: dia(-8, '09:30'),
    prioridad: 'BAJA', estado: 'CERRADO', descripcion: 'Hubo una fila de 25 minutos porque solo había una taquilla abierta.',
    reportado_por: espectador(5), asignado_a: 1,
    queja: { categoria: 'TIEMPO_ESPERA', canal: 'WEB', id_espectador: 5, id_venta: 17 },
    seguimiento: [paso(dia(-9, '18:20'), 'ABIERTO', 1, 'Queja recibida por la web.'),
                  paso(dia(-8, '09:30'), 'CERRADO', 1, 'Se ajusta el turno: dos taquillas abiertas desde las 17:00 los viernes.')],
    esquema_version: 1 },
  { codigo: 'INC-0016', tipo: 'FALLA_TECNICA', id_sede: 1, id_sala: 4, id_funcion: 8, fecha_reporte: dia(-8, '21:25'), fecha_cierre: dia(-7, '16:00'),
    prioridad: 'ALTA', estado: 'RESUELTO', descripcion: 'Seis butacas de la fila C no se movieron durante la función 4D. Falló el actuador del bloque C.',
    reportado_por: staff(5), asignado_a: 5,
    falla: { equipo: 'BUTACAS_4D', codigo_error: 'ACT-C03 sin respuesta', afecta_funcion: true, minutos_fuera_servicio: 132,
             repuestos: [{ item: 'Actuador eléctrico lineal', cantidad: 2, costo: pesos('2900000.00') }] },
    seguimiento: [paso(dia(-8, '21:25'), 'ABIERTO', 5, 'Fila C sin movimiento.'),
                  paso(dia(-8, '23:30'), 'EN_PROCESO', 5, 'Diagnóstico: actuador del bloque C.'),
                  paso(dia(-7, '16:00'), 'RESUELTO', 5, 'Actuadores cambiados; prueba completa con el archivo de efectos.')],
    esquema_version: 1 },
  { codigo: 'INC-0017', tipo: 'QUEJA_SERVICIO', id_sede: 1, id_sala: 4, id_funcion: 8, fecha_reporte: dia(-8, '23:10'), fecha_cierre: dia(-7, '10:05'),
    prioridad: 'MEDIA', estado: 'CERRADO', descripcion: 'El espectador pagó 4D y su butaca no se movió en toda la función.',
    reportado_por: espectador(20), asignado_a: 1,
    queja: { categoria: 'PROYECCION', canal: 'WEB', id_espectador: 20, id_venta: 12, compensacion: { tipo: 'BONO', valor: pesos('28000.00') } },
    relacionado_con: ['INC-0016'],
    seguimiento: [paso(dia(-8, '23:10'), 'ABIERTO', 1, 'Queja recibida por la web.'),
                  paso(dia(-7, '10:05'), 'CERRADO', 1, 'Se envía bono por una boleta 4D.')],
    esquema_version: 1 },
  { codigo: 'INC-0018', tipo: 'INCIDENTE_SEGURIDAD', id_sede: 2, id_sala: 5, id_funcion: 9, fecha_reporte: dia(-7, '20:40'), fecha_cierre: dia(-7, '20:52'),
    prioridad: 'ALTA', estado: 'CERRADO', descripcion: 'Un niño de unos siete años se separó de su acompañante en el lobby. Se reunió con su familia en 12 minutos.',
    reportado_por: staff(9), asignado_a: 7,
    seguridad: { categoria: 'MENOR_EXTRAVIADO', nivel: 'MEDIO', personas_involucradas: 1, autoridades_notificadas: false,
                 acciones: ['Alerta por radio', 'Cierre temporal de la salida principal', 'Entrega al acompañante verificando identidad'] },
    seguimiento: [paso(dia(-7, '20:40'), 'ABIERTO', 9, 'Se activa el protocolo de menor extraviado.'),
                  paso(dia(-7, '20:52'), 'CERRADO', 7, 'Menor entregado a su acompañante.')],
    esquema_version: 1 },
  { codigo: 'INC-0019', tipo: 'FALLA_TECNICA', id_sede: 3, id_sala: 10, fecha_reporte: dia(-6, '12:10'),
    prioridad: 'ALTA', estado: 'EN_PROCESO', descripcion: 'La pantalla de la sala 3 se rasgó (40 cm) y el aire acondicionado no enciende. La sala queda en mantenimiento.',
    reportado_por: staff(15), asignado_a: 12,
    falla: { equipo: 'PANTALLA', afecta_funcion: false, repuestos: [{ item: 'Lona de pantalla microperforada 9 x 4 m', cantidad: 1, costo: pesos('12800000.00') }] },
    seguimiento: [paso(dia(-6, '12:10'), 'ABIERTO', 15, 'Se cierra la sala; en PostgreSQL queda en MANTENIMIENTO.'),
                  paso(dia(-4, '10:00'), 'EN_PROCESO', 12, 'El proveedor entrega la lona en dos semanas.')],
    evidencias: [{ tipo: 'FOTO', archivo: 'kennedy_sala3_pantalla.jpg' }, { tipo: 'DOCUMENTO', archivo: 'cotizacion_lona_pantalla.pdf' }],
    esquema_version: 1 },
  { codigo: 'INC-0020', tipo: 'QUEJA_SERVICIO', id_sede: 2, fecha_reporte: dia(-6, '19:00'), fecha_cierre: dia(-5, '09:00'),
    prioridad: 'BAJA', estado: 'CERRADO', descripcion: 'Los baños del segundo piso estaban sin papel y sucios en el cambio de función.',
    reportado_por: { rol: 'ANONIMO' }, asignado_a: 11,
    queja: { categoria: 'LIMPIEZA', canal: 'BUZON' },
    seguimiento: [paso(dia(-6, '19:00'), 'ABIERTO', 11, 'Nota encontrada en el buzón de sugerencias.'),
                  paso(dia(-5, '09:00'), 'CERRADO', 11, 'Se agrega una ronda de limpieza entre funciones.')],
    esquema_version: 1 },
  { codigo: 'INC-0021', tipo: 'FALLA_TECNICA', id_sede: 2, id_sala: 7, id_funcion: 11, fecha_reporte: dia(-5, '15:40'), fecha_cierre: dia(-5, '16:30'),
    prioridad: 'MEDIA', estado: 'RESUELTO', descripcion: 'La sala llegó a 28 °C porque el aire acondicionado no enfriaba.',
    reportado_por: staff(11), asignado_a: 7,
    falla: { equipo: 'CLIMATIZACION', afecta_funcion: true, minutos_fuera_servicio: 40 },
    seguimiento: [paso(dia(-5, '15:40'), 'ABIERTO', 11, 'Espectadores se quejan del calor.'),
                  paso(dia(-5, '16:30'), 'RESUELTO', 7, 'Técnico recarga el gas del equipo.')],
    esquema_version: 1 },
  { codigo: 'INC-0022', tipo: 'INCIDENTE_SEGURIDAD', id_sede: 3, fecha_reporte: dia(-5, '21:15'),
    prioridad: 'MEDIA', estado: 'EN_PROCESO', descripcion: 'Una espectadora denuncia el hurto de su celular en la fila de la confitería.',
    reportado_por: staff(12), asignado_a: 12,
    seguridad: { categoria: 'HURTO', nivel: 'MEDIO', personas_involucradas: 1, autoridades_notificadas: true, entidad: 'Policía Nacional (CAI Kennedy)',
                 acciones: ['Revisión de cámaras', 'Copia del video entregada a la Policía'] },
    seguimiento: [paso(dia(-5, '21:15'), 'ABIERTO', 12, 'Se toma el reporte y se revisan cámaras.'),
                  paso(dia(-4, '09:30'), 'EN_PROCESO', 12, 'La Policía recibe el video; caso en investigación.')],
    esquema_version: 1 },
  { codigo: 'INC-0023', tipo: 'FALLA_TECNICA', id_sede: 3, id_sala: 8, id_funcion: 12, fecha_reporte: dia(-4, '17:10'), fecha_cierre: dia(-4, '17:15'),
    prioridad: 'BAJA', estado: 'RESUELTO', descripcion: 'En el conversatorio un micrófono inalámbrico se quedó sin batería; hubo una pausa de 5 minutos.',
    reportado_por: staff(15), asignado_a: 15,
    falla: { equipo: 'SONIDO', marca_modelo: 'Micrófono inalámbrico de mano', afecta_funcion: true, minutos_fuera_servicio: 5 },
    seguimiento: [paso(dia(-4, '17:10'), 'ABIERTO', 15, 'Micrófono sin señal.'),
                  paso(dia(-4, '17:15'), 'RESUELTO', 15, 'Baterías cambiadas.')],
    esquema_version: 1 },
  { codigo: 'INC-0024', tipo: 'FALLA_TECNICA', id_sede: 3, id_sala: 9, id_funcion: 13, fecha_reporte: dia(-3, '20:40'), fecha_cierre: dia(-2, '15:00'),
    prioridad: 'ALTA', estado: 'RESUELTO', descripcion: 'El emisor que sincroniza las gafas 3D activas falla de forma intermitente y el público ve la imagen doble.',
    reportado_por: staff(15), asignado_a: 15,
    falla: { equipo: 'SISTEMA_3D', marca_modelo: 'Emisor IR XpanD', codigo_error: 'SYNC-LOST', afecta_funcion: true, minutos_fuera_servicio: 25,
             repuestos: [{ item: 'Emisor IR de sincronización 3D', cantidad: 1, costo: pesos('2300000.00') }] },
    seguimiento: [paso(dia(-3, '20:40'), 'ABIERTO', 15, 'Imagen doble en la sala 2.'),
                  paso(dia(-3, '22:30'), 'EN_PROCESO', 15, 'Se pide un emisor nuevo.'),
                  paso(dia(-2, '15:00'), 'RESUELTO', 15, 'Emisor reemplazado y probado con 20 gafas.')],
    esquema_version: 1 },
  { codigo: 'INC-0025', tipo: 'QUEJA_SERVICIO', id_sede: 3, id_sala: 9, id_funcion: 13, fecha_reporte: dia(-3, '22:35'), fecha_cierre: dia(-2, '11:20'),
    prioridad: 'MEDIA', estado: 'CERRADO', descripcion: 'Imagen doble en 3D durante la segunda mitad de la película; el espectador salió con dolor de cabeza.',
    reportado_por: espectador(11), asignado_a: 12,
    queja: { categoria: 'PROYECCION', canal: 'WEB', id_espectador: 11, id_venta: 48, compensacion: { tipo: 'BONO', valor: pesos('21000.00') } },
    relacionado_con: ['INC-0024'],
    seguimiento: [paso(dia(-3, '22:35'), 'ABIERTO', 12, 'Queja recibida por la web.'),
                  paso(dia(-2, '11:20'), 'CERRADO', 12, 'Se envía bono por una boleta 3D.')],
    esquema_version: 1 },
  { codigo: 'INC-0026', tipo: 'QUEJA_SERVICIO', id_sede: 1, id_sala: 1, id_funcion: 15, fecha_reporte: dia(-2, '21:05'), fecha_cierre: dia(-1, '10:00'),
    prioridad: 'BAJA', estado: 'RESUELTO', descripcion: 'No le permitieron entrar con su hijo de 14 años a una película clasificada para mayores de 18.',
    reportado_por: espectador(19), asignado_a: 1,
    queja: { categoria: 'POLITICA_EDAD', canal: 'TELEFONO', id_espectador: 19 },
    seguimiento: [paso(dia(-2, '21:05'), 'ABIERTO', 3, 'Llamada recibida en taquilla.'),
                  paso(dia(-1, '10:00'), 'RESUELTO', 1, 'Se explica que la clasificación es 18 años y que la venta la valida (edad_minima en PostgreSQL).')],
    esquema_version: 1 },
  { codigo: 'INC-0027', tipo: 'INCIDENTE_SEGURIDAD', id_sede: 1, id_sala: 1, id_funcion: 15, fecha_reporte: dia(-2, '22:15'), fecha_cierre: dia(-2, '23:30'),
    prioridad: 'CRITICA', estado: 'CERRADO', descripcion: 'Un espectador se desmayó durante la función. Se detuvo la proyección 12 minutos mientras lo atendía la brigada.',
    reportado_por: staff(1), asignado_a: 1,
    seguridad: { categoria: 'EMERGENCIA_MEDICA', nivel: 'ALTO', personas_involucradas: 1, autoridades_notificadas: true, entidad: 'Línea 123',
                 acciones: ['Pausa de la proyección', 'Primeros auxilios de la brigada', 'Traslado en ambulancia'] },
    seguimiento: [paso(dia(-2, '22:15'), 'ABIERTO', 1, 'Se detiene la proyección y se llama a la Línea 123.'),
                  paso(dia(-2, '23:30'), 'CERRADO', 1, 'Espectador trasladado; la función terminó con normalidad.')],
    esquema_version: 1 },
  { codigo: 'INC-0028', tipo: 'QUEJA_SERVICIO', id_sede: 3, id_sala: 9, id_funcion: 29, fecha_reporte: dia(-1, '09:15'),
    prioridad: 'BAJA', estado: 'ABIERTO', descripcion: 'Pregunta si el conversatorio cancelado de El Último Faro se va a reprogramar.',
    reportado_por: espectador(21), asignado_a: 12,
    queja: { categoria: 'PROGRAMACION', canal: 'REDES_SOCIALES', id_espectador: 21, id_venta: 21 },
    seguimiento: [paso(dia(-1, '09:15'), 'ABIERTO', 12, 'Mensaje recibido por redes sociales.')],
    esquema_version: 1 },
  { codigo: 'INC-0029', tipo: 'INCIDENTE_SEGURIDAD', id_sede: 1, fecha_reporte: dia(-1, '10:50'), fecha_cierre: dia(-1, '11:55'),
    prioridad: 'CRITICA', estado: 'CERRADO', descripcion: 'Apareció un morral abandonado en el lobby. Se acordonó la zona y la Policía confirmó que no era peligroso.',
    reportado_por: staff(6), asignado_a: 1,
    seguridad: { categoria: 'OBJETO_SOSPECHOSO', nivel: 'ALTO', personas_involucradas: 0, autoridades_notificadas: true, entidad: 'Policía Nacional (grupo antiexplosivos)',
                 acciones: ['Acordonamiento del lobby', 'Apertura de taquillas 20 minutos tarde'] },
    seguimiento: [paso(dia(-1, '10:50'), 'ABIERTO', 6, 'Se aleja al público del morral.'),
                  paso(dia(-1, '11:55'), 'CERRADO', 1, 'Morral revisado y entregado a objetos perdidos.')],
    esquema_version: 1 },
  { codigo: 'INC-0030', tipo: 'QUEJA_SERVICIO', id_sede: 3, id_sala: 9, id_funcion: 29, fecha_reporte: dia(-1, '11:40'),
    prioridad: 'MEDIA', estado: 'EN_PROCESO', descripcion: 'El reembolso de la compra web del conversatorio cancelado todavía no aparece en la tarjeta.',
    reportado_por: espectador(31), asignado_a: 12,
    queja: { categoria: 'REEMBOLSO', canal: 'WEB', id_espectador: 31, id_venta: 43 },
    seguimiento: [paso(dia(-1, '11:40'), 'ABIERTO', 12, 'Queja recibida por la web.'),
                  paso(dia(-1, '15:00'), 'EN_PROCESO', 12, 'La venta está REEMBOLSADA en PostgreSQL; se pide soporte a la pasarela de pagos.')],
    esquema_version: 1 },
  { codigo: 'INC-0031', tipo: 'FALLA_TECNICA', id_sede: 1, id_sala: 3, id_funcion: 16, fecha_reporte: dia(-1, '19:10'),
    prioridad: 'CRITICA', estado: 'EN_PROCESO', descripcion: 'El proyector de la sala 3 no enciende por un error del módulo láser. Se canceló la función de las 20:00 y se reembolsaron las boletas.',
    reportado_por: staff(5), asignado_a: 1,
    falla: { equipo: 'PROYECTOR', marca_modelo: 'Christie CP4440-RGB', codigo_error: 'LMP-2F', afecta_funcion: true,
             repuestos: [{ item: 'Módulo láser RGB', cantidad: 1, costo: pesos('38500000.00') }] },
    seguimiento: [paso(dia(-1, '19:10'), 'ABIERTO', 5, 'El proyector no pasa la prueba de encendido.'),
                  paso(dia(-1, '19:25'), 'EN_PROCESO', 1, 'Se cancela la función 16 en PostgreSQL (sp_cancelar_funcion) y se reembolsan las ventas.')],
    esquema_version: 1 },
  { codigo: 'INC-0032', tipo: 'QUEJA_SERVICIO', id_sede: 1, id_sala: 3, id_funcion: 16, fecha_reporte: dia(-1, '21:00'), fecha_cierre: dia(-1, '22:00'),
    prioridad: 'MEDIA', estado: 'RESUELTO', descripcion: 'Por la cancelación, el reembolso en taquilla tardó 40 minutos.',
    reportado_por: espectador(17), asignado_a: 1,
    queja: { categoria: 'REEMBOLSO', canal: 'TAQUILLA', id_espectador: 17, id_venta: 51, compensacion: { tipo: 'BONO', valor: pesos('17000.00') } },
    relacionado_con: ['INC-0031'],
    seguimiento: [paso(dia(-1, '21:00'), 'ABIERTO', 2, 'Queja en taquilla.'),
                  paso(dia(-1, '22:00'), 'RESUELTO', 1, 'Se entrega bono por una boleta 3D.')],
    esquema_version: 1 },
  { codigo: 'INC-0033', tipo: 'QUEJA_SERVICIO', id_sede: 1, id_sala: 3, id_funcion: 16, fecha_reporte: dia(-1, '22:30'),
    prioridad: 'MEDIA', estado: 'EN_PROCESO', descripcion: 'La espectadora se enteró de la cancelación en la puerta de la sala; no le llegó aviso al correo.',
    reportado_por: espectador(27), asignado_a: 1,
    queja: { categoria: 'COMUNICACION', canal: 'WEB', id_espectador: 27, id_venta: 57, compensacion: { tipo: 'CORTESIA', valor: pesos('18000.00') } },
    relacionado_con: ['INC-0031'],
    seguimiento: [paso(dia(-1, '22:30'), 'ABIERTO', 1, 'Queja recibida por la web.'),
                  paso(dia(-1, '23:10'), 'EN_PROCESO', 1, 'Se revisa por qué no salió el correo de cancelación.')],
    esquema_version: 1 },
  { codigo: 'INC-0034', tipo: 'FALLA_TECNICA', id_sede: 1, id_sala: 3, id_funcion: 30, fecha_reporte: haceHoras(6),
    prioridad: 'ALTA', estado: 'ABIERTO', descripcion: 'En la página web el mapa de asientos del preestreno de Eclipse Final no deja seleccionar puestos.',
    reportado_por: staff(2), asignado_a: 1,
    falla: { equipo: 'VENTA_WEB', codigo_error: 'HTTP 500 en /funciones/30/asientos', afecta_funcion: false },
    seguimiento: [paso(haceHoras(6), 'ABIERTO', 2, 'Varios clientes llaman a taquilla porque no pueden comprar.')],
    esquema_version: 1 },
  { codigo: 'INC-0035', tipo: 'INCIDENTE_SEGURIDAD', id_sede: 2, id_sala: 6, fecha_reporte: haceHoras(2),
    prioridad: 'CRITICA', estado: 'ABIERTO', descripcion: 'La puerta de emergencia de la sala 2 está bloqueada con mobiliario que dejó un evento.',
    reportado_por: staff(11), asignado_a: 7,
    seguridad: { categoria: 'RIESGO_EVACUACION', nivel: 'ALTO', personas_involucradas: 0, autoridades_notificadas: false,
                 acciones: ['No se abre la sala hasta despejar la salida'] },
    seguimiento: [paso(haceHoras(2), 'ABIERTO', 11, 'Se avisa al supervisor antes de abrir la sala.')],
    esquema_version: 1 }
];


// ─────────────────────────────────────────────────────────────────────────────
// Carga
// ─────────────────────────────────────────────────────────────────────────────
const cargas = [
  ['fichas_tecnicas_peliculas', fichas],
  ['requisitos_proyeccion', requisitos],
  ['resenas_peliculas', resenas],
  ['reportes_incidentes', reportes]
];
cargas.forEach(([c, docs]) => db.getCollection(c).insertMany(docs));

function tabla(filas, columnas) {
  const texto = v => (v === undefined || v === null ? '' : String(v));
  const anchos = columnas.map(c => Math.max(c.length, ...filas.map(f => texto(f[c]).length)));
  const borde = (i, m, d) => i + anchos.map(a => '─'.repeat(a + 2)).join(m) + d;
  const fila = vals => '│' + vals.map((v, i) => ' ' + (typeof v === 'number' ? texto(v).padStart(anchos[i]) : texto(v).padEnd(anchos[i])) + ' ').join('│') + '│';
  print(borde('┌', '┬', '┐')); print(fila(columnas)); print(borde('├', '┼', '┤'));
  filas.forEach(f => print(fila(columnas.map(c => f[c]))));
  print(borde('└', '┴', '┘'));
}

const detalle = {
  fichas_tecnicas_peliculas: () => `${db.fichas_tecnicas_peliculas.countDocuments({ id_pelicula: { $type: 'int' } })} enlazadas a PostgreSQL, ` +
                                   `${db.fichas_tecnicas_peliculas.countDocuments({ id_pelicula: null })} en catálogo`,
  requisitos_proyeccion: () => `${db.requisitos_proyeccion.distinct('id_funcion').length} funciones especiales de 36`,
  resenas_peliculas: () => `${db.resenas_peliculas.countDocuments({ compra_verificada: true })} con compra verificada`,
  reportes_incidentes: () => [['FALLA_TECNICA', 'fallas técnicas'], ['QUEJA_SERVICIO', 'quejas'], ['INCIDENTE_SEGURIDAD', 'de seguridad']]
    .map(([t, nombre]) => `${db.reportes_incidentes.countDocuments({ tipo: t })} ${nombre}`).join(', ')
};
print(`Datos cargados en ${db.getName()} (fechas relativas al ${new Date(HOY).toISOString().slice(0, 10)})`);
tabla(cargas.map(([c]) => ({ coleccion: c, documentos: db.getCollection(c).countDocuments(), detalle: detalle[c]() })),
      ['coleccion', 'documentos', 'detalle']);


// ─────────────────────────────────────────────────────────────────────────────
// Pruebas de validación: todas deben ser rechazadas
// ─────────────────────────────────────────────────────────────────────────────
// Resume el detalle del error de validación (errInfo) en una línea
function motivo(e) {
  if (e.code === 11000) return `llave duplicada en ${Object.keys(e.keyValue || {}).join(' + ')}`;
  const regla = { bsonType: 'tipo no permitido', minimum: 'menor que el mínimo', maximum: 'mayor que el máximo', enum: 'valor no permitido', pattern: 'no cumple el patrón' };
  const hojas = (nodo, ruta) => {
    if (Array.isArray(nodo)) return nodo.flatMap(n => hojas(n, ruta));
    if (!nodo || typeof nodo !== 'object') return [];
    const r = nodo.propertyName ? [...ruta, nodo.propertyName] : ruta;
    if (nodo.operatorName === 'oneOf' && nodo.schemasNotSatisfied) {
      // La rama que corresponde al valor del discriminador es la que no falla por enum
      const ramas = nodo.schemasNotSatisfied.map(s => hojas(s.details, r));
      const propias = ramas.filter(h => !h.some(x => x.operador === 'enum'));
      return (propias.length ? propias : ramas).flat();
    }
    const hijos = nodo.schemaRulesNotSatisfied || nodo.propertiesNotSatisfied || nodo.schemasNotSatisfied || nodo.details;
    if (hijos) return hojas(hijos, r);
    return [{ campo: r.join('.'), operador: nodo.operatorName, valor: nodo.consideredValue, faltan: nodo.missingProperties }];
  };
  const textos = hojas(e.errInfo && e.errInfo.details, []).map(h => h.faltan
    ? `${h.campo ? h.campo + ': ' : ''}falta ${h.faltan.join(', ')}`
    : `${h.campo}: ${regla[h.operador] || h.operador} (${JSON.stringify(h.valor)})`);
  return textos.length ? [...new Set(textos)].slice(0, 2).join('; ') : e.message;
}

const base = {
  ficha: { id_pelicula: 3, estado_catalogo: 'PROGRAMADA', titulo: 'Prueba', anio: 2026, paises_produccion: ['CO'], generos: ['COMEDIA'],
           direccion: [{ nombre: 'Persona de prueba' }], versiones: [{ tipo: 'CINE', duracion_min: 100, formato_imagen: '2D' }],
           idiomas_audio: [audio('es', 'español')], subtitulos: [], clasificaciones: [CO(7)], esquema_version: 1, registrado_en: new Date() },
  resena: { id_pelicula: 5, pelicula_titulo: 'Galaxia Cero', id_espectador: 9, autor_alias: 'Prueba', compra_verificada: false,
            calificacion: 4, texto: 'Texto de prueba suficientemente largo.', fecha: new Date(), estado_moderacion: 'PUBLICADA', esquema_version: 1 },
  reporte: { codigo: 'INC-9999', tipo: 'QUEJA_SERVICIO', id_sede: 1, fecha_reporte: new Date(), prioridad: 'BAJA', estado: 'ABIERTO',
             descripcion: 'Reporte de prueba para validar.', reportado_por: { rol: 'ANONIMO' }, queja: { categoria: 'LIMPIEZA', canal: 'BUZON' },
             seguimiento: [paso(new Date(), 'ABIERTO', 1, 'Prueba')], esquema_version: 1 }
};
const sinCampo = (doc, campo) => { const copia = { ...doc }; delete copia[campo]; return copia; };

const pruebas = [
  ['Ficha PROGRAMADA sin id de PostgreSQL', 'fichas_tecnicas_peliculas', { ...base.ficha, id_pelicula: null }],
  ['Ficha con una versión de 30 minutos', 'fichas_tecnicas_peliculas', { ...base.ficha, versiones: [{ tipo: 'CINE', duracion_min: 30, formato_imagen: '2D' }] }],
  ['Requisito con una experiencia que no existe', 'requisitos_proyeccion', { ...requisitos[0], _id: undefined, id_funcion: 4, experiencias: ['HOLOGRAMA'] }],
  ['Verificación APROBADA sin quién la hizo', 'requisitos_proyeccion', { ...requisitos[0], _id: undefined, id_funcion: 4, verificacion: { estado: 'APROBADA' } }],
  ['Reseña con calificación 6', 'resenas_peliculas', { ...base.resena, calificacion: 6 }],
  ['Reseña verificada sin id_venta', 'resenas_peliculas', { ...base.resena, compra_verificada: true, id_funcion: 5 }],
  ['Queja sin el subdocumento queja', 'reportes_incidentes', sinCampo(base.reporte, 'queja')],
  ['Reporte CERRADO sin fecha de cierre', 'reportes_incidentes', { ...base.reporte, estado: 'CERRADO' }],
  ['Segunda reseña del mismo espectador a la misma película', 'resenas_peliculas', { ...base.resena, id_espectador: 36, id_pelicula: 5 }]
];

print('Pruebas que deben fallar:');
const antes = Object.fromEntries(COLECCIONES.map(c => [c, db.getCollection(c).countDocuments()]));
tabla(pruebas.map(([caso, c, doc], i) => {
  if (doc._id === undefined) delete doc._id;
  try {
    db.getCollection(c).insertOne(doc);
    return { n: i + 1, caso, resultado: 'ACEPTADA (revisar)', motivo: '' };
  } catch (e) {
    return { n: i + 1, caso, resultado: e.code === 11000 ? 'RECHAZADA (índice)' : 'RECHAZADA ($jsonSchema)', motivo: motivo(e) };
  }
}), ['n', 'caso', 'resultado', 'motivo']);
const intactas = COLECCIONES.every(c => db.getCollection(c).countDocuments() === antes[c]);
print(intactas ? 'Ninguna prueba insertó documentos: los conteos siguen iguales.' : 'ATENCIÓN: alguna prueba insertó documentos.');
