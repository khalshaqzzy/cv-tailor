#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import {
  htmlEscape,
  normalizeTextForATS,
  parseArgs,
  pluginRoot,
  readJson,
  renderMarkdownEmphasisHtml
} from './lib/workspace.mjs';

function contactItem(label, href) {
  if (!label) return '';
  const escaped = htmlEscape(label);
  if (!href) return `<span>${escaped}</span>`;
  return `<a href="${htmlEscape(href)}">${escaped}</a>`;
}

function renderBullets(bullets = []) {
  if (!bullets.length) return '';
  return `<ul>${bullets.map((bullet) => `<li>${renderMarkdownEmphasisHtml(bullet.text)}</li>`).join('')}</ul>`;
}

function renderExperience(items = []) {
  return items.map((item) => `
    <article class="item">
      <div class="item-head">
        <div class="item-title">${htmlEscape(item.company)}</div>
        <div class="item-meta">${htmlEscape(item.period || '')}</div>
      </div>
      <div class="item-subtitle">${htmlEscape(item.role || '')}</div>
      ${item.location ? `<div class="item-location">${htmlEscape(item.location)}</div>` : ''}
      ${renderBullets(item.bullets)}
    </article>
  `).join('');
}

function renderProjects(items = []) {
  return items.map((item) => `
    <article class="item">
      <div class="item-head">
        <div class="item-title">${htmlEscape(item.name)}</div>
        <div class="item-meta">${htmlEscape(item.tech || '')}</div>
      </div>
      <div>${renderMarkdownEmphasisHtml(item.description || '')}</div>
      ${renderBullets(item.bullets)}
    </article>
  `).join('');
}

function renderSimpleItems(items = []) {
  if (!items.length) return '<div class="item">N/A</div>';
  return items.map((item) => `
    <article class="item">
      <div class="item-head">
        <div class="item-title">${htmlEscape(item.title)}</div>
        <div class="item-meta">${htmlEscape(item.period || '')}</div>
      </div>
      ${item.subtitle ? `<div>${renderMarkdownEmphasisHtml(item.subtitle)}</div>` : ''}
      ${renderBullets(item.bullets)}
    </article>
  `).join('');
}

function renderSkills(items = []) {
  return items.map((group) => {
    const skills = Array.isArray(group.items) ? group.items.join(', ') : '';
    return `<span class="skill"><strong>${htmlEscape(group.category)}:</strong> ${renderMarkdownEmphasisHtml(skills)}</span>`;
  }).join('');
}

function renderCompetencies(items = []) {
  return items.map((item) => {
    const text = typeof item === 'string' ? item : item.text;
    return `<span class="tag">${renderMarkdownEmphasisHtml(text)}</span>`;
  }).join('');
}

function renderHtml(cv) {
  const template = readFileSync(join(pluginRoot, 'templates', 'cv-template.html'), 'utf8');
  const candidate = cv.candidate || {};
  const sections = cv.sections || {};
  const format = cv.metadata?.paperFormat === 'letter' ? '8.5in' : '210mm';

  const contacts = [
    contactItem(candidate.phone),
    contactItem(candidate.email, candidate.email ? `mailto:${candidate.email}` : ''),
    contactItem(candidate.linkedin, candidate.linkedin),
    contactItem(candidate.github, candidate.github),
    contactItem(candidate.portfolio, candidate.portfolio),
    contactItem(candidate.location)
  ].filter(Boolean).join('<span>|</span>');

  const replacements = {
    '{{LANG}}': htmlEscape(cv.metadata?.language || 'en'),
    '{{PAGE_WIDTH}}': format,
    '{{NAME}}': htmlEscape(candidate.name),
    '{{CONTACT_ITEMS}}': contacts,
    '{{SUMMARY_TEXT}}': renderMarkdownEmphasisHtml(sections.summary?.text || ''),
    '{{COMPETENCIES}}': renderCompetencies(sections.competencies || []),
    '{{EXPERIENCE}}': renderExperience(sections.experience || []),
    '{{PROJECTS}}': renderProjects(sections.projects || []),
    '{{EDUCATION}}': renderSimpleItems(sections.education || []),
    '{{CERTIFICATIONS}}': renderSimpleItems(sections.certifications || []),
    '{{SKILLS}}': renderSkills(sections.skills || [])
  };

  let html = template;
  for (const [token, value] of Object.entries(replacements)) {
    html = html.replaceAll(token, value);
  }

  return normalizeTextForATS(html).text;
}

const args = parseArgs();
const input = args._[0];
const output = args._[1];

if (!input || !output) {
  console.error('Usage: node scripts/render-html.mjs <tailored-cv.json> <output.html>');
  process.exit(1);
}

const cv = readJson(input);
const html = renderHtml(cv);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html, 'utf8');
console.log(JSON.stringify({ status: 'ok', output }, null, 2));
