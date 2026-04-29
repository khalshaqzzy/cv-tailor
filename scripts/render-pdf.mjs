#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { chromium } from 'playwright';
import { fileUrl, normalizeTextForATS, parseArgs, pluginRoot } from './lib/workspace.mjs';

const args = parseArgs();
const inputPath = args._[0];
const outputPath = args._[1];
const format = String(args.format || 'a4').toLowerCase();

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/render-pdf.mjs <input.html> <output.pdf> [--format=a4|letter]');
  process.exit(1);
}

if (!['a4', 'letter'].includes(format)) {
  console.error('Invalid --format. Use "a4" or "letter".');
  process.exit(1);
}

const input = resolve(inputPath);
const output = resolve(outputPath);

if (!existsSync(input)) {
  console.error(`Input HTML not found: ${input}`);
  process.exit(1);
}

mkdirSync(dirname(output), { recursive: true });

let html = readFileSync(input, 'utf8');
const fontsUrl = fileUrl(resolve(pluginRoot, 'fonts')).replace(/\/?$/, '/');
html = html.replace(/url\(['"]?\.\/fonts\//g, `url('${fontsUrl}`);
const normalized = normalizeTextForATS(html);
html = normalized.text;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(html, {
    waitUntil: 'networkidle',
    baseURL: `${fileUrl(dirname(input))}/`
  });
  await page.evaluate(() => document.fonts.ready);

  const buffer = await page.pdf({
    format,
    printBackground: true,
    margin: {
      top: '0.6in',
      right: '0.6in',
      bottom: '0.6in',
      left: '0.6in'
    },
    preferCSSPageSize: false
  });

  writeFileSync(output, buffer);
  const pages = (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;

  console.log(JSON.stringify({
    status: 'ok',
    output,
    pages,
    sizeBytes: buffer.length,
    atsNormalization: normalized.replacements
  }, null, 2));
} finally {
  await browser.close();
}
