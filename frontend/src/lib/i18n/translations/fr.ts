import type { Translations } from './en';

export const fr: Translations = {
  dir: 'ltr',
  nav: { signIn: 'Se connecter', getStarted: 'Commencer', openWorkspace: 'Ouvrir l\'espace', product: 'Produit', solutions: 'Solutions', features: 'Fonctionnalités', ai: 'IA', security: 'Sécurité', backToHome: '← Retour à l\'accueil' },
  footer: { tagline: 'Un espace connecté pour le travail personnel, les entreprises et l’éducation.', company: 'Entreprise', security: 'Sécurité', about: 'À propos', features: 'Fonctionnalités', demo: 'Démo', contact: 'Contact', privacy: 'Politique de confidentialité', terms: 'Conditions d\'utilisation', rights: '© {{year}} WorkGrind. Tous droits réservés.', trial: 'Choisissez un espace Solo, Company, École, Collège ou Université.' },
  common: { submit: 'Soumettre', send: 'Envoyer', cancel: 'Annuler', loading: 'Chargement…', optional: 'optionnel', required: 'requis', errorGeneric: 'Une erreur est survenue. Veuillez réessayer.', backToHome: 'Retour à l\'accueil', startFreeTrial: 'Démarrer l\'essai gratuit', learnMore: 'En savoir plus', close: 'Fermer' },
  about: {
    badge: 'À propos de WorkGrind', headline1: 'Un espace connecté pour', headline2: 'travailler et apprendre', headline3: '',
    subheadline: 'WorkGrind propose des expériences distinctes pour la productivité personnelle, la collaboration en entreprise et l’administration académique.',
    stats: { workspaces: 'Solo', messages: 'Company', tasks: 'École / Académie', uptime: 'Collège / Université' },
    story: { heading: 'Un espace adapté à votre activité', p1: 'Organiser sa journée, coordonner les projets d’une entreprise et gérer un établissement scolaire nécessitent des outils et des autorisations différents.', p2: 'WorkGrind propose des espaces Solo, Company, École / Académie, Collège et Université. Les fonctionnalités dépendent du type d’espace, du rôle et du forfait.' },
    pillars: {
      sync:     { title: 'Travail connecté', desc: 'Les tâches, projets, calendriers et conversations pris en charge restent associés dans votre espace.' },
      security: { title: 'Autorisations de l’espace', desc: 'L’accès dépend de l’adhésion, du rôle, des fonctionnalités disponibles et des données demandées.' },
      scale:    { title: 'Différentes façons de travailler', desc: 'Choisissez un espace Solo, Company, École, Collège ou Université lors de votre inscription.' },
    },
    workspace: { heading: 'Choisissez l’espace adapté', subheading: 'Le CRM et les outils clients sont distincts de l’administration académique.' },
    cta: { badge: 'Découvrir WorkGrind', name: 'Choisir un espace', role: 'Comparez les cinq types d’espace et choisissez celui qui vous convient.', button: 'Commencer' },
  },
  features: {
    badge: 'Espaces et fonctionnalités', headline: 'Les outils adaptés à votre activité', subheadline: 'WorkGrind distingue la productivité personnelle, les opérations d’entreprise et l’administration académique.',
    cta: { heading: 'Choisissez votre espace WorkGrind', sub: 'Sélectionnez Solo, Company, École / Académie, Collège ou Université lors de l’inscription.' },
    items: {
      chat:          { title: 'Communication de l’espace de travail', tag: 'Chat et messages', desc: 'Utilisez les canaux et messages directs disponibles pour relier les échanges au travail partagé.' },
      tasks:         { title: 'Tâches et planification', tag: 'Travail individuel ou en équipe', desc: 'Créez et organisez des tâches, définissez des priorités et des échéances, puis suivez leur avancement lorsque ces outils sont disponibles.' },
      projects:      { title: 'Projets', tag: 'Organisation du travail', desc: 'Regroupez les travaux associés et suivez les responsabilités, l’état et les échéances dans les espaces compatibles.' },
      files:         { title: 'Fichiers et documents', tag: 'Fonction partagée', desc: 'Organisez les fichiers et documents avec des accès selon l’espace et le rôle. La disponibilité dépend du compte et de l’offre.' },
      meetings:      { title: 'Réunions et calendrier', tag: 'Fonction partagée', desc: 'Planifiez des réunions et consultez les éléments du calendrier lorsqu’ils sont activés pour l’espace et l’offre.' },
      ai:            { title: 'Tavro AI', tag: 'Assistance IA', desc: 'Obtenez de l’aide pour les questions prises en charge sur le travail et l’apprentissage. Les informations et actions disponibles dépendent de votre rôle et de votre offre.' },
      search:        { title: 'Recherche dans l’espace', tag: 'Trouver des informations', desc: 'Recherchez les personnes, tâches, messages, documents et fichiers pris en charge dans votre espace autorisé.' },
      notifications: { title: 'Notifications', tag: 'Mises à jour', desc: 'Consultez les alertes et mises à jour sur l’activité accessible à votre compte.' },
    },
  },
  demo: {
    badge: 'Découvrir WorkGrind', headline: 'Demander une présentation de WorkGrind', subheadline: 'Indiquez-nous l’espace WorkGrind qui vous intéresse et ce que vous souhaitez découvrir.',
    form: { name: 'Nom complet', email: 'Adresse e-mail', company: 'Entreprise ou établissement (facultatif)', message: 'Que souhaitez-vous explorer ?', namePH: 'ex. Alex Martin', emailPH: 'alex@example.com', companyPH: 'Nom de l’organisation', messagePH: 'Indiquez le type d’espace et vos questions…', submit: 'Demander une présentation', submitting: 'Envoi en cours…' },
    success: { heading: 'Merci ! Nous vous contacterons bientôt.', sub: 'Nous avons reçu votre demande pour {{email}}. Notre équipe vous contactera bientôt.', home: 'Retour à l\'accueil', another: 'Soumettre une autre demande' },
  },
  contact: {
    badge: 'Contact', headline: 'Contacter WorkGrind', sub: 'Une question sur Solo, Company, École / Académie, Collège, Université, les forfaits ou l’assistance ? Écrivez-nous.',
    form: { heading: 'Envoyez-nous un message', name: 'Votre nom', email: 'Adresse e-mail', company: 'Entreprise ou établissement (facultatif)', subject: 'Sujet', message: 'Message', namePH: 'Votre nom', emailPH: 'vous@example.com', companyPH: 'Nom de l’organisation', messagePH: 'Indiquez le type d’espace et comment nous pouvons vous aider…', submit: 'Envoyer la demande', submitting: 'Envoi…', subjects: { sales: 'Forfaits et questions sur le produit', support: 'Support technique', partner: 'Opportunités de partenariat', general: 'Question générale' } },
    success: { heading: 'Message reçu !', sub: 'Votre message a été enregistré. Pour un suivi, consultez le centre d’aide ou contactez-nous à nouveau.', another: 'Envoyer un autre message' },
  },
};
