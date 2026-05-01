#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  latexEscape,
  latexUrlEscape,
  normalizeTextForATS,
  parseArgs,
  pluginRoot,
  readJson,
  renderMarkdownEmphasisLatex,
  stripMarkdownEmphasis
} from './lib/workspace.mjs';

function hasText(value) {
  return String(value ?? '').trim().length > 0;
}

function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function renderContact(candidate = {}) {
  const items = [];
  if (hasText(candidate.phone)) items.push(`\\faPhone\\ \\underline{${latexEscape(candidate.phone)}}`);
  if (hasText(candidate.email)) {
    items.push(`{\\faEnvelope\\ \\underline{\\href{mailto:${latexUrlEscape(candidate.email)}}{${latexEscape(candidate.email)}}}}`);
  }
  if (hasText(candidate.linkedin)) {
    items.push(`{\\faLinkedin\\ \\underline{\\href{${latexUrlEscape(candidate.linkedin)}}{${latexEscape(prettyUrl(candidate.linkedin))}}}}`);
  }
  if (hasText(candidate.github)) {
    items.push(`{\\faGithub\\ \\underline{\\href{${latexUrlEscape(candidate.github)}}{${latexEscape(prettyUrl(candidate.github))}}}}`);
  }
  if (hasText(candidate.portfolio)) {
    items.push(`{\\faBriefcase\\ \\underline{\\href{${latexUrlEscape(candidate.portfolio)}}{${latexEscape(prettyUrl(candidate.portfolio))}}}}`);
  }
  if (hasText(candidate.location)) items.push(latexEscape(candidate.location));
  return items.join(' ~\n    ');
}

