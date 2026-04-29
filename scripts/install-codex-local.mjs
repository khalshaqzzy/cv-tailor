#!/usr/bin/env node

import { spawnSync } from 'child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'fs';
import { homedir } from 'os';
import { basename, dirname, relative, resolve, sep } from 'path';
import { parseArgs, pluginRoot, writeJson } from './lib/workspace.mjs';

const PLUGIN_NAME = 'cv-tailor';
const MARKETPLACE_NAME = 'local';
const MARKETPLACE_ENTRY = {
  name: PLUGIN_NAME,
  source: {
    source: 'local',
    path: './plugins/cv-tailor'
  },
  policy: {
    installation: 'AVAILABLE',
    authentication: 'ON_INSTALL'
  },
  category: 'Productivity'
};

const args = parseArgs();
const home = resolve(String(args.home || homedir()));
const sourceRoot = resolve(String(args.source || pluginRoot));
const installDir = resolve(String(args['install-dir'] || `${home}/plugins/${PLUGIN_NAME}`));
const marketplacePath = resolve(String(args.marketplace || `${home}/.agents/plugins/marketplace.json`));
const configPath = resolve(String(args.config || `${home}/.codex/config.toml`));
const force = Boolean(args.force);
const dryRun = Boolean(args['dry-run']);
const patchConfig = !args['skip-config'] && !args['no-config'];

const actions = [];

assertLooksLikePlugin(sourceRoot);
installPluginCopy();
updateMarketplace();
if (patchConfig) updateCodexConfig();
else {
  actions.push(`Skipped Codex config patching. Add the snippet from examples/codex-config.local.example.toml to ${configPath}.`);
}

console.log('\nCV Tailor local Codex install');
for (const action of actions) console.log(`- ${action}`);
console.log('\nNext steps:');
console.log('1. Run npm run doctor -- --codex');
console.log('2. Restart Codex or open a new thread so the plugin list refreshes.');

function assertLooksLikePlugin(root) {
  if (!existsSync(`${root}/.codex-plugin/plugin.json`)) {
    fail(`Source does not look like a Codex plugin root: ${root}`);
  }
  if (!existsSync(`${root}/skills/cv-tailor/SKILL.md`)) {
    fail(`Source is missing skills/cv-tailor/SKILL.md: ${root}`);
  }
}

function installPluginCopy() {
  const sameDirectory = resolve(sourceRoot) === resolve(installDir);
  if (sameDirectory) {
    actions.push(`Plugin already located at ${installDir}`);
    return;
  }

  const targetParent = dirname(installDir);
  if (existsSync(installDir)) {
    if (isGitDirty(installDir) && !force) {
      fail(`Refusing to overwrite dirty existing plugin directory: ${installDir}\nRe-run from that directory or pass --force.`);
    }
    if (!force && readdirSync(installDir).length > 0) {
      fail(`Plugin directory already exists: ${installDir}\nPass --force to replace it, or run this script from the installed directory.`);
    }
  }

  if (dryRun) {
    actions.push(`Would copy ${sourceRoot} to ${installDir}`);
    return;
  }

  mkdirSync(targetParent, { recursive: true });
  if (existsSync(installDir) && force) rmSync(installDir, { recursive: true, force: true });
  cpSync(sourceRoot, installDir, {
    recursive: true,
    filter: (source) => shouldCopy(sourceRoot, source)
  });
  actions.push(`Installed plugin files at ${installDir}`);
}

function shouldCopy(root, source) {
  const rel = relative(root, source);
  if (!rel) return true;
  const parts = rel.split(sep);
  const ignored = new Set([
    '.git',
    '.cv-tailor',
    'node_modules',
    'tmp',
    'dist',
    'coverage'
  ]);
  if (parts.some((part) => ignored.has(part))) return false;
  const name = basename(source);
  if (name.endsWith('.log') || name === '.DS_Store' || name === 'Thumbs.db') return false;
  return true;
}

function updateMarketplace() {
  let marketplace = {
    name: MARKETPLACE_NAME,
    interface: {
      displayName: 'Local Plugins'
    },
    plugins: []
  };

  if (existsSync(marketplacePath)) {
    try {
      marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8'));
    } catch (error) {
      fail(`Cannot parse existing marketplace JSON at ${marketplacePath}: ${error.message}`);
    }
  }

  marketplace.name ||= MARKETPLACE_NAME;
  marketplace.interface ||= {};
  marketplace.interface.displayName ||= 'Local Plugins';
  if (!Array.isArray(marketplace.plugins)) marketplace.plugins = [];

  const index = marketplace.plugins.findIndex((plugin) => plugin?.name === PLUGIN_NAME);
  if (index === -1) {
    marketplace.plugins.push(MARKETPLACE_ENTRY);
    actions.push(`Added ${PLUGIN_NAME} to ${marketplacePath}`);
  } else {
    const current = marketplace.plugins[index];
    const normalized = {
      ...current,
      source: MARKETPLACE_ENTRY.source,
      policy: {
        installation: current.policy?.installation || MARKETPLACE_ENTRY.policy.installation,
        authentication: current.policy?.authentication || MARKETPLACE_ENTRY.policy.authentication
      },
      category: current.category || MARKETPLACE_ENTRY.category
    };
    marketplace.plugins[index] = normalized;
    actions.push(`Updated existing ${PLUGIN_NAME} marketplace entry in ${marketplacePath}`);
  }

  if (!dryRun) {
    mkdirSync(dirname(marketplacePath), { recursive: true });
    writeJson(marketplacePath, marketplace);
  }
}

function updateCodexConfig() {
  let config = '';
  if (existsSync(configPath)) config = readFileSync(configPath, 'utf8');

  const additions = [];
  if (!hasSection(config, 'marketplaces.local')) {
    additions.push(`[marketplaces.local]
last_updated = "${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}"
source_type = "local"
source = '${tomlSingleQuoted(home)}'`);
  }

  if (!hasSection(config, 'plugins."cv-tailor@local"')) {
    additions.push(`[plugins."cv-tailor@local"]
enabled = true`);
  } else if (!pluginEnabled(config)) {
    fail(`${configPath} already has [plugins."cv-tailor@local"], but enabled = true was not found. Please update it manually.`);
  }

  if (additions.length === 0) {
    actions.push(`Codex config already enables ${PLUGIN_NAME}@local`);
    return;
  }

  const next = `${config.trimEnd()}\n\n${additions.join('\n\n')}\n`;
  if (!dryRun) {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, next, 'utf8');
  }
  actions.push(`Patched Codex config at ${configPath}`);
}

function hasSection(config, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\[${escaped}\\]\\s*$`, 'm').test(config);
}

function pluginEnabled(config) {
  const body = sectionBody(config, 'plugins."cv-tailor@local"');
  return body !== null && /^\s*enabled\s*=\s*true\s*$/m.test(body);
}

function tomlSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
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

function isGitDirty(path) {
  if (!existsSync(`${path}/.git`)) return false;
  const result = spawnSync('git', ['-C', path, 'status', '--porcelain'], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
