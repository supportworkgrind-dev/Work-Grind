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
  // Education lists include roles kept only for existing members (manager, employee, guest; principal in universities).
  ['school', { organizationType: 'school', accountType: 'company' }, ['owner', 'principal', 'admin', 'teacher', 'student', 'parent', 'manager', 'employee', 'guest']],
  ['college', { organizationType: 'college', accountType: 'company' }, ['owner', 'principal', 'admin', 'hod', 'lecturer', 'teacher', 'faculty', 'student', 'parent', 'employee']],
  ['university', { organizationType: 'university', accountType: 'company' }, ['owner', 'vice_chancellor', 'principal', 'admin', 'dean', 'hod', 'professor', 'lecturer', 'teacher', 'student', 'parent', 'manager', 'employee', 'guest']],
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

test('the frontend role catalog is the backend catalog for every workspace type', async () => {
  const frontend = await loadFrontendPolicy();
  const { WORKSPACE_ROLE_CATALOG } = require('../dist/config/organization');
  const pairs = [['company', 'business'], ['school', 'school'], ['college', 'college'], ['university', 'university']];
  for (const [frontendKey, backendKey] of pairs) {
    const front = frontend.WORKSPACE_ROLE_CATALOG[frontendKey];
    const back = WORKSPACE_ROLE_CATALOG[backendKey];
    for (const field of ['assignable', 'elevated', 'legacy', 'joinRoles', 'defaultJoinRole']) {
      assert.deepEqual(front[field], back[field], `${backendKey} ${field}`);
    }
  }
});

test('role menus offer exactly the roles the API lets each member assign', async () => {
  const frontend = await loadFrontendPolicy();
  const { getAssignableOrganizationRoles, resolveDefaultJoinRole } = require('../dist/config/organization');
  const mismatches = [];
  for (const [label, organization, roles] of WORKSPACES) {
    for (const role of roles) {
      for (const owns of [true, false]) {
        if (owns && role !== 'owner') continue;
        // The menu is shown to members who may manage the directory; the API is the authority.
        const shown = frontend.getAssignableRoles(organization, role, owns);
        const accepted = isOrganizationFeatureAllowed(organization, role, 'memberDirectory')
          ? getAssignableOrganizationRoles(role, organization.organizationType, organization.accountType, owns)
          : [];
        if (JSON.stringify(shown) !== JSON.stringify(accepted)) mismatches.push(`${label} ${role}${owns ? ' (owner)' : ''}: ${shown} vs ${accepted}`);
      }
    }
    for (const saved of [undefined, 'employee', 'guest', 'student', 'parent', 'principal']) {
      const front = frontend.resolveDefaultJoinRole(organization, saved);
      const back = resolveDefaultJoinRole(organization.organizationType, saved, organization.accountType);
      if (front !== back) mismatches.push(`${label} default for ${saved}: ${front} vs ${back}`);
    }
  }
  assert.deepEqual(mismatches, []);
});

test('feature checks agree on both sides for every role of every workspace type', async () => {
  const frontend = await loadFrontendPolicy();
  const { isWorkspaceAdministrator } = require('../dist/config/organization');
  const features = ['memberDirectory', 'workspaceSettings', 'academic', 'academicAdmin', 'businessCrm', 'clientPortal', 'socialPublishing', 'soloWorkspace'];
  const differences = [];
  for (const [label, organization, roles] of WORKSPACES) {
    for (const role of roles) {
      for (const feature of features) {
        const front = frontend.canAccessOrganizationFeature(organization, role, feature);
        // Settings changes also pass requireWorkspaceAdministrator (backend/src/routes/companies.ts).
        const back = isOrganizationFeatureAllowed(organization, role, feature) &&
          (feature !== 'workspaceSettings' || isWorkspaceAdministrator(role, organization.organizationType));
        if (front !== back) differences.push(`${label} ${role} ${feature}: frontend ${front}, backend ${back}`);
      }
    }
  }
  // Education managers (an earlier business role) keep backend directory access that the menu does not show.
  assert.deepEqual(differences.filter((entry) => !/^(school|university) manager memberDirectory/.test(entry)), []);
});
