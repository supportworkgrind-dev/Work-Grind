import type { Translations } from './en';

export const es: Translations = {
  dir: 'ltr',
  nav: { signIn: 'Iniciar sesión', getStarted: 'Empezar', openWorkspace: 'Abrir espacio', product: 'Producto', solutions: 'Soluciones', features: 'Características', ai: 'IA', security: 'Seguridad', backToHome: '← Volver al inicio' },
  footer: { tagline: 'Un espacio de trabajo inteligente para equipos modernos.', company: 'Empresa', security: 'Seguridad', about: 'Acerca de', features: 'Características', demo: 'Demo', contact: 'Contacto', privacy: 'Política de privacidad', terms: 'Términos de servicio', rights: '© {{year}} WorkGrind. Todos los derechos reservados.', trial: 'Prueba gratuita de 7 días · Sin compromiso · Para equipos modernos' },
  common: { submit: 'Enviar', send: 'Enviar', cancel: 'Cancelar', loading: 'Cargando…', optional: 'opcional', required: 'requerido', errorGeneric: 'Algo salió mal. Por favor inténtalo de nuevo.', backToHome: 'Volver al inicio', startFreeTrial: 'Iniciar prueba gratuita', learnMore: 'Más información', close: 'Cerrar' },
  about: {
    badge: 'Nuestra misión', headline1: 'Reimaginando cómo las', headline2: 'organizaciones', headline3: 'modernas trabajan juntas',
    subheadline: 'WorkGrind fue creado con un único mandato: eliminar la fragmentación de software y restaurar el enfoque profundo para equipos en todo el mundo.',
    stats: { workspaces: 'Espacios creados', messages: 'Mensajes enviados', tasks: 'Tareas completadas', uptime: 'SLA de disponibilidad' },
    story: { heading: 'La historia de WorkGrind', p1: 'En la oficina digital actual, los empleados pasan hasta el 30 % de su jornada alternando entre herramientas desconectadas.', p2: 'Este cambio constante de contexto conduce a comunicación fragmentada, plazos perdidos y agotamiento. WorkGrind resuelve esto.' },
    pillars: {
      sync:     { title: 'Sincronización en tiempo real', desc: 'Impulsado por Socket.io y MongoDB para latencia cero en chat, tareas y presencia.' },
      security: { title: 'Seguridad empresarial',         desc: 'Aislamiento multi-tenant a nivel de filas, sesiones cifradas y controles RBAC estrictos.' },
      scale:    { title: 'Escala global',                  desc: 'Diseñado para equipos híbridos, remotos y de múltiples oficinas desde el primer día.' },
    },
    workspace: { heading: 'Todo en un solo espacio', subheading: '12 módulos integrados que reemplazan 12 suscripciones SaaS separadas.' },
    cta: { badge: 'Liderazgo ejecutivo', name: 'RANA MOEZ', role: 'Arquitecto de producto e ingeniero de sistemas principal', button: 'Empieza gratis' },
  },
  features: {
    badge: 'Conjunto completo de características', headline: 'Todas las herramientas que tu equipo necesita', subheadline: 'Descubre cómo WorkGrind reemplaza aplicaciones desconectadas con una plataforma unificada.',
    cta: { heading: '¿Listo para probar estas características en vivo?', sub: 'Crea tu espacio de trabajo en menos de 30 segundos, sin tarjeta de crédito.' },
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
    badge: 'Presentación personalizada', headline: 'Reserva una demo de WorkGrind', subheadline: 'Cuéntanos sobre tu equipo y programaremos una presentación personalizada 1-a-1 adaptada a tu flujo de trabajo.',
    form: { name: 'Nombre completo', email: 'Correo de trabajo', company: 'Nombre de empresa', message: '¿Qué te gustaría explorar?', namePH: 'ej. Ana García', emailPH: 'ana@empresa.com', companyPH: 'Acme Corp', messagePH: 'Dinos qué te gustaría ver…', submit: 'Solicitar demo en vivo', submitting: 'Enviando…' },
    success: { heading: '¡Gracias! Pronto nos pondremos en contacto.', sub: 'Recibimos tu solicitud de demo para {{email}}. Nuestro equipo te contactará pronto.', home: 'Volver al inicio', another: 'Enviar otra solicitud' },
  },
  contact: {
    badge: 'Ponerse en contacto', headline: 'Contactar WorkGrind', sub: '¿Preguntas sobre implementación o planes enterprise? Nuestro equipo está aquí para ayudar.',
    form: { heading: 'Envíanos un mensaje', name: 'Tu nombre', email: 'Correo de trabajo', company: 'Empresa', subject: 'Asunto', message: 'Mensaje', namePH: 'Sarah Jenkins', emailPH: 'sarah@empresa.com', companyPH: 'Apex Technologies', messagePH: 'Cuéntanos sobre el tamaño de tu equipo y sus necesidades…', submit: 'Enviar consulta', submitting: 'Enviando…', subjects: { sales: 'Ventas y demo enterprise', support: 'Soporte técnico', partner: 'Oportunidades de asociación', general: 'Pregunta general' } },
    success: { heading: '¡Mensaje recibido!', sub: 'Gracias por contactar WorkGrind. Nuestro equipo responderá en 2 horas hábiles.', another: 'Enviar otro mensaje' },
  },
};
