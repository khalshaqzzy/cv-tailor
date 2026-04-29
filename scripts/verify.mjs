#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
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
requireFile(join(pluginRoot, 'skills', 'cv-tailor', 'SKILL.md'), 'cv-tailor skill');
requireFile(join(pluginRoot, 'templates', 'cv-template.html'), 'CV HTML template');
requireFile(join(pluginRoot, 'templates', 'profile.example.yml'), 'profile template');
requireFile(join(pluginRoot, 'templates', 'story-bank.template.md'), 'story bank template');

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
const exampleRegistry = requireJson(join(pluginRoot, 'examples', 'source-registry.example.json'), 'example source registry');
if (exampleCv && exampleRegistry) {
  const validation = validateTailoredCv(exampleCv, exampleRegistry);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => `example tailored CV: ${error}`));
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
