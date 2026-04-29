#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { parseArgs, readJson } from './lib/workspace.mjs';

const args = parseArgs();
const cvPath = args._[0];
const dossierPath = args['job-dossier'];
const keywordArg = args.keywords;

if (!cvPath || (!dossierPath && !keywordArg)) {
  console.error('Usage: node scripts/ats-keyword-check.mjs <tailored-cv.json> (--job-dossier <job.json> | --keywords "kw1,kw2")');
  process.exit(1);
}

if (!existsSync(cvPath)) {
  console.error(`Tailored CV not found: ${cvPath}`);
  process.exit(1);
}

const cv = readJson(cvPath);
let keywords = [];
if (dossierPath) {
  const dossier = readJson(dossierPath);
  keywords = dossier.atsKeywords || dossier.requirements || [];
} else {
  keywords = String(keywordArg).split(',').map((item) => item.trim()).filter(Boolean);
}

function collectText(value, chunks = []) {
  if (value == null) return chunks;
  if (typeof value === 'string') chunks.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectText(item, chunks));
  else if (typeof value === 'object') Object.values(value).forEach((item) => collectText(item, chunks));
  return chunks;
}

const haystack = collectText(cv).join('\n').toLowerCase();
const results = keywords.map((keyword) => {
  const normalized = String(keyword).toLowerCase();
  return {
    keyword,
    present: normalized.length > 0 && haystack.includes(normalized)
  };
});

const covered = results.filter((item) => item.present).length;
const coverage = keywords.length === 0 ? 0 : covered / keywords.length;

console.log(JSON.stringify({
  status: 'ok',
  totalKeywords: keywords.length,
  covered,
  coverage,
  missing: results.filter((item) => !item.present).map((item) => item.keyword),
  results
}, null, 2));

process.exit(coverage >= Number(args.min || 0) ? 0 : 1);
