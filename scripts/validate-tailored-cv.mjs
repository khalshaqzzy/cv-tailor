#!/usr/bin/env node

import { existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs, readJson, runtimePaths } from './lib/workspace.mjs';

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

  const knownSourceIds = new Set((registry?.sources || []).map((source) => source.id));
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

  return { ok: errors.length === 0, errors, refsChecked: refs.length };
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
    errors: result.errors
  }, null, 2));

  process.exit(result.ok ? 0 : 1);
}
