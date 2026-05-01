#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import { pluginRoot, readJson } from './lib/workspace.mjs';
import { validateTailoredCv } from './validate-tailored-cv.mjs';

const errors = [];
const warnings = [];

function requireFile(path, label) {
  if (!existsSync(path)) errors.push(`Missing ${label}: ${path}`);
}

function requireJson(path, label) {
  requireFile(path, label);
  if (!existsSync(path)) return null;
  try {
    return readJson(path);
  } catch (error) {
    errors.push(`Invalid JSON in ${label}: ${error.message}`);
    return null;
  }
}

const manifest = requireJson(join(pluginRoot, '.codex-plugin', 'plugin.json'), 'plugin manifest');
if (manifest) {
  if (manifest.name !== 'cv-tailor') errors.push('plugin manifest name must be "cv-tailor".');
  if (manifest.skills !== './skills/') errors.push('plugin manifest skills must be "./skills/".');
}

requireJson(join(pluginRoot, 'package.json'), 'package.json');
requireFile(join(pluginRoot, 'THIRD_PARTY_NOTICES.md'), 'third-party notices');
requireFile(join(pluginRoot, 'skills', 'cv-tailor', 'SKILL.md'), 'cv-tailor skill');
requireFile(join(pluginRoot, 'templates', 'cv-template.html'), 'CV HTML template');
requireFile(join(pluginRoot, 'templates', 'cv-template.tex'), 'CV LaTeX template');
requireFile(join(pluginRoot, 'templates', 'profile.example.yml'), 'profile template');
requireFile(join(pluginRoot, 'templates', 'story-bank.template.md'), 'story bank template');
requireFile(join(pluginRoot, 'docs', 'install-codex-local.md'), 'Codex local install docs');
requireFile(join(pluginRoot, 'docs', 'privacy.md'), 'privacy policy docs');
requireFile(join(pluginRoot, 'docs', 'terms.md'), 'terms docs');
requireFile(join(pluginRoot, 'docs', 'security.md'), 'security docs');
requireFile(join(pluginRoot, 'docs', 'latex-rendering.md'), 'LaTeX rendering docs');
requireFile(join(pluginRoot, 'scripts', 'tectonic-path.mjs'), 'Tectonic path helper');
requireFile(join(pluginRoot, 'scripts', 'render-latex.mjs'), 'LaTeX renderer script');
requireFile(join(pluginRoot, 'scripts', 'compile-latex.mjs'), 'LaTeX compile script');
requireFile(join(pluginRoot, 'scripts', 'render-cv.mjs'), 'dual renderer script');
requireFile(join(pluginRoot, 'bin', 'tectonic.exe'), 'bundled Windows Tectonic executable');

for (const schema of [
  'profile.schema.json',
  'source-registry.schema.json',
  'job-dossier.schema.json',
  'tailored-cv.schema.json',
  'run-manifest.schema.json'
]) {
  requireJson(join(pluginRoot, 'schemas', schema), schema);
}

const fontsDir = join(pluginRoot, 'fonts');
if (!existsSync(fontsDir) || readdirSync(fontsDir).filter((file) => file.endsWith('.woff2')).length < 2) {
  errors.push('fonts/ must contain the self-hosted .woff2 files used by the PDF template.');
}

if (existsSync(join(pluginRoot, '.cv-tailor'))) {
  errors.push('Plugin repo must not contain runtime .cv-tailor user data.');
}

const gitignore = readFileSync(join(pluginRoot, '.gitignore'), 'utf8');
if (!gitignore.split(/\r?\n/).includes('.cv-tailor/')) {
  warnings.push('.gitignore should include .cv-tailor/.');
}

const exampleCv = requireJson(join(pluginRoot, 'examples', 'tailored-cv.example.json'), 'example tailored CV');
const latexExampleCv = requireJson(join(pluginRoot, 'examples', 'tailored-cv.latex.example.json'), 'example LaTeX tailored CV');
const exampleRegistry = requireJson(join(pluginRoot, 'examples', 'source-registry.example.json'), 'example source registry');
const localMarketplace = requireJson(join(pluginRoot, 'examples', 'codex-marketplace.local.example.json'), 'local marketplace example');
if (localMarketplace) {
  const plugin = Array.isArray(localMarketplace.plugins)
    ? localMarketplace.plugins.find((entry) => entry?.name === 'cv-tailor')
    : null;
  if (!plugin) errors.push('local marketplace example must include cv-tailor.');
  else {
    if (plugin.source?.source !== 'local') errors.push('local marketplace example source.source must be "local".');
    if (plugin.source?.path !== './plugins/cv-tailor') errors.push('local marketplace example source.path must be "./plugins/cv-tailor".');
    if (!plugin.policy?.installation) errors.push('local marketplace example must include policy.installation.');
    if (!plugin.policy?.authentication) errors.push('local marketplace example must include policy.authentication.');
    if (!plugin.category) errors.push('local marketplace example must include category.');
  }
}
if (exampleCv && exampleRegistry) {
  const validation = validateTailoredCv(exampleCv, exampleRegistry);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => `example tailored CV: ${error}`));
  }
}
if (latexExampleCv && exampleRegistry) {
  const validation = validateTailoredCv(latexExampleCv, exampleRegistry);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => `example LaTeX tailored CV: ${error}`));
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
for (const [schemaFile, exampleFile, label] of [
  ['source-registry.schema.json', 'source-registry.example.json', 'source registry example'],
  ['job-dossier.schema.json', 'job-dossier.example.json', 'job dossier example'],
  ['run-manifest.schema.json', 'run-manifest.example.json', 'run manifest example'],
  ['tailored-cv.schema.json', 'tailored-cv.latex.example.json', 'LaTeX tailored CV example']
]) {
  const schema = requireJson(join(pluginRoot, 'schemas', schemaFile), schemaFile);
  const example = requireJson(join(pluginRoot, 'examples', exampleFile), label);
  if (!schema || !example) continue;
  const validate = ajv.compile(schema);
  if (!validate(example)) {
    for (const error of validate.errors || []) {
      errors.push(`${label}: ${error.instancePath || '/'} ${error.message}`);
    }
  }
}

if (warnings.length > 0) {
  console.log('Warnings:');
  for (const warning of warnings) console.log(`- ${warning}`);
  console.log('');
}

if (errors.length > 0) {
  console.log('Verification failed:');
  for (const error of errors) console.log(`- ${error}`);
  process.exit(1);
}

console.log('Verification passed.');
