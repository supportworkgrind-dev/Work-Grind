const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const { isOrganizationFeatureAllowed } = require('../dist/middleware/organizationAccess');

/**
 * The frontend decides which pages appear (canAccessRoute); the backend decides
 * which API calls succeed (requireOrganizationFeature). If a page is shown while
 * its API refuses the same user, they see "This feature is not available for
 * your organization or role." This test keeps the two policies in step.
 */

// Page -> the any-of gate on the API it loads (backend/src/routes/*.ts).
const ROUTE_API_GATES = {
  '/tasks': ['workspaceContent', 'soloWorkspace'],
  '/projects': ['workspaceContent', 'soloWorkspace'],
  '/daily-focus': ['workspaceContent', 'soloWorkspace'],
  '/docs': ['workspaceContent', 'soloWorkspace'],
  '/files': ['workspaceContent', 'soloWorkspace', 'educationFiles'],
  '/sheets': ['workspaceContent'],
  '/whiteboard': ['workspaceContent'],
  '/chat': ['educationCommunication'],
  '/meetings': ['educationMeetings'],
  '/calendar': ['calendar'],
  '/ai': ['educationAi'],
  '/crm': ['businessCrm'],
  '/client-portal-mgmt': ['clientPortal'],
  '/analytics': ['businessAnalytics'],
  '/workflows': ['businessAutomation'],
  '/social-publishing': ['socialPublishing'],
  '/calling': ['globalCalling'],
  '/team': ['memberDirectory'],
};

const WORKSPACES = [
  ['solo', { organizationType: 'business', accountType: 'individual' }, ['owner']],
  ['business team', { organizationType: 'business', accountType: 'company' }, ['owner', 'founder', 'admin', 'manager', 'employee', 'guest']],
  ['school', { organizationType: 'school', accountType: 'company' }, ['owner', 'principal', 'admin', 'teacher', 'student', 'parent', 'manager', 'employee', 'guest']],
  ['college', { organizationType: 'college', accountType: 'company' }, ['owner', 'principal', 'admin', 'teacher', 'faculty', 'student', 'parent']],
  ['university', { organizationType: 'university', accountType: 'company' }, ['owner', 'principal', 'admin', 'dean', 'hod', 'teacher', 'student', 'parent']],
];

async function loadFrontendPolicy() {
  const file = path.resolve(__dirname, '../../frontend/src/lib/organizationAccess.ts');
  // Node runs the TypeScript module directly (type-only imports are erased).
  return import(pathToFileURL(file).href);
}

test('every page the frontend shows is allowed by the backend gate of its API', async () => {
  const frontend = await loadFrontendPolicy();
  const shownButRefused = [];
  for (const [label, organization, roles] of WORKSPACES) {
    for (const role of roles) {
      for (const [route, gates] of Object.entries(ROUTE_API_GATES)) {
        const shown = frontend.canAccessRoute(organization, role, route);
        const allowed = gates.some((feature) => isOrganizationFeatureAllowed(organization, role, feature));
        if (shown && !allowed) shownButRefused.push(`${label} ${role} ${route}`);
      }
    }
  }
  assert.deepEqual(shownButRefused, []);
});

test('legacy workspaces without stored classification resolve the same way on both sides', async () => {
  const frontend = await loadFrontendPolicy();
  const { resolveWorkspaceClassification } = require('../dist/config/organization');
  const resolved = resolveWorkspaceClassification(undefined, undefined);
  assert.deepEqual(resolved, { organizationType: 'business', accountType: 'company' });
  assert.equal(frontend.getWorkspaceExperience({}), 'company');
  assert.equal(frontend.canAccessRoute({}, 'employee', '/tasks'), true);
  assert.equal(isOrganizationFeatureAllowed(resolved, 'employee', 'workspaceContent'), true);
});

test('unknown workspace types are refused on both sides', async () => {
  const frontend = await loadFrontendPolicy();
  const { resolveWorkspaceClassification } = require('../dist/config/organization');
  assert.equal(frontend.getWorkspaceExperience({ organizationType: 'enterprise', accountType: 'company' }), null);
  assert.equal(frontend.canAccessRoute({ organizationType: 'enterprise', accountType: 'company' }, 'owner', '/tasks'), false);
  assert.equal(resolveWorkspaceClassification('enterprise', 'company').organizationType, undefined);
  assert.equal(isOrganizationFeatureAllowed({ organizationType: 'enterprise', accountType: 'company' }, 'owner', 'workspaceContent'), false);
  assert.equal(isOrganizationFeatureAllowed({ organizationType: undefined, accountType: 'company' }, 'owner', 'workspaceContent'), false);
});
