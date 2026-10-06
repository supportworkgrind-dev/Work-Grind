import type { Translations } from './en';

export const de: Translations = {
  dir: 'ltr',
  nav: { signIn: 'Anmelden', getStarted: 'Loslegen', openWorkspace: 'Workspace öffnen', product: 'Produkt', solutions: 'Lösungen', features: 'Funktionen', ai: 'KI', security: 'Sicherheit', backToHome: '← Zurück zur Startseite' },
  footer: { tagline: 'Ein intelligenter Workspace für moderne Teams.', company: 'Unternehmen', security: 'Sicherheit', about: 'Über uns', features: 'Funktionen', demo: 'Demo', contact: 'Kontakt', privacy: 'Datenschutz', terms: 'Nutzungsbedingungen', rights: '© {{year}} WorkGrind. Alle Rechte vorbehalten.', trial: '7-Tage-Testversion · Keine langfristige Bindung · Für moderne Teams' },
  common: { submit: 'Senden', send: 'Absenden', cancel: 'Abbrechen', loading: 'Lädt…', optional: 'optional', required: 'erforderlich', errorGeneric: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.', backToHome: 'Zurück zur Startseite', startFreeTrial: 'Kostenlose Testversion', learnMore: 'Mehr erfahren', close: 'Schließen' },
  about: {
    badge: 'Unsere Mission', headline1: 'Neugestaltung der Zusammenarbeit', headline2: 'moderner Organisationen', headline3: '',
    subheadline: 'WorkGrind wurde mit einem zentralen Auftrag geschaffen: Software-Fragmentierung beseitigen und den Fokus für Teams weltweit wiederherstellen.',
    stats: { workspaces: 'Erstellte Workspaces', messages: 'Versendete Nachrichten', tasks: 'Abgeschlossene Aufgaben', uptime: 'Verfügbarkeits-SLA' },
    story: { heading: 'Die Geschichte von WorkGrind', p1: 'Im heutigen digitalen Büro verbringen Mitarbeiter bis zu 30 % ihres Arbeitstags mit dem Wechseln zwischen mehreren unverbundenen Tools.', p2: 'Dieses ständige Kontextwechseln führt zu fragmentierter Kommunikation, verpassten Projektfristen und Mitarbeiterburnout. WorkGrind löst dieses Problem.' },
    pillars: {
      sync:     { title: 'Sofortige Echtzeitsynchronisierung', desc: 'Betrieben von Socket.io und MongoDB-Abfragen für null Latenz bei Chat, Aufgaben und Präsenz.' },
      security: { title: 'Enterprise-Sicherheit',              desc: 'Mehrmandantenfähige Datenisolierung auf Zeilenebene, verschlüsselte Sitzungen und strenge RBAC-Kontrollen.' },
      scale:    { title: 'Globale Skalierung',                  desc: 'Entwickelt für hybride, remote und multi-office Belegschaften von Anfang an.' },
    },
    workspace: { heading: 'Alles in einem Workspace', subheading: '12 tief integrierte Module ersetzen 12 separate SaaS-Abonnements.' },
    cta: { badge: 'Geschäftsführung', name: 'RANA MOEZ', role: 'Produktarchitekt & Leitender Systemingenieur', button: 'Kostenlos starten' },
  },
  features: {
    badge: 'Vollständiges Feature-Set', headline: 'Alle Tools, die Ihr Team braucht', subheadline: 'Entdecken Sie, wie WorkGrind getrennte Apps durch eine verbundene Workspace-Plattform ersetzt.',
    cta: { heading: 'Bereit, diese Funktionen live zu testen?', sub: 'Erstellen Sie Ihren Unternehmens-Workspace in unter 30 Sekunden ohne Kreditkarte.' },
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
    badge: 'Persönliche Präsentation', headline: 'WorkGrind-Demo buchen', subheadline: 'Erzählen Sie uns von Ihrem Team und wir planen eine individuelle 1-zu-1-Präsentation.',
    form: { name: 'Vollständiger Name', email: 'Geschäftliche E-Mail', company: 'Unternehmensname', message: 'Was möchten Sie erkunden?', namePH: 'z.B. Max Müller', emailPH: 'max@unternehmen.de', companyPH: 'Muster GmbH', messagePH: 'Sagen Sie uns, was Sie sehen möchten…', submit: 'Live-Demo anfragen', submitting: 'Wird gesendet…' },
    success: { heading: 'Danke! Wir melden uns bald.', sub: 'Wir haben Ihre Demo-Anfrage für {{email}} erhalten. Unser Team wird sich bald bei Ihnen melden.', home: 'Zurück zur Startseite', another: 'Weitere Anfrage senden' },
  },
  contact: {
    badge: 'Kontakt aufnehmen', headline: 'WorkGrind kontaktieren', sub: 'Fragen zu Bereitstellung oder Enterprise-Plänen? Unser Team hilft Ihnen gerne weiter.',
    form: { heading: 'Nachricht senden', name: 'Ihr Name', email: 'Geschäftliche E-Mail', company: 'Unternehmen', subject: 'Betreff', message: 'Nachricht', namePH: 'Sarah Jenkins', emailPH: 'sarah@unternehmen.de', companyPH: 'Apex Technologies', messagePH: 'Erzählen Sie uns von Ihrer Teamgröße und Anforderungen…', submit: 'Anfrage senden', submitting: 'Wird gesendet…', subjects: { sales: 'Vertrieb & Enterprise-Demo', support: 'Technischer Support', partner: 'Partnerschaftsmöglichkeiten', general: 'Allgemeine Frage' } },
    success: { heading: 'Nachricht erhalten!', sub: 'Vielen Dank für Ihre Anfrage. Unser Team antwortet innerhalb von 2 Werktunden.', another: 'Weitere Nachricht senden' },
  },
};
