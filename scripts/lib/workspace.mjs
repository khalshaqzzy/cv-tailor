import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const thisFile = fileURLToPath(import.meta.url);
export const pluginRoot = resolve(dirname(thisFile), '..', '..');

export function parseArgs(argv = process.argv.slice(2)) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      result._.push(arg);
      continue;
    }

    const eq = arg.indexOf('=');
    if (eq !== -1) {
      result[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      i += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

export function resolveWorkspace(value = '.') {
  return resolve(value);
}

export function runtimePaths(workspace = '.') {
  const root = resolveWorkspace(workspace);
  const base = join(root, '.cv-tailor');
  return {
    workspace: root,
    base,
    sources: join(base, 'sources'),
    reports: join(base, 'reports'),
    output: join(base, 'output'),
    runs: join(base, 'runs'),
    profile: join(base, 'profile.yml'),
    sourceRegistry: join(base, 'source-registry.json'),
    storyBank: join(base, 'story-bank.md'),
    gitignore: join(base, '.gitignore')
  };
}

export function ensureRuntimeDirs(workspace = '.') {
  const paths = runtimePaths(workspace);
  for (const dir of [paths.base, paths.sources, paths.reports, paths.output, paths.runs]) {
    mkdirSync(dir, { recursive: true });
  }
  return paths;
}

export function copyTemplateIfMissing(templateRelativePath, destinationPath) {
  if (existsSync(destinationPath)) return false;
  const source = join(pluginRoot, templateRelativePath);
  const body = readFileSync(source, 'utf8');
  writeFileSync(destinationPath, body, 'utf8');
  return true;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'untitled';
}

export function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fileUrl(path) {
  return pathToFileURL(path).href;
}

export function normalizeTextForATS(text) {
  const replacements = {};
  const bump = (key) => {
    replacements[key] = (replacements[key] || 0) + 1;
  };

  let output = String(text ?? '');
  output = output.replace(/\u2014/g, () => { bump('em-dash'); return '-'; });
  output = output.replace(/\u2013/g, () => { bump('en-dash'); return '-'; });
  output = output.replace(/[\u201C\u201D\u201E\u201F]/g, () => { bump('smart-double-quote'); return '"'; });
  output = output.replace(/[\u2018\u2019\u201A\u201B]/g, () => { bump('smart-single-quote'); return "'"; });
  output = output.replace(/\u2026/g, () => { bump('ellipsis'); return '...'; });
  output = output.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, () => { bump('zero-width'); return ''; });
  output = output.replace(/\u00A0/g, () => { bump('nbsp'); return ' '; });

  return { text: output, replacements };
}

export function normalizeHtmlTextForATS(html) {
  const replacements = {};
  const bump = (key, n = 1) => {
    replacements[key] = (replacements[key] || 0) + n;
  };

  const masks = [];
  const masked = String(html ?? '').replace(
    /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (match) => {
      const token = `\u0000MASK${masks.length}\u0000`;
      masks.push(match);
      return token;
    }
  );

  let output = '';
  let index = 0;
  while (index < masked.length) {
    const tagStart = masked.indexOf('<', index);
    if (tagStart === -1) {
      output += sanitize(masked.slice(index));
      break;
    }
    output += sanitize(masked.slice(index, tagStart));
    const tagEnd = masked.indexOf('>', tagStart);
    if (tagEnd === -1) {
      output += masked.slice(tagStart);
      break;
    }
    output += masked.slice(tagStart, tagEnd + 1);
    index = tagEnd + 1;
  }

  const restored = output.replace(/\u0000MASK(\d+)\u0000/g, (_, maskIndex) => masks[Number(maskIndex)]);
  return { text: restored, replacements };

  function sanitize(text) {
    const normalized = normalizeTextForATS(text);
    for (const [key, count] of Object.entries(normalized.replacements)) bump(key, count);
    return normalized.text;
  }
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
