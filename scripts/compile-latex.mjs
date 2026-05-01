#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { parseArgs } from './lib/workspace.mjs';
import { getTectonicExecutablePath } from './tectonic-path.mjs';

const args = parseArgs();
const inputPath = args._[0];
const outputPath = args._[1];

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/compile-latex.mjs <input.tex> <output.pdf>');
  process.exit(1);
}

const input = resolve(inputPath);
const output = resolve(outputPath);

if (!existsSync(input)) {
  console.error(`Input TeX not found: ${input}`);
  process.exit(1);
}

let tectonic;
try {
  tectonic = getTectonicExecutablePath();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const outdir = mkdtempSync(join(tmpdir(), 'cv-tailor-tectonic-'));
try {
  const result = spawnSync(tectonic, ['--outdir', outdir, input], {
    cwd: dirname(input),
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(result.status || 1);
  }

  const generatedPdf = join(outdir, `${basename(input, '.tex')}.pdf`);
  if (!existsSync(generatedPdf)) {
    console.error(`Tectonic did not produce expected PDF: ${generatedPdf}`);
    process.exit(1);
  }

  mkdirSync(dirname(output), { recursive: true });
  copyFileSync(generatedPdf, output);

  console.log(JSON.stringify({
    status: 'ok',
    output,
    sizeBytes: statSync(output).size,
    tectonic
  }, null, 2));
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
