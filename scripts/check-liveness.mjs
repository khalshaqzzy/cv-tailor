#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { chromium } from 'playwright';
import { classifyLiveness } from './liveness-core.mjs';

async function checkUrl(page, url) {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const status = response?.status() ?? 0;
    await page.waitForTimeout(2000);

    const finalUrl = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    const applyControls = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]')
      );

      return candidates
        .filter((element) => {
          if (element.closest('nav, header, footer')) return false;
          if (element.closest('[aria-hidden="true"]')) return false;
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (!element.getClientRects().length) return false;
          return Array.from(element.getClientRects()).some((rect) => rect.width > 0 && rect.height > 0);
        })
        .map((element) => [
          element.innerText,
          element.value,
          element.getAttribute('aria-label'),
          element.getAttribute('title')
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    });

    return classifyLiveness({ status, finalUrl, bodyText, applyControls });
  } catch (error) {
    return { result: 'expired', reason: `navigation error: ${error.message.split('\n')[0]}` };
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/check-liveness.mjs <url1> [url2] ...');
  console.error('       node scripts/check-liveness.mjs --file urls.txt');
  process.exit(1);
}

let urls;
if (args[0] === '--file') {
  const text = await readFile(args[1], 'utf8');
  urls = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
} else {
  urls = args;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];

try {
  for (const url of urls) {
    const result = await checkUrl(page, url);
    results.push({ url, ...result });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ status: 'ok', results }, null, 2));
process.exit(results.every((item) => item.result === 'active') ? 0 : 1);
