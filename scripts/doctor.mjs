#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
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

  if (existsSync(paths.profile)) {
    const profile = readFileSafe(paths.profile);
    add('workspace profile has candidate name', /full_name:\s*["']?[^"'\s]/.test(profile), 'Fill candidate.full_name in .cv-tailor/profile.yml.');
    add('workspace profile has candidate email', /email:\s*["']?[^"'\s]/.test(profile), 'Fill candidate.email in .cv-tailor/profile.yml.');
  }

  if (existsSync(paths.sourceRegistry)) {
    try {
      const registry = JSON.parse(readFileSafe(paths.sourceRegistry));
      add('workspace source registry has sources', Array.isArray(registry.sources) && registry.sources.length > 0, 'Add at least one real source with npm run add-source.');
    } catch {
      add('workspace source registry parses', false, 'Fix .cv-tailor/source-registry.json.');
    }
  }
}

if (args.codex) {
  const home = resolve(String(args.home || homedir()));
  const installDir = resolve(String(args['install-dir'] || join(home, 'plugins', 'cv-tailor')));
  const marketplacePath = resolve(String(args.marketplace || join(home, '.agents', 'plugins', 'marketplace.json')));
  const configPath = resolve(String(args.config || join(home, '.codex', 'config.toml')));

  add('Codex plugin install directory', existsSync(installDir), `Run npm run install:codex, or pass --install-dir <path>. Expected: ${installDir}`);
  add('installed plugin manifest', existsSync(join(installDir, '.codex-plugin', 'plugin.json')), 'Installed plugin is missing .codex-plugin/plugin.json.');
  add('installed cv-tailor skill', existsSync(join(installDir, 'skills', 'cv-tailor', 'SKILL.md')), 'Installed plugin is missing skills/cv-tailor/SKILL.md.');

  if (existsSync(join(installDir, '.codex-plugin', 'plugin.json'))) {
    try {
      const manifest = JSON.parse(readFileSafe(join(installDir, '.codex-plugin', 'plugin.json')));
      add('installed manifest name', manifest.name === 'cv-tailor', 'Installed plugin manifest name must be "cv-tailor".');
      add('installed manifest skills path', manifest.skills === './skills/', 'Installed plugin manifest skills must be "./skills/".');
      add('installed manifest skills resolve', existsSync(join(installDir, manifest.skills || '', 'cv-tailor', 'SKILL.md')), 'Manifest skills path does not resolve to cv-tailor skill.');
    } catch {
      add('installed manifest parses', false, 'Fix installed .codex-plugin/plugin.json.');
    }
  }

  add('local marketplace file', existsSync(marketplacePath), `Create ${marketplacePath} or run npm run install:codex.`);
  if (existsSync(marketplacePath)) {
    try {
      const marketplace = JSON.parse(readFileSafe(marketplacePath));
      const plugin = Array.isArray(marketplace.plugins)
        ? marketplace.plugins.find((entry) => entry?.name === 'cv-tailor')
        : null;
      add('marketplace contains cv-tailor', Boolean(plugin), 'Add cv-tailor to marketplace plugins[].');
      if (plugin) {
        add('marketplace source is local', plugin.source?.source === 'local', 'Set plugin source.source to "local".');
        add('marketplace path is ./plugins/cv-tailor', plugin.source?.path === './plugins/cv-tailor', 'Set plugin source.path to "./plugins/cv-tailor".');
        add('marketplace installation policy', Boolean(plugin.policy?.installation), 'Set policy.installation, usually "AVAILABLE".');
        add('marketplace authentication policy', Boolean(plugin.policy?.authentication), 'Set policy.authentication, usually "ON_INSTALL".');
        add('marketplace category', Boolean(plugin.category), 'Set category, usually "Productivity".');
      }
    } catch {
      add('local marketplace parses', false, `Fix JSON in ${marketplacePath}.`);
    }
  }

  add('Codex config file', existsSync(configPath), `Create ${configPath} or run npm run install:codex.`);
  if (existsSync(configPath)) {
    const config = readFileSafe(configPath);
    add('Codex config has [marketplaces.local]', hasSection(config, 'marketplaces.local'), 'Add [marketplaces.local] with source_type = "local".');
    add('Codex config has local source_type', sectionHas(config, 'marketplaces.local', /^\s*source_type\s*=\s*"local"\s*$/m), 'Set source_type = "local" under [marketplaces.local].');
    add('Codex config enables cv-tailor plugin', sectionHas(config, 'plugins."cv-tailor@local"', /^\s*enabled\s*=\s*true\s*$/m), 'Add [plugins."cv-tailor@local"] enabled = true.');
  }
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

function readFileSafe(path) {
  return readFileSync(path, 'utf8');
}

function hasSection(config, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\[${escaped}\\]\\s*$`, 'm').test(config);
}

function sectionHas(config, sectionName, pattern) {
  const body = sectionBody(config, sectionName);
  return body !== null && pattern.test(body);
}

function sectionBody(config, sectionName) {
  const lines = String(config).split(/\r?\n/);
  let active = false;
  const body = [];
  for (const line of lines) {
    const section = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) {
      if (active) break;
      active = section[1] === sectionName;
      continue;
    }
    if (active) body.push(line);
  }
  return active || body.length > 0 ? body.join('\n') : null;
}
