/**
 * rebrand.js — TeamFlow → WorkGrind bulk replacement script
 * Run: node scripts/rebrand.js
 */
const fs   = require('fs');
const path = require('path');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !['node_modules', '.next', 'dist', '.git'].includes(e.name)) {
      files.push(...walk(full));
    } else if (e.isFile() && /\.(ts|tsx|js|mjs|json|md|html|css|svg)$/.test(e.name)) {
      files.push(full);
    }
  }
  return files;
}

// ── Replacement pairs  [regex, replacement string] ────────────────────────────
// Ordered: specific → general to avoid double-replacing
const REPLACEMENTS = [
  // Logo component import + usage
  [/import \{ TeamFlowLogo \} from '@\/components\/common\/TeamFlowLogo'/g,
   "import { WorkGrindLogo } from '@/components/common/WorkGrindLogo'"],
  [/import \{ TeamFlowLogo, TeamFlowLogoProps \} from '@\/components\/common\/TeamFlowLogo'/g,
   "import { WorkGrindLogo, WorkGrindLogoProps } from '@/components/common/WorkGrindLogo'"],
  [/<TeamFlowLogo /g, '<WorkGrindLogo '],
  [/<\/TeamFlowLogo>/g, '</WorkGrindLogo>'],

  // localStorage keys (use workgrind_ prefix)
  [/'teamflow_access_token'/g,      "'workgrind_access_token'"],
  [/'teamflow_refresh_token'/g,     "'workgrind_refresh_token'"],
  [/'teamflow_user'/g,              "'workgrind_user'"],
  [/'teamflow_theme'/g,             "'workgrind_theme'"],
  [/'teamflow_client_token'/g,      "'workgrind_client_token'"],
  [/'teamflow_client_user'/g,       "'workgrind_client_user'"],
  [/'teamflow_super_admin_token'/g, "'workgrind_super_admin_token'"],
  [/'teamflow_super_admin_user'/g,  "'workgrind_super_admin_user'"],

  // teamflow-icon.svg → workgrind-icon.svg
  [/teamflow-icon\.svg/g, 'workgrind-icon.svg'],

  // All remaining user-visible TeamFlow → WorkGrind
  [/TeamFlow/g, 'WorkGrind'],
  [/TEAMFLOW/g, 'WORKGRIND'],
  [/teamflow(?![-_\/])/g, 'workgrind'],
];

// Roots to process
const ROOTS = [
  path.join(__dirname, '../src'),
  path.join(__dirname, '../public'),
];

// Only skip these dirs
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.git']);

function processFile(filePath) {
  const orig = fs.readFileSync(filePath, 'utf8');
  let content = orig;
  for (const [from, to] of REPLACEMENTS) {
    content = content.replace(from, to);
  }
  if (content !== orig) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

let total = 0, changed = 0;
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  const files = walk(root);
  for (const f of files) {
    total++;
    if (processFile(f)) {
      changed++;
      console.log('  ✓', f.replace(path.join(__dirname, '..') + path.sep, '').replace(/\\/g, '/'));
    }
  }
}
console.log(`\nProcessed ${total} files, updated ${changed}.`);
