#!/usr/bin/env node

import { extname, resolve } from 'path';
import { spawnSync } from 'child_process';
import { parseArgs, pluginRoot, readJson } from './lib/workspace.mjs';

const args = parseArgs();
const inputPath = args._[0];
const outputPath = args._[1];
const cv = inputPath ? readJson(inputPath) : null;
const engine = String(args.engine || cv?.metadata?.renderEngine || '').toLowerCase();
const format = String(args.format || cv?.metadata?.paperFormat || 'a4').toLowerCase();

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/render-cv.mjs <tailored-cv.json> <output.pdf> --engine=html|latex [--format=a4|letter]');
  process.exit(1);
}

if (!['html', 'latex'].includes(engine)) {
  console.error('Missing or invalid --engine. Use "html" or "latex".');
  process.exit(1);
}

const input = resolve(inputPath);
const output = resolve(outputPath);
const stem = output.slice(0, -extname(output).length) || output;
const intermediate = engine === 'html' ? `${stem}.html` : `${stem}.tex`;

if (engine === 'html') {
  run(['scripts/render-html.mjs', input, intermediate]);
  run(['scripts/render-pdf.mjs', intermediate, output, `--format=${format}`]);
} else {
  run(['scripts/render-latex.mjs', input, intermediate]);
  run(['scripts/compile-latex.mjs', intermediate, output]);
}

console.log(JSON.stringify({
  status: 'ok',
  engine,
  input,
  intermediate,
  output
}, null, 2));

function run(scriptArgs) {
  const result = spawnSync(process.execPath, scriptArgs, {
    cwd: pluginRoot,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(result.status || 1);
  }
}
