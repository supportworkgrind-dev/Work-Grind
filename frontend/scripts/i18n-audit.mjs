#!/usr/bin/env node
/**
 * Lists user-visible English text that is still hardcoded in TSX instead of
 * coming from the i18n dictionaries: JSX text, and string literals passed to
 * text-bearing attributes (placeholder, title, aria-label, alt, label, …).
 *
 *   node scripts/i18n-audit.mjs            summary per file, largest first
 *   node scripts/i18n-audit.mjs --details  every finding with its line
 *   node scripts/i18n-audit.mjs --json     machine-readable report
 *
 * It reports; it does not decide. Brand names, code samples and admin-only
 * screens can legitimately stay as they are (see EXCLUDED below).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');

// Screens outside the member/visitor experience, kept in English on purpose.
export const EXCLUDED = [
  'src/app/admin-portal/',
  'src/app/admin/',
  'src/components/admin/',
  'src/app/(app)/developer/',
  'src/components/layout/DeveloperShell.tsx',
];

const TEXT_ATTRIBUTES = new Set([
  'placeholder', 'title', 'aria-label', 'alt', 'label', 'aria-description',
  'description', 'emptyMessage', 'helperText', 'tooltip', 'heading', 'subheading',
  'confirmLabel', 'cancelLabel', 'publishingLabel',
]);
// Object properties that hold display text in option lists, nav configs and label maps.
const TEXT_PROPERTIES = new Set([
  'label', 'title', 'description', 'desc', 'message', 'placeholder', 'subtitle', 'heading',
  'helper', 'hint', 'tooltip', 'empty', 'emptyState', 'cta', 'badge', 'caption', 'summary',
]);
// Calls whose first argument is shown to the person.
const TEXT_CALLS = /^(toast|showToast|notify|setError|setErrorMessage|setMessage|setNotice|setStatus|setStatusMessage|setSuccess|setSuccessMessage|setFeedback|setToast|alert|confirm|setLoadError|setSaveError|setFormError|setInfo|setWarning)$/;
// Words that read the same in every language here.
const NEUTRAL = /^(WorkGrind|Tavro|Tavro AI|CRM|AI|API|OK|PDF|CSV|URL|ID|PIN|2FA|MFA|LinkedIn|YouTube|Google|Microsoft|GitHub|Polar|LiveKit|Excel|Markdown|JSON|Wi-Fi|N\/A|vs\.?|[A-Z]{1,4}|[\d\s.,:%+\-–—/×·•|()[\]#@&*!?'"$€£¥₨→←↑↓…]+)$/;

function isUserText(raw) {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text || !/[A-Za-z]{2,}/.test(text)) return false;
  if (NEUTRAL.test(text)) return false;
  // Identifiers, class lists, paths and URLs are not prose.
  if (/^[a-z][\w-]*(\.[\w-]+)+$/.test(text)) return false;
  if (/^(https?:|mailto:|\/|#|\.\/)/.test(text)) return false;
  return true;
}

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // The dictionaries themselves are the translated text.
      if (full !== path.join(srcDir, 'lib', 'i18n')) walkFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

export function auditFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const findings = [];
  const add = (node, text, kind) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    findings.push({ line: line + 1, kind, text: text.replace(/\s+/g, ' ').trim().slice(0, 120) });
  };
  const visit = (node) => {
    if (ts.isJsxText(node) && isUserText(node.getText(sf))) {
      add(node, node.getText(sf), 'text');
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (TEXT_ATTRIBUTES.has(name)) {
        const init = node.initializer;
        const literal = ts.isStringLiteral(init)
          ? init
          : ts.isJsxExpression(init) && init.expression && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression))
            ? init.expression
            : null;
        if (literal && isUserText(literal.text)) add(node, literal.text, `attr:${name}`);
      }
    } else if (ts.isPropertyAssignment(node) && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) {
      const name = node.name.getText(sf).replace(/['"]/g, '');
      const text = node.initializer.text;
      const displayName = name === 'name' && /^[A-Z][A-Za-z]+(\s[A-Za-z&/]+)*$/.test(text);
      if ((TEXT_PROPERTIES.has(name) || displayName) && isUserText(text)) add(node, text, `prop:${name}`);
    } else if (ts.isCallExpression(node) && node.arguments.length) {
      const callee = node.expression.getText(sf).split('.').pop();
      const first = node.arguments[0];
      if (callee && TEXT_CALLS.test(callee) &&
        (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first) || ts.isTemplateExpression(first))) {
        const text = ts.isTemplateExpression(first) ? first.getText(sf).slice(1, -1) : first.text;
        if (isUserText(text)) add(node, text, `call:${callee}`);
      }
    } else if (ts.isJsxExpression(node) && node.expression &&
      (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression)) &&
      node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      isUserText(node.expression.text)) {
      add(node, node.expression.text, 'text');
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

export function auditProject() {
  const report = [];
  for (const file of walkFiles(srcDir)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const findings = auditFile(file);
    report.push({ file: relative, excluded: EXCLUDED.some((prefix) => relative.startsWith(prefix)), findings });
  }
  return report.sort((a, b) => b.findings.length - a.findings.length);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditProject();
  const args = new Set(process.argv.slice(2));
  if (args.has('--json')) {
    process.stdout.write(JSON.stringify(report, null, 2));
  } else {
    let inScope = 0;
    let excluded = 0;
    for (const entry of report) {
      if (!entry.findings.length) continue;
      if (entry.excluded) excluded += entry.findings.length; else inScope += entry.findings.length;
      console.log(`${String(entry.findings.length).padStart(5)}  ${entry.file}${entry.excluded ? '  (excluded)' : ''}`);
      if (args.has('--details')) {
        for (const finding of entry.findings) console.log(`         ${finding.line}: [${finding.kind}] ${finding.text}`);
      }
    }
    console.log(`\nHardcoded strings in scope: ${inScope}; in excluded screens: ${excluded}`);
  }
}
