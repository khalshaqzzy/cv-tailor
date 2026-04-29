#!/usr/bin/env node

import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseArgs, pluginRoot, readJson, runtimePaths } from './lib/workspace.mjs';

const BANNED_PHRASES = [
  'passionate about',
  'results-oriented',
  'proven track record',
  'leveraged cutting-edge',
  'spearheaded',
  'synergies',
  'in today'
];

export function collectSourceIdRefs(value, refs = [], trail = '$') {
  if (!value || typeof value !== 'object') return refs;

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSourceIdRefs(item, refs, `${trail}[${index}]`));
    return refs;
  }

  if (Object.hasOwn(value, 'sourceIds')) {
    refs.push({ path: `${trail}.sourceIds`, value: value.sourceIds });
  }

  for (const [key, child] of Object.entries(value)) {
    collectSourceIdRefs(child, refs, `${trail}.${key}`);
  }

  return refs;
}

export function validateTailoredCv(cv, registry) {
  const errors = [];
  const warnings = [];

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const tailoredSchema = readJson(join(pluginRoot, 'schemas', 'tailored-cv.schema.json'));
  const registrySchema = readJson(join(pluginRoot, 'schemas', 'source-registry.schema.json'));
  const validateCvShape = ajv.compile(tailoredSchema);
  const validateRegistryShape = ajv.compile(registrySchema);

  if (!validateCvShape(cv)) {
    for (const error of validateCvShape.errors || []) {
      errors.push(`schema ${error.instancePath || '/'} ${error.message}`);
    }
  }

  if (!validateRegistryShape(registry)) {
    for (const error of validateRegistryShape.errors || []) {
      errors.push(`source registry schema ${error.instancePath || '/'} ${error.message}`);
    }
  }

  if (!cv || typeof cv !== 'object') errors.push('Tailored CV must be a JSON object.');
  if (!cv?.candidate?.name) errors.push('candidate.name is required.');
  if (!cv?.candidate?.email) errors.push('candidate.email is required.');
  if (!cv?.job?.company) errors.push('job.company is required.');
  if (!cv?.job?.role) errors.push('job.role is required.');
  if (cv?.metadata?.approvedByUser !== true) {
    errors.push('metadata.approvedByUser must be true before PDF generation.');
  }
  if (!['a4', 'letter'].includes(cv?.metadata?.paperFormat)) {
    errors.push('metadata.paperFormat must be "a4" or "letter".');
  }
  if (!cv?.sections?.summary?.text) errors.push('sections.summary.text is required.');
  if (!Array.isArray(cv?.sections?.experience)) errors.push('sections.experience must be an array.');
  if (!Array.isArray(cv?.sections?.skills)) errors.push('sections.skills must be an array.');

  const sourceIds = (registry?.sources || []).map((source) => source.id);
  const knownSourceIds = new Set(sourceIds);
  if (knownSourceIds.size !== sourceIds.length) {
    errors.push('source registry contains duplicate source IDs.');
  }
  if (knownSourceIds.size === 0) {
    errors.push('source registry must contain at least one source.');
  }

  const refs = collectSourceIdRefs(cv);
  if (refs.length === 0) {
    errors.push('No sourceIds found. Every substantial claim must be source-backed.');
  }

  for (const ref of refs) {
    if (!Array.isArray(ref.value) || ref.value.length === 0) {
      errors.push(`${ref.path} must be a non-empty array.`);
      continue;
    }

    for (const sourceId of ref.value) {
      if (!knownSourceIds.has(sourceId)) {
        errors.push(`${ref.path} references unknown source "${sourceId}".`);
      }
    }
  }

  for (const { path, text } of collectTextClaims(cv)) {
    const lower = text.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (lower.includes(phrase)) {
        warnings.push(`${path} contains weak resume phrase "${phrase}".`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, refsChecked: refs.length };
}

function collectTextClaims(value, claims = [], trail = '$') {
  if (!value || typeof value !== 'object') return claims;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTextClaims(item, claims, `${trail}[${index}]`));
    return claims;
  }
  if (typeof value.text === 'string') claims.push({ path: `${trail}.text`, text: value.text });
  if (typeof value.description === 'string') claims.push({ path: `${trail}.description`, text: value.description });
  for (const [key, child] of Object.entries(value)) {
    collectTextClaims(child, claims, `${trail}.${key}`);
  }
  return claims;
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '')) {
  const args = parseArgs();
  const cvPath = args._[0];

  if (!cvPath) {
    console.error('Usage: node scripts/validate-tailored-cv.mjs <tailored-cv.json> [--workspace <path>] [--source-registry <path>]');
    process.exit(1);
  }

  const paths = runtimePaths(args.workspace || '.');
  const registryPath = args['source-registry'] || paths.sourceRegistry;

  if (!existsSync(cvPath)) {
    console.error(`Tailored CV not found: ${cvPath}`);
    process.exit(1);
  }
  if (!existsSync(registryPath)) {
    console.error(`Source registry not found: ${registryPath}`);
    process.exit(1);
  }

  const result = validateTailoredCv(readJson(cvPath), readJson(registryPath));
  console.log(JSON.stringify({
    status: result.ok ? 'ok' : 'failed',
    refsChecked: result.refsChecked,
    errors: result.errors,
    warnings: result.warnings
  }, null, 2));

  process.exit(result.ok ? 0 : 1);
}
