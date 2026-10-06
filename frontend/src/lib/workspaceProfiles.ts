export const WORKSPACE_PROFILES = [
  {
    id: 'developer', label: 'Software Engineer / Developer', shortLabel: 'Developer',
    description: 'Technical focus, graphite surfaces, and WorkGrind evergreen accents.',
    baseTheme: 'graphite', swatches: ['#111315', '#1b1e21', '#91ac95'], projectColor: '#38b878',
    starterProject: 'Engineering Roadmap', starterDescription: 'Plan releases, technical milestones, and engineering work.',
  },
  {
    id: 'creative', label: 'Designer / Creative', shortLabel: 'Creative',
    description: 'A warm editorial canvas with restrained terracotta accents.',
    baseTheme: 'light', swatches: ['#f5f3ed', '#fffefa', '#294a38'], projectColor: '#c64768',
    starterProject: 'Creative Production Board', starterDescription: 'Coordinate briefs, concepts, reviews, and final creative assets.',
  },
  {
    id: 'marketing', label: 'Marketing', shortLabel: 'Marketing',
    description: 'A warm, focused campaign workspace with evergreen accents.',
    baseTheme: 'light', swatches: ['#f5f3ed', '#fffefa', '#294a38'], projectColor: '#c94d27',
    starterProject: 'Campaign Calendar', starterDescription: 'Organize launches, content, channels, and campaign approvals.',
  },
  {
    id: 'sales', label: 'Sales', shortLabel: 'Sales',
    description: 'A polished, pipeline-ready workspace with evergreen accents.',
    baseTheme: 'slate', swatches: ['#edf1f6', '#ffffff', '#294a38'], projectColor: '#16856a',
    starterProject: 'Sales Pipeline', starterDescription: 'Coordinate prospecting, deal follow-ups, and revenue milestones.',
  },
  {
    id: 'project_manager', label: 'Project Manager', shortLabel: 'Project Management',
    description: 'Structured surfaces and focused evergreen accents for delivery work.',
    baseTheme: 'slate', swatches: ['#edf1f6', '#ffffff', '#294a38'], projectColor: '#3867b7',
    starterProject: 'Project Delivery Plan', starterDescription: 'Track milestones, owners, dependencies, and delivery risks.',
  },
  {
    id: 'freelancer', label: 'Freelancer', shortLabel: 'Freelancer',
    description: 'A flexible, quiet workspace with adaptable evergreen accents.',
    baseTheme: 'light', swatches: ['#f5f3ed', '#fffefa', '#294a38'], projectColor: '#168b83',
    starterProject: 'Client Deliverables', starterDescription: 'Organize client milestones, feedback, and deliverable reviews.',
  },
  {
    id: 'executive', label: 'Business Owner / Founder', shortLabel: 'Executive',
    description: 'Premium graphite surfaces with restrained evergreen accents.',
    baseTheme: 'graphite', swatches: ['#111315', '#1b1e21', '#91ac95'], projectColor: '#c6a35b',
    starterProject: 'Growth & Operations', starterDescription: 'Bring company priorities, operating goals, and key initiatives together.',
  },
  {
    id: 'student', label: 'Student', shortLabel: 'Student',
    description: 'A clean learning workspace with quiet evergreen accents.',
    baseTheme: 'light', swatches: ['#f5f3ed', '#fffefa', '#294a38'], projectColor: '#3187b8',
    starterProject: 'Study Plan & Projects', starterDescription: 'Plan coursework, study sessions, group work, and due dates.',
  },
  {
    id: 'professional', label: 'Other / Professional', shortLabel: 'Professional',
    description: 'The balanced WorkGrind default with a warm neutral palette.',
    baseTheme: 'light', swatches: ['#f5f3ed', '#fffefa', '#294a38'], projectColor: '#4f46e5',
    starterProject: 'Product Roadmap', starterDescription: 'Organize priorities, milestones, and cross-functional work.',
  },
] as const;

export type WorkspaceProfile = (typeof WORKSPACE_PROFILES)[number]['id'];

export function getWorkspaceProfile(profile: unknown) {
  return WORKSPACE_PROFILES.find((item) => item.id === profile) ?? WORKSPACE_PROFILES[8];
}

export function getWorkspaceProfileForTheme(theme: string): WorkspaceProfile | undefined {
  return WORKSPACE_PROFILES.find((profile) => profile.id === theme)?.id;
}