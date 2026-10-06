import type { Translations } from './en';

export const fr: Translations = {
  dir: 'ltr',
  nav: { signIn: 'Se connecter', getStarted: 'Commencer', openWorkspace: 'Ouvrir l\'espace', product: 'Produit', solutions: 'Solutions', features: 'Fonctionnalités', ai: 'IA', security: 'Sécurité', backToHome: '← Retour à l\'accueil' },
  footer: { tagline: 'Un espace de travail intelligent pour les équipes modernes.', company: 'Entreprise', security: 'Sécurité', about: 'À propos', features: 'Fonctionnalités', demo: 'Démo', contact: 'Contact', privacy: 'Politique de confidentialité', terms: 'Conditions d\'utilisation', rights: '© {{year}} WorkGrind. Tous droits réservés.', trial: 'Essai gratuit de 7 jours · Sans engagement · Pour les équipes modernes' },
  common: { submit: 'Soumettre', send: 'Envoyer', cancel: 'Annuler', loading: 'Chargement…', optional: 'optionnel', required: 'requis', errorGeneric: 'Une erreur est survenue. Veuillez réessayer.', backToHome: 'Retour à l\'accueil', startFreeTrial: 'Démarrer l\'essai gratuit', learnMore: 'En savoir plus', close: 'Fermer' },
  about: {
    badge: 'Notre mission', headline1: 'Réimaginer comment les', headline2: 'organisations', headline3: 'modernes travaillent ensemble',
    subheadline: 'WorkGrind a été créé avec un seul impératif : éliminer la fragmentation logicielle et restaurer la concentration profonde des équipes du monde entier.',
    stats: { workspaces: 'Espaces créés', messages: 'Messages envoyés', tasks: 'Tâches accomplies', uptime: 'SLA de disponibilité' },
    story: { heading: 'L\'histoire de WorkGrind', p1: 'Dans le bureau numérique d\'aujourd\'hui, les employés passent jusqu\'à 30 % de leur journée à basculer entre des outils déconnectés — messageries, tableaux de tâches, clients vidéo.', p2: 'Ce changement de contexte constant entraîne une communication fragmentée, des délais manqués et l\'épuisement. WorkGrind résout ce problème.' },
    pillars: {
      sync:     { title: 'Synchronisation en temps réel',  desc: 'Propulsé par Socket.io et MongoDB pour une latence nulle sur le chat, les tâches et la présence.' },
      security: { title: 'Sécurité d\'entreprise',          desc: 'Isolation multi-tenant au niveau des lignes, sessions chiffrées et contrôles RBAC stricts.' },
      scale:    { title: 'Échelle mondiale',                desc: 'Conçu pour les équipes hybrides, distantes et multi-bureaux dès le premier jour.' },
    },
    workspace: { heading: 'Tout dans un seul espace', subheading: '12 modules intégrés remplaçant 12 abonnements SaaS séparés.' },
    cta: { badge: 'Direction exécutive', name: 'RANA MOEZ', role: 'Architecte produit & ingénieur systèmes principal', button: 'Commencer gratuitement' },
  },
  features: {
    badge: 'Ensemble complet de fonctionnalités', headline: 'Tous les outils dont votre équipe a besoin', subheadline: 'Découvrez comment WorkGrind remplace les applications déconnectées par une plateforme unique.',
    cta: { heading: 'Prêt à tester ces fonctionnalités ?', sub: 'Créez votre espace de travail en moins de 30 secondes, sans carte bancaire.' },
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
    badge: 'Présentation personnalisée', headline: 'Réservez une démo WorkGrind', subheadline: 'Parlez-nous de votre équipe et nous programmerons une présentation personnalisée 1-pour-1.',
    form: { name: 'Nom complet', email: 'Email professionnel', company: 'Nom de l\'entreprise', message: 'Que souhaitez-vous explorer ?', namePH: 'ex. Alex Martin', emailPH: 'alex@entreprise.com', companyPH: 'Acme Corp', messagePH: 'Dites-nous ce que vous souhaitez voir…', submit: 'Demander une démo', submitting: 'Envoi en cours…' },
    success: { heading: 'Merci ! Nous vous contacterons bientôt.', sub: 'Nous avons reçu votre demande pour {{email}}. Notre équipe vous contactera bientôt.', home: 'Retour à l\'accueil', another: 'Soumettre une autre demande' },
  },
  contact: {
    badge: 'Entrer en contact', headline: 'Contacter WorkGrind', sub: 'Des questions sur le déploiement ou les plans entreprise ? Notre équipe est là pour vous aider.',
    form: { heading: 'Envoyez-nous un message', name: 'Votre nom', email: 'Email professionnel', company: 'Entreprise', subject: 'Sujet', message: 'Message', namePH: 'Sarah Jenkins', emailPH: 'sarah@entreprise.com', companyPH: 'Apex Technologies', messagePH: 'Parlez-nous de votre équipe et de vos besoins…', submit: 'Envoyer la demande', submitting: 'Envoi…', subjects: { sales: 'Ventes et démo entreprise', support: 'Support technique', partner: 'Opportunités de partenariat', general: 'Question générale' } },
    success: { heading: 'Message reçu !', sub: 'Merci de contacter WorkGrind. Notre équipe vous répondra dans les 2 heures ouvrables.', another: 'Envoyer un autre message' },
  },
};
