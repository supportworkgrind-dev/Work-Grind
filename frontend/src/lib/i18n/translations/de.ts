import type { Translations } from './en';

export const de: Translations = {
  dir: 'ltr',
  nav: { signIn: 'Anmelden', getStarted: 'Loslegen', openWorkspace: 'Workspace öffnen', product: 'Produkt', solutions: 'Lösungen', features: 'Funktionen', ai: 'KI', security: 'Sicherheit', backToHome: '← Zurück zur Startseite' },
  footer: { tagline: 'Ein verbundener Workspace für persönliche Arbeit, Unternehmen und Bildung.', company: 'Unternehmen', security: 'Sicherheit', about: 'Über uns', features: 'Funktionen', demo: 'Demo', contact: 'Kontakt', privacy: 'Datenschutz', terms: 'Nutzungsbedingungen', rights: '© {{year}} WorkGrind. Alle Rechte vorbehalten.', trial: 'Wählen Sie Solo, Company, Schule, Hochschule oder Universität.' },
  common: { submit: 'Senden', send: 'Absenden', cancel: 'Abbrechen', loading: 'Lädt…', optional: 'optional', required: 'erforderlich', errorGeneric: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.', backToHome: 'Zurück zur Startseite', startFreeTrial: 'Kostenlose Testversion', learnMore: 'Mehr erfahren', close: 'Schließen' },
  about: {
    badge: 'Über WorkGrind', headline1: 'Ein verbundener Workspace für', headline2: 'Arbeit und Lernen', headline3: '',
    subheadline: 'WorkGrind bietet eigene Workspace-Erlebnisse für persönliche Produktivität, Zusammenarbeit in Unternehmen und akademische Verwaltung.',
    stats: { workspaces: 'Erstellte Workspaces', messages: 'Versendete Nachrichten', tasks: 'Abgeschlossene Aufgaben', uptime: 'Verfügbarkeits-SLA' },
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
      chat:          { title: 'Echtzeit-Kommunikation',          tag: 'Chat & DMs',      desc: 'Organisieren Sie Team-Diskussionen in öffentlichen oder privaten Kanälen, senden Sie Direktnachrichten und nutzen Sie Markdown.' },
      tasks:         { title: 'Aufgaben- & Arbeitsmanagement',   tag: 'Kanban & Listen', desc: 'Verfolgen Sie Aufgaben über flexible Kanban-Boards oder strukturierte Listen. Weisen Sie Verantwortliche zu und setzen Sie Prioritäten.' },
      projects:      { title: 'Projekt-Roadmaps & Fortschritt',  tag: 'Management',      desc: 'Gruppieren Sie Aufgaben in Unternehmensprojekte. Überwachen Sie den Fortschritt in Echtzeit.' },
      files:         { title: 'Cloud-Dokumente & Dateilaufwerk', tag: 'Arbeitslaufwerk', desc: 'Speichern Sie alle Unternehmensdateien in einer Ordnerstruktur. Erstellen Sie kollaborative Dokumente mit Versionsverlauf.' },
      meetings:      { title: 'Videomeetings & Kalender',        tag: 'Video & Events',  desc: 'Hosten Sie WebRTC-Videoanrufe mit Bildschirmfreigabe. Planen Sie Team-Meetings direkt im Kalender.' },
      ai:            { title: 'KI-Workspace-Copilot',            tag: 'KI-Unterstützung', desc: 'Fassen Sie Meeting-Protokolle zusammen, entwerfen Sie Projektbriefings und generieren Sie Aufgabenlisten in Sekunden.' },
      search:        { title: '⌘K Globale Suche',                tag: 'Sofortsuche',     desc: 'Finden Sie sofort Teammitglieder, Aufgaben, Nachrichten oder Dateien mit einem Tastaturkürzel.' },
      notifications: { title: 'Zentrale Benachrichtigungen',     tag: 'Benachrichtigungen', desc: 'Bleiben Sie informiert ohne Überlastung. Erhalten Sie sofortige Benachrichtigungen bei Erwähnung oder Aufgabenzuweisung.' },
    },
  },
  demo: {
    badge: 'WorkGrind kennenlernen', headline: 'WorkGrind entdecken', subheadline: 'Teilen Sie uns mit, welchen Workspace Sie erkunden und was Sie erfahren möchten.',
    form: { name: 'Vollständiger Name', email: 'E-Mail-Adresse', company: 'Unternehmen oder Institution (optional)', message: 'Was möchten Sie erkunden?', namePH: 'z.B. Max Müller', emailPH: 'max@example.com', companyPH: 'Name der Organisation', messagePH: 'Nennen Sie uns den Workspace-Typ und Ihre Fragen…', submit: 'Rundgang anfragen', submitting: 'Wird gesendet…' },
    success: { heading: 'Danke! Wir melden uns bald.', sub: 'Wir haben Ihre Demo-Anfrage für {{email}} erhalten. Unser Team wird sich bald bei Ihnen melden.', home: 'Zurück zur Startseite', another: 'Weitere Anfrage senden' },
  },
  contact: {
    badge: 'Kontakt', headline: 'WorkGrind kontaktieren', sub: 'Fragen zu Solo-, Company-, Schul-, Hochschul- oder Universitäts-Workspaces, Tarifen oder Support? Schreiben Sie uns.',
    form: { heading: 'Nachricht senden', name: 'Ihr Name', email: 'E-Mail-Adresse', company: 'Unternehmen oder Institution (optional)', subject: 'Betreff', message: 'Nachricht', namePH: 'Ihr Name', emailPH: 'sie@example.com', companyPH: 'Name der Organisation', messagePH: 'Nennen Sie uns den Workspace-Typ und wie wir helfen können…', submit: 'Anfrage senden', submitting: 'Wird gesendet…', subjects: { sales: 'Tarife und Produktfragen', support: 'Technischer Support', partner: 'Partnerschaftsmöglichkeiten', general: 'Allgemeine Frage' } },
    success: { heading: 'Nachricht erhalten!', sub: 'Vielen Dank für Ihre Anfrage. Unser Team antwortet innerhalb von 2 Werktunden.', another: 'Weitere Nachricht senden' },
  },
};
