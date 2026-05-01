#!/usr/bin/env node

import { existsSync, mkdirSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { parseArgs, readJson, runtimePaths, slugify, todayIso, writeJson } from './lib/workspace.mjs';

const args = parseArgs();
const workspace = args.workspace || '.';
const paths = runtimePaths(workspace);
const tailoredCvPath = args['tailored-cv'] || args._[0];

if (!tailoredCvPath) {
  console.error('Usage: node scripts/write-run-manifest.mjs --workspace <path> --tailored-cv <json> [--html <path>] [--tex <path>] [--pdf <path>] [--renderer html|latex] [--report <path>] [--approved]');
  process.exit(1);
}

const cv = readJson(tailoredCvPath);
const runId = args['run-id'] || `${todayIso().replaceAll('-', '')}-${slugify(cv.job?.company)}-${slugify(cv.job?.role)}`;
const runDir = join(paths.runs, runId);
mkdirSync(runDir, { recursive: true });

function rel(path) {
  return path ? relative(paths.workspace, resolve(path)).replace(/\\/g, '/') : undefined;
}

const pdfPath = args.pdf ? resolve(args.pdf) : null;
const manifest = {
  runId,
  createdAt: new Date().toISOString(),
  workspace: paths.workspace,
  job: {
    company: cv.job?.company || 'Unknown',
    role: cv.job?.role || 'Unknown',
    url: cv.job?.url || null
  },
  humanReview: {
    approved: args.approved === true || cv.metadata?.approvedByUser === true,
    approvedAt: args.approved ? new Date().toISOString() : cv.metadata?.approvedAt,
    notes: args.notes || ''
  },
  artifacts: {
    evaluationReport: rel(args.report),
    tailoredCvJson: rel(tailoredCvPath),
    html: rel(args.html),
    tex: rel(args.tex),
    pdf: rel(args.pdf)
  },
  verification: {
    renderer: args.renderer || cv.metadata?.renderEngine || 'html',
    pdfExists: pdfPath ? existsSync(pdfPath) : false,
    pdfSizeBytes: pdfPath && existsSync(pdfPath) ? statSync(pdfPath).size : 0
  }
};

const output = args.output || join(runDir, 'run-manifest.json');
mkdirSync(dirname(output), { recursive: true });
writeJson(output, manifest);
console.log(JSON.stringify({ status: 'ok', output, manifest }, null, 2));
