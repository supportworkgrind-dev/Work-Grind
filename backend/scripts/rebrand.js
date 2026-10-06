/**
 * rebrand.js — WorkGrind → WorkGrind backend rebrand
 * Run: node scripts/rebrand.js
 */
const fs   = require('fs');
const path = require('path');

function walk(dir) {
  let files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !['node_modules', 'dist', '.git'].includes(e.name)) {
      files.push(...walk(full));
    } else if (e.isFile() && /\.(ts|js|json|md|html)$/.test(e.name)) {
      files.push(full);
    }
  }
  return files;
}

const REPLACEMENTS = [
  // User-facing text replacements
  [/WorkGrind/g,  'WorkGrind'],
  [/WORKGRIND/g,  'WORKGRIND'],
  // teamflow as part of domain/email refs
  [/teamflow\.app/g, 'workgrind.app'],
  [/teamflow\.com/g, 'workgrind.app'],
  // teamflow as package name in package.json — keep short safe value
  [/"name": "workgrind-backend"/, '"name": "workgrind-backend"'],
  // Seed data and admin references
  [/teamflow\.io/g, 'workgrind.app'],
];

const ROOT = path.join(__dirname, '..');
const files = walk(ROOT);
let changed = 0;
for (const f of files) {
  const orig = fs.readFileSync(f, 'utf8');
  let content = orig;
  for (const [from, to] of REPLACEMENTS) content = content.replace(from, to);
  if (content !== orig) {
    fs.writeFileSync(f, content, 'utf8');
    changed++;
    console.log('  ✓', f.replace(ROOT + path.sep, '').replace(/\\/g, '/'));
  }
}
console.log(`\nUpdated ${changed} files.`);
