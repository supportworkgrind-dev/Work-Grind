/**
 * Urdu interface text for every namespace. Imported on demand (see
 * ../../index.tsx) so English visitors never download it.
 */
import type { Mirror } from '../../core';
import type { NamespaceMessages, NamespaceName } from '..';
import { academicUr } from './academic';
import { aiUr } from './ai';
import { analyticsUr } from './analytics';
import { authUr } from './auth';
import { billingUr } from './billing';
import { calendarUr } from './calendar';
import { callingUr } from './calling';
import { chatUr } from './chat';
import { clientPortalUr } from './clientPortal';
import { commonUr } from './common';
import { crmUr } from './crm';
import { dailyFocusUr } from './dailyFocus';
import { dashboardUr } from './dashboard';
import { docsUr } from './docs';
import { filesUr } from './files';
import { helpUr } from './help';
import { landingUr } from './landing';
import { legalUr } from './legal';
import { meetingsUr } from './meetings';
import { moderationUr } from './moderation';
import { projectsUr } from './projects';
import { publicPagesUr } from './publicPages';
import { settingsUr } from './settings';
import { sheetsUr } from './sheets';
import { shellUr } from './shell';
import { socialPublishingUr } from './socialPublishing';
import { tasksUr } from './tasks';
import { teamUr } from './team';
import { whiteboardUr } from './whiteboard';
import { workflowsUr } from './workflows';

export const appMessagesUr = {
  academic: academicUr,
  ai: aiUr,
  analytics: analyticsUr,
  auth: authUr,
  billing: billingUr,
  calendar: calendarUr,
  calling: callingUr,
  chat: chatUr,
  clientPortal: clientPortalUr,
  common: commonUr,
  crm: crmUr,
  dailyFocus: dailyFocusUr,
  dashboard: dashboardUr,
  docs: docsUr,
  files: filesUr,
  help: helpUr,
  landing: landingUr,
  legal: legalUr,
  meetings: meetingsUr,
  moderation: moderationUr,
  projects: projectsUr,
  publicPages: publicPagesUr,
  settings: settingsUr,
  sheets: sheetsUr,
  shell: shellUr,
  socialPublishing: socialPublishingUr,
  tasks: tasksUr,
  team: teamUr,
  whiteboard: whiteboardUr,
  workflows: workflowsUr,
} satisfies { [N in NamespaceName]: Mirror<NamespaceMessages<N>> };
