import type { Translations } from './en';

export const fr: Translations = {
  dir: 'ltr',
  nav: { signIn: 'Se connecter', getStarted: 'Commencer', openWorkspace: 'Ouvrir l\'espace', product: 'Produit', solutions: 'Solutions', features: 'Fonctionnalités', ai: 'IA', security: 'Sécurité', backToHome: '← Retour à l\'accueil' },
  footer: { tagline: 'Un espace connecté pour le travail personnel, les entreprises et l’éducation.', company: 'Entreprise', security: 'Sécurité', about: 'À propos', features: 'Fonctionnalités', demo: 'Démo', contact: 'Contact', privacy: 'Politique de confidentialité', terms: 'Conditions d\'utilisation', rights: '© {{year}} WorkGrind. Tous droits réservés.', trial: 'Choisissez un espace Solo, Company, École, Collège ou Université.' },
  common: { submit: 'Soumettre', send: 'Envoyer', cancel: 'Annuler', loading: 'Chargement…', optional: 'optionnel', required: 'requis', errorGeneric: 'Une erreur est survenue. Veuillez réessayer.', backToHome: 'Retour à l\'accueil', startFreeTrial: 'Démarrer l\'essai gratuit', learnMore: 'En savoir plus', close: 'Fermer' },
  about: {
    badge: 'À propos de WorkGrind', headline1: 'Un espace connecté pour', headline2: 'travailler et apprendre', headline3: '',
    subheadline: 'WorkGrind propose des expériences distinctes pour la productivité personnelle, la collaboration en entreprise et l’administration académique.',
    stats: { workspaces: 'Espaces créés', messages: 'Messages envoyés', tasks: 'Tâches accomplies', uptime: 'SLA de disponibilité' },
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
      chat:          { title: 'Communication en temps réel',   tag: 'Chat et DMs',    desc: 'Organisez les discussions en canaux publics ou privés, envoyez des messages directs, utilisez Markdown et des réactions emoji.' },
      tasks:         { title: 'Gestion des tâches',            tag: 'Kanban et listes', desc: 'Suivez les livrables via des tableaux Kanban flexibles ou des listes structurées. Assignez des responsables et définissez des priorités.' },
      projects:      { title: 'Feuilles de route des projets', tag: 'Gestion',         desc: 'Regroupez les tâches en projets. Surveillez les barres de progression en temps réel.' },
      files:         { title: 'Documents et lecteur cloud',    tag: 'Lecteur de travail', desc: 'Stockez tous les fichiers dans une arborescence. Créez des documents collaboratifs avec historique des versions.' },
      meetings:      { title: 'Vidéoconférences et calendrier', tag: 'Vidéo et événements', desc: 'Organisez des appels vidéo WebRTC avec partage d\'écran. Planifiez des réunions directement dans le calendrier.' },
      ai:            { title: 'Copilote IA de l\'espace',      tag: 'Assistance IA',  desc: 'Résumez les transcriptions de réunions, rédigez des briefs de projet et générez des listes de tâches en quelques secondes.' },
      search:        { title: '⌘K Recherche globale unifiée', tag: 'Recherche rapide', desc: 'Trouvez instantanément n\'importe quel membre, tâche, message ou fichier avec un raccourci clavier.' },
      notifications: { title: 'Notifications centralisées',    tag: 'Alertes',         desc: 'Restez informé sans surcharge. Recevez des alertes immédiates quand vous êtes mentionné ou assigné.' },
    },
  },
  demo: {
    badge: 'Découvrir WorkGrind', headline: 'Explorer WorkGrind', subheadline: 'Indiquez-nous l’espace WorkGrind qui vous intéresse et ce que vous souhaitez découvrir.',
    form: { name: 'Nom complet', email: 'Adresse e-mail', company: 'Entreprise ou établissement (facultatif)', message: 'Que souhaitez-vous explorer ?', namePH: 'ex. Alex Martin', emailPH: 'alex@example.com', companyPH: 'Nom de l’organisation', messagePH: 'Indiquez le type d’espace et vos questions…', submit: 'Demander une présentation', submitting: 'Envoi en cours…' },
    success: { heading: 'Merci ! Nous vous contacterons bientôt.', sub: 'Nous avons reçu votre demande pour {{email}}. Notre équipe vous contactera bientôt.', home: 'Retour à l\'accueil', another: 'Soumettre une autre demande' },
  },
  contact: {
    badge: 'Contact', headline: 'Contacter WorkGrind', sub: 'Une question sur Solo, Company, École / Académie, Collège, Université, les forfaits ou l’assistance ? Écrivez-nous.',
    form: { heading: 'Envoyez-nous un message', name: 'Votre nom', email: 'Adresse e-mail', company: 'Entreprise ou établissement (facultatif)', subject: 'Sujet', message: 'Message', namePH: 'Votre nom', emailPH: 'vous@example.com', companyPH: 'Nom de l’organisation', messagePH: 'Indiquez le type d’espace et comment nous pouvons vous aider…', submit: 'Envoyer la demande', submitting: 'Envoi…', subjects: { sales: 'Forfaits et questions sur le produit', support: 'Support technique', partner: 'Opportunités de partenariat', general: 'Question générale' } },
    success: { heading: 'Message reçu !', sub: 'Merci de contacter WorkGrind. Notre équipe vous répondra dans les 2 heures ouvrables.', another: 'Envoyer un autre message' },
  },
};
