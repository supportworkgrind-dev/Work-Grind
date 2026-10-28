/**
 * Interface text for the signed-in app and public site, one module per area.
 * English is the source of truth; every namespace must define Urdu for every
 * English key in ./ur (enforced by the Mirror types there). Other languages
 * fall back to English until they are translated.
 */
import { common } from './common';
import { shell } from './shell';
import { auth } from './auth';
import { dashboard } from './dashboard';
import { dailyFocus } from './dailyFocus';
import { tasks } from './tasks';
import { projects } from './projects';
import { calendar } from './calendar';
import { workflows } from './workflows';
import { chat } from './chat';
import { meetings } from './meetings';
import { calling } from './calling';
import { whiteboard } from './whiteboard';
import { docs } from './docs';
import { files } from './files';
import { crm } from './crm';
import { clientPortal } from './clientPortal';
import { analytics } from './analytics';
import { sheets } from './sheets';
import { socialPublishing } from './socialPublishing';
import { team } from './team';
import { moderation } from './moderation';
import { settings } from './settings';
import { billing } from './billing';
import { ai } from './ai';
import { academic } from './academic';
import { landing } from './landing';
import { publicPages } from './publicPages';
import { help } from './help';
import { legal } from './legal';

const namespaces = {
  common,
  shell,
  auth,
  dashboard,
  dailyFocus,
  tasks,
  projects,
  calendar,
  workflows,
  chat,
  meetings,
  calling,
  whiteboard,
  docs,
  files,
  crm,
  clientPortal,
  analytics,
  sheets,
  socialPublishing,
  team,
  moderation,
  settings,
  billing,
  ai,
  academic,
  landing,
  publicPages,
  help,
  legal,
} as const;

type Namespaces = typeof namespaces;
export type NamespaceName = keyof Namespaces;
export type NamespaceMessages<N extends NamespaceName> = Namespaces[N]['en'];

export const appMessagesEn = Object.fromEntries(
  Object.entries(namespaces).map(([name, messages]) => [name, messages.en]),
) as { [N in NamespaceName]: Namespaces[N]['en'] };
export const namespaceNames = Object.keys(namespaces) as NamespaceName[];
