#!/usr/bin/env node

import { readdirSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { pluginRoot } from './lib/workspace.mjs';

const targets = [
  ...readdirSync(join(pluginRoot, 'scripts'))
    .filter((file) => file.endsWith('.mjs'))
    .map((file) => join(pluginRoot, 'scripts', file)),
  ...readdirSync(join(pluginRoot, 'scripts', 'lib'))
    .filter((file) => file.endsWith('.mjs'))
    .map((file) => join(pluginRoot, 'scripts', 'lib', file))
];

for (const file of targets) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log(`Syntax OK: ${targets.length} files checked.`);
