import type { Translations } from './en';

export const es: Translations = {
  dir: 'ltr',
  nav: { signIn: 'Iniciar sesión', getStarted: 'Empezar', openWorkspace: 'Abrir espacio', product: 'Producto', solutions: 'Soluciones', features: 'Características', ai: 'IA', security: 'Seguridad', backToHome: '← Volver al inicio' },
  footer: { tagline: 'Un espacio conectado para el trabajo personal, los negocios y la educación.', company: 'Empresa', security: 'Seguridad', about: 'Acerca de', features: 'Características', demo: 'Demo', contact: 'Contacto', privacy: 'Política de privacidad', terms: 'Términos de servicio', rights: '© {{year}} WorkGrind. Todos los derechos reservados.', trial: 'Elige un espacio Solo, Company, Escuela, Colegio o Universidad.' },
  common: { submit: 'Enviar', send: 'Enviar', cancel: 'Cancelar', loading: 'Cargando…', optional: 'opcional', required: 'requerido', errorGeneric: 'Algo salió mal. Por favor inténtalo de nuevo.', backToHome: 'Volver al inicio', startFreeTrial: 'Iniciar prueba gratuita', learnMore: 'Más información', close: 'Cerrar' },
  about: {
    badge: 'Acerca de WorkGrind', headline1: 'Un espacio conectado para', headline2: 'trabajar y aprender', headline3: '',
    subheadline: 'WorkGrind ofrece experiencias distintas para la productividad personal, la colaboración empresarial y la administración académica.',
    stats: { workspaces: 'Espacios creados', messages: 'Mensajes enviados', tasks: 'Tareas completadas', uptime: 'SLA de disponibilidad' },
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
      chat:          { title: 'Comunicación en tiempo real',   tag: 'Chat y DMs',      desc: 'Organiza discusiones en canales públicos o privados, envía mensajes directos y usa Markdown con emojis.' },
      tasks:         { title: 'Gestión de tareas y trabajo',   tag: 'Kanban y listas', desc: 'Realiza el seguimiento de entregables con tableros Kanban flexibles o listas estructuradas. Asigna responsables y prioridades.' },
      projects:      { title: 'Hojas de ruta de proyectos',   tag: 'Gestión',         desc: 'Agrupa tareas en proyectos de empresa. Monitorea barras de progreso en tiempo real.' },
      files:         { title: 'Documentos y unidad en la nube', tag: 'Unidad de trabajo', desc: 'Almacena todos los archivos en una carpeta. Crea documentos colaborativos con historial de versiones.' },
      meetings:      { title: 'Videoreuniones y calendario',   tag: 'Video y eventos', desc: 'Organiza videollamadas WebRTC con pantalla compartida. Programa reuniones directamente en el calendario.' },
      ai:            { title: 'Copiloto IA del espacio',       tag: 'Asistencia IA',   desc: 'Resume transcripciones de reuniones, redacta informes de proyecto y genera listas de tareas en segundos.' },
      search:        { title: '⌘K Búsqueda global unificada', tag: 'Búsqueda rápida', desc: 'Encuentra al instante cualquier miembro del equipo, tarea, mensaje o archivo con un atajo de teclado.' },
      notifications: { title: 'Notificaciones centralizadas',  tag: 'Alertas',         desc: 'Mantente informado sin sobrecarga. Recibe alertas inmediatas cuando te mencionan o asignan una tarea.' },
    },
  },
  demo: {
    badge: 'Conoce WorkGrind', headline: 'Explora WorkGrind', subheadline: 'Cuéntanos qué espacio de WorkGrind te interesa y qué te gustaría conocer.',
    form: { name: 'Nombre completo', email: 'Correo electrónico', company: 'Empresa o institución (opcional)', message: '¿Qué te gustaría explorar?', namePH: 'ej. Ana García', emailPH: 'ana@example.com', companyPH: 'Nombre de la organización', messagePH: 'Indica el tipo de espacio y tus preguntas…', submit: 'Solicitar recorrido', submitting: 'Enviando…' },
    success: { heading: '¡Gracias! Pronto nos pondremos en contacto.', sub: 'Recibimos tu solicitud de demo para {{email}}. Nuestro equipo te contactará pronto.', home: 'Volver al inicio', another: 'Enviar otra solicitud' },
  },
  contact: {
    badge: 'Contacto', headline: 'Contacta con WorkGrind', sub: '¿Tienes preguntas sobre Solo, Company, Escuela / Academia, Colegio, Universidad, planes o soporte? Escríbenos.',
    form: { heading: 'Envíanos un mensaje', name: 'Tu nombre', email: 'Correo electrónico', company: 'Empresa o institución (opcional)', subject: 'Asunto', message: 'Mensaje', namePH: 'Tu nombre', emailPH: 'tu@example.com', companyPH: 'Nombre de la organización', messagePH: 'Indica el tipo de espacio y cómo podemos ayudarte…', submit: 'Enviar consulta', submitting: 'Enviando…', subjects: { sales: 'Planes y preguntas sobre el producto', support: 'Soporte técnico', partner: 'Oportunidades de asociación', general: 'Pregunta general' } },
    success: { heading: '¡Mensaje recibido!', sub: 'Gracias por contactar WorkGrind. Nuestro equipo responderá en 2 horas hábiles.', another: 'Enviar otro mensaje' },
  },
};
