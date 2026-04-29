#!/usr/bin/env node

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { parseArgs, pluginRoot, runtimePaths } from './lib/workspace.mjs';

const args = parseArgs();
const workspace = args.workspace || '.';
const paths = runtimePaths(workspace);
const checks = [];

function add(name, pass, fix = '') {
  checks.push({ name, pass, fix });
}

function nodeMajor() {
  return Number.parseInt(process.versions.node.split('.')[0], 10);
}

add('Node.js >= 18', nodeMajor() >= 18, 'Install Node.js 18 or newer.');
add('plugin manifest', existsSync(join(pluginRoot, '.codex-plugin', 'plugin.json')), 'Missing .codex-plugin/plugin.json.');
add('cv-tailor skill', existsSync(join(pluginRoot, 'skills', 'cv-tailor', 'SKILL.md')), 'Missing skills/cv-tailor/SKILL.md.');
add('CV template', existsSync(join(pluginRoot, 'templates', 'cv-template.html')), 'Missing templates/cv-template.html.');
add('tailored CV schema', existsSync(join(pluginRoot, 'schemas', 'tailored-cv.schema.json')), 'Missing schemas/tailored-cv.schema.json.');

const fontsDir = join(pluginRoot, 'fonts');
const fontsReady = existsSync(fontsDir) && readdirSync(fontsDir).some((file) => file.endsWith('.woff2'));
add('PDF fonts', fontsReady, 'Copy Space Grotesk and DM Sans .woff2 files into fonts/.');

try {
  const { chromium } = await import('playwright');
  add('Playwright import', Boolean(chromium), 'Run npm install.');
  add('Playwright Chromium installed', existsSync(chromium.executablePath()), 'Run npx playwright install chromium.');
} catch {
  add('Playwright import', false, 'Run npm install.');
}

if (args.workspace) {
  add('workspace .cv-tailor exists', existsSync(paths.base), 'Run npm run init -- --workspace <path>.');
  add('workspace profile.yml', existsSync(paths.profile), 'Run npm run init -- --workspace <path>, then fill profile.yml.');
  add('workspace source-registry.json', existsSync(paths.sourceRegistry), 'Run npm run init -- --workspace <path>.');
  add('workspace story-bank.md', existsSync(paths.storyBank), 'Run npm run init -- --workspace <path>.');
}

let failures = 0;
for (const check of checks) {
  const marker = check.pass ? 'OK' : 'FAIL';
  console.log(`${marker} ${check.name}`);
  if (!check.pass) {
    failures += 1;
    if (check.fix) console.log(`  fix: ${check.fix}`);
  }
}

if (failures > 0) {
  console.log(`\n${failures} issue(s) found.`);
  process.exit(1);
}

console.log('\nAll checks passed.');