function prettyUrl(url) {
  return String(url || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}

function renderClaimText(value) {
  return renderMarkdownEmphasisLatex(normalizeTextForATS(value).text);
}

function renderBullets(items = []) {
  const bullets = items
    .map((item) => typeof item === 'string' ? item : item?.text)
    .filter(hasText);
  if (!bullets.length) return '';
  return `\\resumeItemListStart
${bullets.map((bullet) => `                    \\resumeItem{${renderClaimText(bullet)}}`).join('\n')}
                    \\resumeItemListEnd`;
}

function renderEducation(items = []) {
  const entries = items.filter((item) => hasText(item?.title) || hasText(item?.subtitle));
  if (!entries.length) return '';

  const blocks = entries.map((item) => {
    const bullets = [
      ...(Array.isArray(item.bullets) ? item.bullets : []),
      ...(Array.isArray(item.coursework) && item.coursework.length
        ? [{ text: `Courses: ${item.coursework.join(', ')}` }]
        : [])
    ];
    return `%-----------EDUCATION-----------
\\section{Education}
  \\resumeSubHeadingListStart
    \\resumeSubheading
      {${latexEscape(item.title || '')}}{${latexEscape(item.period || '')}}
      {${renderClaimText(item.subtitle || '')}}{${latexEscape(item.location || '')}}
  \\resumeSubHeadingListEnd
${bullets.length ? `    \\resumeItemListStart
${bullets.map((bullet) => `        \\resumeItem {${renderClaimText(bullet.text || bullet)}}`).join('\n        \\vspace{-7pt}\n')}
    \\resumeItemListEnd` : ''}
    \\vspace{-12pt}`;
  });

  return blocks.join('\n');
}

function renderExperience(items = []) {
  const entries = items.filter((item) => hasText(item?.company) || hasText(item?.role) || hasItems(item?.bullets));
  if (!entries.length) return '';

  return `%-----------Experience---------------
\\section{Work Experience}
    \\resumeSubHeadingListStart
${entries.map((item) => `            \\resumeSubheading{${latexEscape(item.company || '')}}{${latexEscape(item.period || '')}}{${latexEscape(item.role || '')}}{${latexEscape(item.location || '')}} 
                ${renderBullets(item.bullets).replaceAll('\n', '\n                ')}`).join('\n')}
    \\resumeSubHeadingListEnd
    \\vspace{-12pt}`;
}

function renderLinks(item = {}) {
  const links = [];
  if (hasText(item.website)) links.push(`\\href{${latexUrlEscape(item.website)}}{Website}`);
  if (hasText(item.github)) links.push(`\\href{${latexUrlEscape(item.github)}}{Source Code}`);
  if (Array.isArray(item.links)) {
    for (const link of item.links) {
      if (hasText(link?.label) && hasText(link?.url)) links.push(`\\href{${latexUrlEscape(link.url)}}{${latexEscape(link.label)}}`);
    }
  }
  if (!links.length) return '';
  return ` $|$ \\emph{${links.join('{ $|$ }')}}`;
}

function renderProjectTitle(item = {}) {
  return `\\textbf{{${latexEscape(item.name || '')}}}${renderLinks(item)}`;
}

function renderTechStack(value) {
  return String(value ?? '')
    .split('|')
    .map((part) => latexEscape(part.trim()))
    .filter(Boolean)
    .join(' $|$ ');
}

function renderProjects(items = []) {
  const entries = items.filter((item) => hasText(item?.name) || hasText(item?.description) || hasItems(item?.bullets));
  if (!entries.length) return '';

  return `%-----------PROJECTS-----------
\\section{Projects} 
    \\vspace{-5pt}
    \\resumeSubHeadingListStart
${entries.map((item, index) => {
    const bullets = Array.isArray(item.bullets) && item.bullets.length
      ? item.bullets
      : (hasText(item.description) ? [{ text: item.description }] : []);
    return `    \\resumeProjectHeading
            {${renderProjectTitle(item)}}{${renderTechStack(item.tech || '')}}
            \\\\[5mm]
          ${renderBullets(bullets).replaceAll('\n', '\n          ')}
 ${index === entries.length - 1 ? '' : '\\vspace{-18pt}'}`.trimEnd();
  }).join('\n')}
    \\resumeSubHeadingListEnd
\\vspace{-18pt}`;
}

function renderLeadership(items = []) {
  const entries = items.filter((item) => hasText(item?.name || item?.title) || hasText(item?.description) || hasItems(item?.bullets));
  if (!entries.length) return '';

  return `%-----------LEADERSHIP-----------
\\section{Leadership} 
    \\vspace{-5pt}
    \\resumeSubHeadingListStart
${entries.map((item, index) => {
    const bullets = Array.isArray(item.bullets) && item.bullets.length
      ? item.bullets
      : (hasText(item.description) ? [{ text: item.description }] : []);
    return `          \\resumeProjectHeading
            {${renderProjectTitle({ ...item, name: item.name || item.title })}}{${latexEscape(item.period || '')}}
            \\\\[5mm]
          ${renderBullets(bullets).replaceAll('\n', '\n          ')}
 ${index === entries.length - 1 ? '' : '\\vspace{-17pt}'}`.trimEnd();
  }).join('\n')}
          \\resumeSubHeadingListEnd
 \\vspace{-12pt}`;
}

function renderSkills(items = []) {
  const entries = items.filter((group) => hasText(group?.category) && Array.isArray(group?.items) && group.items.length > 0);
  if (!entries.length) return '';

  return `%-----------PROGRAMMING SKILLS-----------
\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{   
${entries.map((group, index) => {
    const lineBreak = index === entries.length - 1 ? '' : ' \\\\[1mm]';
    const items = group.items.map((item) => renderClaimText(item)).join(', ');
    return `     \\textbf{${latexEscape(group.category)}}{: ${items}}${lineBreak}`;
  }).join('\n')}
    }}
 \\end{itemize}
 \\vspace{-16pt}
 \\vspace{3pt}
\\vspace{10pt}`;
}

export function renderLatex(cv) {
  const template = readFileSync(join(pluginRoot, 'templates', 'cv-template.tex'), 'utf8');
  const candidate = cv.candidate || {};
  const sections = cv.sections || {};
  const paperFormat = cv.metadata?.paperFormat === 'a4' ? 'a4paper' : 'letterpaper';

  const replacements = {
    '{{PAPER_FORMAT}}': paperFormat,
    '{{NAME}}': latexEscape(stripMarkdownEmphasis(candidate.name || '')),
    '{{CONTACT_ITEMS}}': renderContact(candidate),
    '{{EDUCATION_SECTION}}': renderEducation(sections.education || []),
    '{{EXPERIENCE_SECTION}}': renderExperience(sections.experience || []),
    '{{PROJECTS_SECTION}}': renderProjects(sections.projects || []),
    '{{LEADERSHIP_SECTION}}': renderLeadership(sections.leadership || []),
    '{{SKILLS_SECTION}}': renderSkills(sections.skills || [])
  };

  let latex = template;
  for (const [token, value] of Object.entries(replacements)) {
    latex = latex.replaceAll(token, value);
  }
  return latex;
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '')) {
  const args = parseArgs();
  const input = args._[0];
  const output = args._[1];

  if (!input || !output) {
    console.error('Usage: node scripts/render-latex.mjs <tailored-cv.json> <output.tex>');
    process.exit(1);
  }

  const cv = readJson(input);
  const latex = renderLatex(cv);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, latex, 'utf8');
  console.log(JSON.stringify({ status: 'ok', output }, null, 2));
}
