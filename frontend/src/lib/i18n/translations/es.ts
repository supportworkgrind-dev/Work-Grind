import type { Translations } from './en';

export const es: Translations = {
  dir: 'ltr',
  nav: { signIn: 'Iniciar sesión', getStarted: 'Empezar', openWorkspace: 'Abrir espacio', product: 'Producto', solutions: 'Soluciones', features: 'Características', ai: 'IA', security: 'Seguridad', backToHome: '← Volver al inicio' },
  footer: { tagline: 'Un espacio conectado para el trabajo personal, los negocios y la educación.', company: 'Empresa', security: 'Seguridad', about: 'Acerca de', features: 'Características', demo: 'Demo', contact: 'Contacto', privacy: 'Política de privacidad', terms: 'Términos de servicio', rights: '© {{year}} WorkGrind. Todos los derechos reservados.', trial: 'Elige un espacio Solo, Company, Escuela, Colegio o Universidad.' },
  common: { submit: 'Enviar', send: 'Enviar', cancel: 'Cancelar', loading: 'Cargando…', optional: 'opcional', required: 'requerido', errorGeneric: 'Algo salió mal. Por favor inténtalo de nuevo.', backToHome: 'Volver al inicio', startFreeTrial: 'Iniciar prueba gratuita', learnMore: 'Más información', close: 'Cerrar' },
  about: {
    badge: 'Acerca de WorkGrind', headline1: 'Un espacio conectado para', headline2: 'trabajar y aprender', headline3: '',
    subheadline: 'WorkGrind ofrece experiencias distintas para la productividad personal, la colaboración empresarial y la administración académica.',
    stats: { workspaces: 'Solo', messages: 'Company', tasks: 'Escuela / Academia', uptime: 'Colegio / Universidad' },
    story: { heading: 'Un espacio pensado para cada forma de trabajar', p1: 'Organizar el día personal, coordinar proyectos de una empresa y administrar una institución educativa requieren herramientas y permisos distintos.', p2: 'WorkGrind ofrece espacios Solo, Company, Escuela / Academia, Colegio y Universidad. Las funciones disponibles dependen del tipo de espacio, el rol y el plan.' },
    pillars: {
      sync:     { title: 'Trabajo conectado', desc: 'Tareas, proyectos, calendarios, conversaciones y registros compartidos compatibles en un mismo espacio.' },
      security: { title: 'Permisos del espacio', desc: 'El acceso depende de la membresía, el rol, las funciones disponibles y los datos solicitados.' },
      scale:    { title: 'Distintas formas de trabajar', desc: 'Elige un espacio personal, empresarial, escolar, universitario o de educación superior al registrarte.' },
    },
    workspace: { heading: 'Elige el espacio adecuado', subheading: 'El CRM y las herramientas para clientes son distintas de la administración académica.' },
    cta: { badge: 'Explora WorkGrind', name: 'Elige tu espacio', role: 'Compara los cinco tipos de espacio y elige el que se adapte a ti.', button: 'Empezar' },
  },
  features: {
    badge: 'Espacios y capacidades', headline: 'Las herramientas adecuadas para tu trabajo', subheadline: 'WorkGrind separa la productividad personal, las operaciones empresariales y la administración educativa, y conecta funciones útiles de colaboración.',
    cta: { heading: 'Elige cómo usar WorkGrind', sub: 'Selecciona Solo, Company, Escuela / Academia, Colegio o Universidad al registrarte.' },
    items: {
      chat:          { title: 'Comunicación del espacio de trabajo', tag: 'Chat y mensajes', desc: 'Usa los canales y mensajes directos disponibles para mantener las conversaciones vinculadas al trabajo compartido.' },
      tasks:         { title: 'Tareas y planificación', tag: 'Trabajo personal o en equipo', desc: 'Crea y organiza tareas, define prioridades y fechas, y consulta el progreso donde estén disponibles estas herramientas.' },
      projects:      { title: 'Proyectos', tag: 'Organización del trabajo', desc: 'Agrupa trabajos relacionados y consulta responsables, estado y fechas en los espacios compatibles.' },
      files:         { title: 'Archivos y documentos', tag: 'Función compartida', desc: 'Organiza archivos y documentos con acceso según el espacio y el rol. La disponibilidad depende de la cuenta y el plan.' },
      meetings:      { title: 'Reuniones y calendario', tag: 'Función compartida', desc: 'Programa reuniones y consulta elementos del calendario cuando estén habilitados para el espacio y el plan.' },
      ai:            { title: 'Tavro AI', tag: 'Asistencia con IA', desc: 'Obtén ayuda con consultas compatibles sobre trabajo y aprendizaje. La información y las acciones disponibles dependen de tu rol y plan.' },
      search:        { title: 'Búsqueda en el espacio', tag: 'Encontrar información', desc: 'Busca personas, tareas, mensajes, documentos y archivos compatibles dentro del espacio al que tienes acceso.' },
      notifications: { title: 'Notificaciones', tag: 'Actualizaciones', desc: 'Consulta avisos y actualizaciones de la actividad disponible para tu cuenta.' },
    },
  },
  demo: {
    badge: 'Conoce WorkGrind', headline: 'Solicita un recorrido por WorkGrind', subheadline: 'Cuéntanos qué espacio de WorkGrind te interesa y qué te gustaría conocer.',
    form: { name: 'Nombre completo', email: 'Correo electrónico', company: 'Empresa o institución (opcional)', message: '¿Qué te gustaría explorar?', namePH: 'ej. Ana García', emailPH: 'ana@example.com', companyPH: 'Nombre de la organización', messagePH: 'Indica el tipo de espacio y tus preguntas…', submit: 'Solicitar recorrido', submitting: 'Enviando…' },
    success: { heading: '¡Gracias! Pronto nos pondremos en contacto.', sub: 'Recibimos tu solicitud de demo para {{email}}. Nuestro equipo te contactará pronto.', home: 'Volver al inicio', another: 'Enviar otra solicitud' },
  },
  contact: {
    badge: 'Contacto', headline: 'Contacta con WorkGrind', sub: '¿Tienes preguntas sobre Solo, Company, Escuela / Academia, Colegio, Universidad, planes o soporte? Escríbenos.',
    form: { heading: 'Envíanos un mensaje', name: 'Tu nombre', email: 'Correo electrónico', company: 'Empresa o institución (opcional)', subject: 'Asunto', message: 'Mensaje', namePH: 'Tu nombre', emailPH: 'tu@example.com', companyPH: 'Nombre de la organización', messagePH: 'Indica el tipo de espacio y cómo podemos ayudarte…', submit: 'Enviar consulta', submitting: 'Enviando…', subjects: { sales: 'Planes y preguntas sobre el producto', support: 'Soporte técnico', partner: 'Oportunidades de asociación', general: 'Pregunta general' } },
    success: { heading: '¡Mensaje recibido!', sub: 'Hemos registrado tu mensaje. Si necesitas seguimiento, consulta el Centro de ayuda o vuelve a contactarnos.', another: 'Enviar otro mensaje' },
  },
};
