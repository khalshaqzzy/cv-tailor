#!/usr/bin/env node

import { existsSync, writeFileSync } from 'fs';
import { copyTemplateIfMissing, ensureRuntimeDirs, parseArgs } from './lib/workspace.mjs';

const args = parseArgs();
const workspace = args.workspace || '.';
const paths = ensureRuntimeDirs(workspace);

const created = [];

if (copyTemplateIfMissing('templates/profile.example.yml', paths.profile)) {
  created.push(paths.profile);
}

if (copyTemplateIfMissing('templates/source-registry.example.json', paths.sourceRegistry)) {
  created.push(paths.sourceRegistry);
}

if (copyTemplateIfMissing('templates/story-bank.template.md', paths.storyBank)) {
  created.push(paths.storyBank);
}

if (!existsSync(paths.gitignore)) {
  writeFileSync(paths.gitignore, '*\n!.gitignore\n', 'utf8');
  created.push(paths.gitignore);
}

console.log(JSON.stringify({
  status: 'ok',
  workspace: paths.workspace,
  runtimeDir: paths.base,
  created
}, null, 2));
