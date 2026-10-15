import type { Translations } from './en';

export const de: Translations = {
  dir: 'ltr',
  nav: { signIn: 'Anmelden', getStarted: 'Loslegen', openWorkspace: 'Workspace öffnen', product: 'Produkt', solutions: 'Lösungen', features: 'Funktionen', ai: 'KI', security: 'Sicherheit', backToHome: '← Zurück zur Startseite' },
  footer: { tagline: 'Ein verbundener Workspace für persönliche Arbeit, Unternehmen und Bildung.', company: 'Unternehmen', security: 'Sicherheit', about: 'Über uns', features: 'Funktionen', demo: 'Demo', contact: 'Kontakt', privacy: 'Datenschutz', terms: 'Nutzungsbedingungen', rights: '© {{year}} WorkGrind. Alle Rechte vorbehalten.', trial: 'Wählen Sie Solo, Company, Schule, Hochschule oder Universität.' },
  common: { submit: 'Senden', send: 'Absenden', cancel: 'Abbrechen', loading: 'Lädt…', optional: 'optional', required: 'erforderlich', errorGeneric: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.', backToHome: 'Zurück zur Startseite', startFreeTrial: 'Kostenlose Testversion', learnMore: 'Mehr erfahren', close: 'Schließen' },
  about: {
    badge: 'Über WorkGrind', headline1: 'Ein verbundener Workspace für', headline2: 'Arbeit und Lernen', headline3: '',
    subheadline: 'WorkGrind bietet eigene Workspace-Erlebnisse für persönliche Produktivität, Zusammenarbeit in Unternehmen und akademische Verwaltung.',
    stats: { workspaces: 'Solo', messages: 'Company', tasks: 'Schule / Akademie', uptime: 'Hochschule / Universität' },
    story: { heading: 'Ein Workspace passend zur jeweiligen Arbeit', p1: 'Ein persönlicher Tagesplan, Unternehmensprojekte und akademische Verwaltung benötigen unterschiedliche Funktionen und Berechtigungen.', p2: 'WorkGrind bietet getrennte Workspaces für Solo, Company, Schule / Akademie, Hochschule und Universität. Verfügbare Funktionen hängen von Workspace-Typ, Rolle und Tarif ab.' },
    pillars: {
      sync:     { title: 'Zusammenhängende Arbeit', desc: 'Unterstützte Aufgaben, Projekte, Termine, Gespräche und gemeinsam genutzte Einträge bleiben im Workspace verbunden.' },
      security: { title: 'Workspace-Berechtigungen', desc: 'Zugriff hängt von Mitgliedschaft, Rolle, verfügbaren Funktionen und angeforderten Daten ab.' },
      scale:    { title: 'Verschiedene Arbeitsweisen', desc: 'Wählen Sie bei der Registrierung Solo, Company, Schule, Hochschule oder Universität.' },
    },
    workspace: { heading: 'Wählen Sie den passenden Workspace', subheading: 'Business-CRM und Kundenfunktionen sind von akademischer Verwaltung getrennt.' },
    cta: { badge: 'WorkGrind entdecken', name: 'Workspace auswählen', role: 'Vergleichen Sie die fünf Workspace-Typen und wählen Sie den passenden.', button: 'Loslegen' },
  },
  features: {
    badge: 'Workspaces und Funktionen', headline: 'Die passenden Tools für Ihre Arbeit', subheadline: 'WorkGrind trennt persönliche Produktivität, Unternehmensabläufe und akademische Verwaltung und verbindet nützliche Zusammenarbeit.',
    cta: { heading: 'Wählen Sie Ihren WorkGrind-Workspace', sub: 'Wählen Sie bei der Registrierung Solo, Company, Schule / Akademie, Hochschule oder Universität.' },
    items: {
      chat:          { title: 'Kommunikation im Workspace', tag: 'Chat & Nachrichten', desc: 'Nutzen Sie verfügbare Workspace-Kanäle und Direktnachrichten, um Gespräche mit gemeinsamer Arbeit zu verbinden.' },
      tasks:         { title: 'Aufgaben und Planung', tag: 'Persönliche oder Teamarbeit', desc: 'Erstellen und organisieren Sie Aufgaben, setzen Sie Prioritäten und Termine und verfolgen Sie den Fortschritt, sofern verfügbar.' },
      projects:      { title: 'Projekte', tag: 'Arbeitsorganisation', desc: 'Bündeln Sie zusammengehörige Arbeit in Projekten und verfolgen Sie Zuständigkeiten, Status und Fristen in unterstützten Workspaces.' },
      files:         { title: 'Dateien und Dokumente', tag: 'Gemeinsame Funktionen', desc: 'Organisieren Sie Dateien und Dokumente mit Workspace- und rollenbasiertem Zugriff. Die Verfügbarkeit hängt von Konto und Tarif ab.' },
      meetings:      { title: 'Meetings und Kalender', tag: 'Gemeinsame Funktionen', desc: 'Planen Sie Meetings und prüfen Sie Kalendereinträge, sofern dies für Workspace und Tarif aktiviert ist.' },
      ai:            { title: 'Tavro AI', tag: 'KI-Unterstützung', desc: 'Erhalten Sie Hilfe bei unterstützten Fragen zu Arbeit und Lernen. Verfügbare Informationen und Aktionen hängen von Rolle und Tarif ab.' },
      search:        { title: 'Workspace-Suche', tag: 'Informationen finden', desc: 'Suchen Sie unterstützte Personen, Aufgaben, Nachrichten, Dokumente und Dateien in Ihrem autorisierten Workspace.' },
      notifications: { title: 'Benachrichtigungen', tag: 'Aktualisierungen', desc: 'Prüfen Sie Updates und Hinweise zu Aktivitäten, die für Ihr Konto verfügbar sind.' },
    },
  },
  demo: {
    badge: 'WorkGrind kennenlernen', headline: 'WorkGrind-Rundgang anfragen', subheadline: 'Teilen Sie uns mit, welchen Workspace Sie erkunden und was Sie erfahren möchten.',
    form: { name: 'Vollständiger Name', email: 'E-Mail-Adresse', company: 'Unternehmen oder Institution (optional)', message: 'Was möchten Sie erkunden?', namePH: 'z.B. Max Müller', emailPH: 'max@example.com', companyPH: 'Name der Organisation', messagePH: 'Nennen Sie uns den Workspace-Typ und Ihre Fragen…', submit: 'Rundgang anfragen', submitting: 'Wird gesendet…' },
    success: { heading: 'Danke! Wir melden uns bald.', sub: 'Wir haben Ihre Demo-Anfrage für {{email}} erhalten. Unser Team wird sich bald bei Ihnen melden.', home: 'Zurück zur Startseite', another: 'Weitere Anfrage senden' },
  },
  contact: {
    badge: 'Kontakt', headline: 'WorkGrind kontaktieren', sub: 'Fragen zu Solo-, Company-, Schul-, Hochschul- oder Universitäts-Workspaces, Tarifen oder Support? Schreiben Sie uns.',
    form: { heading: 'Nachricht senden', name: 'Ihr Name', email: 'E-Mail-Adresse', company: 'Unternehmen oder Institution (optional)', subject: 'Betreff', message: 'Nachricht', namePH: 'Ihr Name', emailPH: 'sie@example.com', companyPH: 'Name der Organisation', messagePH: 'Nennen Sie uns den Workspace-Typ und wie wir helfen können…', submit: 'Anfrage senden', submitting: 'Wird gesendet…', subjects: { sales: 'Tarife und Produktfragen', support: 'Technischer Support', partner: 'Partnerschaftsmöglichkeiten', general: 'Allgemeine Frage' } },
    success: { heading: 'Nachricht erhalten!', sub: 'Ihre Nachricht wurde erfasst. Wenn Sie eine Rückmeldung benötigen, nutzen Sie das Help Center oder kontaktieren Sie uns.', another: 'Weitere Nachricht senden' },
  },
};
