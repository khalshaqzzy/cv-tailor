#!/usr/bin/env node

import { copyFileSync, existsSync } from 'fs';
import { basename, join, resolve } from 'path';
import { ensureRuntimeDirs, parseArgs, readJson, slugify, writeJson } from './lib/workspace.mjs';

const args = parseArgs();
const workspace = args.workspace || '.';
const paths = ensureRuntimeDirs(workspace);

const type = args.type || 'manual-note';
const title = args.title || args._[0];
const inputPath = args.path || args.file || null;
const url = args.url || null;
const id = args.id || `${type}-${slugify(title || url || inputPath || Date.now())}`;
const facts = String(args.facts || '')
  .split('|')
  .map((item) => item.trim())
  .filter(Boolean);

if (!title) {
  console.error('Usage: node scripts/add-source.mjs --workspace <path> --title <title> [--id <id>] [--type cv|github|linkedin|project|...] [--path <file>] [--url <url>] [--facts "fact one|fact two"]');
  process.exit(1);
}

const registry = existsSync(paths.sourceRegistry)
  ? readJson(paths.sourceRegistry)
  : { version: 1, sources: [] };

if (!Array.isArray(registry.sources)) registry.sources = [];

const duplicate = registry.sources.find((source) => (
  source.id === id ||
  (url && source.url === url) ||
  (inputPath && source.path && source.path.endsWith(basename(inputPath)))
));

if (duplicate && !args.force) {
  console.log(JSON.stringify({
    status: 'duplicate',
    message: 'Source already exists. Use --force to replace by id.',
    source: duplicate
  }, null, 2));
  process.exit(0);
}

let storedPath = null;
if (inputPath) {
  const absoluteInput = resolve(inputPath);
  if (!existsSync(absoluteInput)) {
    console.error(`Source file not found: ${absoluteInput}`);
    process.exit(1);
  }
  const targetName = `${id}-${basename(inputPath).replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const targetPath = join(paths.sources, targetName);
  copyFileSync(absoluteInput, targetPath);
  storedPath = `.cv-tailor/sources/${targetName}`;
}

const entry = {
  id,
  type,
  title,
  path: storedPath,
  url,
  notes: args.notes || '',
  facts
};

if (duplicate && args.force) {
  const index = registry.sources.findIndex((source) => source.id === duplicate.id);
  registry.sources[index] = entry;
} else {
  registry.sources.push(entry);
}

writeJson(paths.sourceRegistry, registry);
console.log(JSON.stringify({ status: 'ok', source: entry }, null, 2));
