#!/usr/bin/env node

import { execFileSync, spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import { pathToFileURL } from 'url';
import { pluginRoot, readJson } from './lib/workspace.mjs';
import { validateTailoredCv } from './validate-tailored-cv.mjs';

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(message) {
  console.log(`OK ${message}`);
  passed += 1;
}

function fail(message) {
  console.log(`FAIL ${message}`);
  failed += 1;
}

function warn(message) {
  console.log(`WARN ${message}`);
  warnings += 1;
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: pluginRoot,
    encoding: 'utf8',
    ...options
  });
}

console.log('\nCV Tailor test suite\n');

console.log('1. Syntax and plugin verification');
try {
  execFileSync(process.execPath, ['scripts/check-syntax.mjs'], { cwd: pluginRoot, stdio: 'pipe' });
  pass('all scripts parse');
} catch (error) {
  fail(`syntax check failed: ${error.message}`);
}

const verify = runNode(['scripts/verify.mjs']);
if (verify.status === 0) pass('verify.mjs passes');
else fail(`verify.mjs failed: ${verify.stdout}${verify.stderr}`);

console.log('\n2. Schema validation');
for (const [schemaFile, exampleFile] of [
  ['source-registry.schema.json', 'source-registry.example.json'],
  ['job-dossier.schema.json', 'job-dossier.example.json'],
  ['run-manifest.schema.json', 'run-manifest.example.json'],
  ['tailored-cv.schema.json', 'tailored-cv.example.json'],
  ['tailored-cv.schema.json', 'tailored-cv.latex.example.json']
]) {
  const schema = readJson(join(pluginRoot, 'schemas', schemaFile));
  const example = readJson(join(pluginRoot, 'examples', exampleFile));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (validate(example)) pass(`${exampleFile} matches ${schemaFile}`);
  else fail(`${exampleFile} schema errors: ${JSON.stringify(validate.errors)}`);
}

const sourceRegistry = readJson(join(pluginRoot, 'examples/source-registry.example.json'));
const tailoredCv = readJson(join(pluginRoot, 'examples/tailored-cv.example.json'));
const tailoredValidation = validateTailoredCv(tailoredCv, sourceRegistry);
if (tailoredValidation.ok) pass('source-backed tailored CV validates');
else fail(`source-backed tailored CV failed: ${tailoredValidation.errors.join('; ')}`);

const latexCv = readJson(join(pluginRoot, 'examples/tailored-cv.latex.example.json'));
const latexValidation = validateTailoredCv(latexCv, sourceRegistry);
if (latexValidation.ok) pass('LaTeX source-backed tailored CV validates');
else fail(`LaTeX source-backed tailored CV failed: ${latexValidation.errors.join('; ')}`);

const unsupported = readJson(join(pluginRoot, 'examples/unsupported-claim.example.json'));
const unsupportedValidation = validateTailoredCv(unsupported, sourceRegistry);
if (!unsupportedValidation.ok) pass('unsupported claim fixture fails validation');
else fail('unsupported claim fixture unexpectedly passed');

console.log('\n3. Runtime workspace smoke test');
const workspace = mkdtempSync(join(tmpdir(), 'cv-tailor-test-'));
try {
  const init = runNode(['scripts/init.mjs', '--workspace', workspace]);
  if (init.status === 0 && existsSync(join(workspace, '.cv-tailor/profile.yml'))) pass('init creates runtime workspace');
  else fail(`init failed: ${init.stdout}${init.stderr}`);

  const addSource = runNode([
    'scripts/add-source.mjs',
    '--workspace', workspace,
    '--id', 'cv-current',
    '--type', 'cv',
    '--title', 'Example CV',
    '--path', join(pluginRoot, 'examples/cv-example.md'),
    '--facts', 'Led ML platform team|Reduced model deployment time from 2 weeks to 4 hours'
  ]);
  if (addSource.status === 0) pass('add-source registers a CV source');
  else fail(`add-source failed: ${addSource.stdout}${addSource.stderr}`);

  const htmlPath = join(workspace, '.cv-tailor/runs/example/cv.html');
  const pdfPath = join(workspace, '.cv-tailor/output/example.pdf');
  const latexPath = join(workspace, '.cv-tailor/runs/example/cv.tex');
  const latexPdfPath = join(workspace, '.cv-tailor/output/example-latex.pdf');
  const unifiedHtmlPdfPath = join(workspace, '.cv-tailor/output/example-render-cv-html.pdf');
  const unifiedLatexPdfPath = join(workspace, '.cv-tailor/output/example-render-cv-latex.pdf');
  const renderHtml = runNode(['scripts/render-html.mjs', 'examples/tailored-cv.example.json', htmlPath]);
  if (renderHtml.status === 0 && existsSync(htmlPath)) pass('render-html creates HTML');
  else fail(`render-html failed: ${renderHtml.stdout}${renderHtml.stderr}`);

  const renderPdf = runNode(['scripts/render-pdf.mjs', htmlPath, pdfPath, '--format=a4'], { timeout: 120000 });
  if (renderPdf.status === 0 && existsSync(pdfPath) && statSync(pdfPath).size > 0) pass('render-pdf creates non-empty PDF');
  else fail(`render-pdf failed: ${renderPdf.stdout}${renderPdf.stderr}`);

  const renderLatex = runNode(['scripts/render-latex.mjs', 'examples/tailored-cv.latex.example.json', latexPath]);
  if (renderLatex.status === 0 && existsSync(latexPath)) pass('render-latex creates TeX');
  else fail(`render-latex failed: ${renderLatex.stdout}${renderLatex.stderr}`);
  const latexOutput = existsSync(latexPath) ? readFileSync(latexPath, 'utf8') : '';
  if (latexOutput.includes('\\textbf{custom evaluation metrics}') && latexOutput.includes('100\\%') && latexOutput.includes('Python\\_A \\& Python\\_B')) {
    pass('LaTeX renderer converts emphasis and escapes special characters');
  } else {
    fail('LaTeX renderer did not convert emphasis or escape special characters as expected');
  }
  if (latexOutput.includes('\\href{https://github.com/alexchen/llm-eval-toolkit}{Source Code}') && latexOutput.includes('{Python $|$ LLM evals $|$ CI}')) {
    pass('LaTeX renderer matches project link and tech separator style');
  } else {
    fail('LaTeX renderer did not match project link or tech separator style');
  }
  if (!latexOutput.includes('\\section{Leadership}')) pass('LaTeX renderer skips empty sections');
  else fail('LaTeX renderer rendered an empty Leadership section');

  const compileLatex = runNode(['scripts/compile-latex.mjs', latexPath, latexPdfPath], { timeout: 240000 });
  if (compileLatex.status === 0 && existsSync(latexPdfPath) && statSync(latexPdfPath).size > 0) pass('compile-latex creates non-empty PDF');
  else fail(`compile-latex failed: ${compileLatex.stdout}${compileLatex.stderr}`);

  const renderCvHtml = runNode(['scripts/render-cv.mjs', 'examples/tailored-cv.example.json', unifiedHtmlPdfPath, '--engine=html', '--format=a4'], { timeout: 120000 });
  if (renderCvHtml.status === 0 && existsSync(unifiedHtmlPdfPath) && statSync(unifiedHtmlPdfPath).size > 0) pass('render-cv html creates non-empty PDF');
  else fail(`render-cv html failed: ${renderCvHtml.stdout}${renderCvHtml.stderr}`);

  const renderCvLatex = runNode(['scripts/render-cv.mjs', 'examples/tailored-cv.latex.example.json', unifiedLatexPdfPath, '--engine=latex'], { timeout: 240000 });
  if (renderCvLatex.status === 0 && existsSync(unifiedLatexPdfPath) && statSync(unifiedLatexPdfPath).size > 0) pass('render-cv latex creates non-empty PDF');
  else fail(`render-cv latex failed: ${renderCvLatex.stdout}${renderCvLatex.stderr}`);
  const renderCvLatexSecond = runNode(['scripts/render-cv.mjs', 'examples/tailored-cv.latex.example.json', unifiedLatexPdfPath, '--engine=latex'], { timeout: 240000 });
  const versionedLatexPdfPath = unifiedLatexPdfPath.replace(/\.pdf$/i, '-v2.pdf');
  const versionedLatexRawPath = unifiedLatexPdfPath.replace(/\.pdf$/i, '-v2.tex');
  if (
    renderCvLatexSecond.status === 0
    && existsSync(versionedLatexPdfPath)
    && statSync(versionedLatexPdfPath).size > 0
    && existsSync(versionedLatexRawPath)
    && statSync(versionedLatexRawPath).size > 0
  ) {
    pass('render-cv latex preserves prior PDFs and raw TeX versions');
  } else {
    fail(`render-cv latex versioning failed: ${renderCvLatexSecond.stdout}${renderCvLatexSecond.stderr}`);
  }

  const manifest = runNode([
    'scripts/write-run-manifest.mjs',
    '--workspace', workspace,
    '--tailored-cv', join(pluginRoot, 'examples/tailored-cv.example.json'),
    '--html', htmlPath,
    '--tex', latexPath,
    '--pdf', pdfPath,
    '--renderer', 'html',
    '--approved'
  ]);
  if (manifest.status === 0) pass('write-run-manifest creates manifest');
  else fail(`write-run-manifest failed: ${manifest.stdout}${manifest.stderr}`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

console.log('\n4. ATS and liveness helpers');
const ats = runNode([
  'scripts/ats-keyword-check.mjs',
  'examples/tailored-cv.example.json',
  '--job-dossier', 'examples/job-dossier.example.json',
  '--min', '0.5'
]);
if (ats.status === 0) pass('ATS keyword coverage check passes example threshold');
else fail(`ATS keyword check failed: ${ats.stdout}${ats.stderr}`);

try {
  const { classifyLiveness } = await import(pathToFileURL(join(pluginRoot, 'scripts/liveness-core.mjs')).href);
  const expired = classifyLiveness({
    status: 200,
    finalUrl: 'https://example.com/job/1',
    bodyText: 'This job is no longer available.',
    applyControls: ['Apply']
  });
  const active = classifyLiveness({
    status: 200,
    finalUrl: 'https://example.com/job/2',
    bodyText: 'Senior AI Platform Engineer role description with responsibilities and requirements.'.repeat(8),
    applyControls: ['Apply for this job']
  });
  if (expired.result === 'expired' && active.result === 'active') pass('liveness classifier handles active and expired examples');
  else fail(`liveness classifier unexpected results: ${expired.result}, ${active.result}`);
} catch (error) {
  fail(`liveness classifier crashed: ${error.message}`);
}

console.log('\n5. Local Codex install');
const installHome = mkdtempSync(join(tmpdir(), 'cv-tailor-install-'));
try {
  const install = runNode([
    'scripts/install-codex-local.mjs',
    '--home', installHome,
    '--source', pluginRoot,
    '--force'
  ]);
  if (
    install.status === 0
    && existsSync(join(installHome, 'plugins/cv-tailor/.codex-plugin/plugin.json'))
    && existsSync(join(installHome, '.agents/plugins/marketplace.json'))
    && existsSync(join(installHome, '.codex/config.toml'))
  ) {
    pass('install-codex-local creates plugin, marketplace, and config');
  } else {
    fail(`install-codex-local failed: ${install.stdout}${install.stderr}`);
  }

  const codexDoctor = runNode(['scripts/doctor.mjs', '--codex', '--home', installHome]);
  if (codexDoctor.status === 0) pass('doctor --codex validates local install');
  else fail(`doctor --codex failed: ${codexDoctor.stdout}${codexDoctor.stderr}`);
} finally {
  rmSync(installHome, { recursive: true, force: true });
}

console.log('\n6. Repository hygiene');
if (!existsSync(join(pluginRoot, '.cv-tailor'))) pass('plugin repo has no runtime .cv-tailor data');
else fail('plugin repo contains runtime .cv-tailor data');

const profileTemplate = readFileSync(join(pluginRoot, 'templates/profile.example.yml'), 'utf8');
if (!profileTemplate.includes('Jane Smith') && !profileTemplate.includes('jane@example.com')) pass('runtime profile template has no fake person data');
else fail('runtime profile template still contains fake person data');

const latexReference = readFileSync(join(pluginRoot, 'examples/latex-reference-template.tex'), 'utf8');
if (
  latexReference.includes('\\resumeProjectHeading')
  && latexReference.includes('$|$')
  && latexReference.includes('\\section{Technical Skills}')
  && latexReference.includes('Engineered \\textbf{Large Language Models')
) {
  pass('LaTeX reference template preserves source structure and language style');
} else {
  fail('LaTeX reference template is missing expected structure or language markers');
}

const absolutePathPatterns = ['C:\\Users\\', '/Users/'];
const scanTargets = [
  'skills/cv-tailor/SKILL.md',
  'scripts',
  'templates',
  'schemas',
  'examples',
  'docs'
];
let absoluteLeak = false;
for (const target of scanTargets) {
  const grep = spawnSync('git', ['grep', '-n', '-F', absolutePathPatterns[0], '--', target], { cwd: pluginRoot, encoding: 'utf8' });
  if (grep.stdout.trim()) {
    absoluteLeak = true;
    warn(`Windows absolute path found: ${grep.stdout.trim()}`);
  }
}
if (!absoluteLeak) pass('no Windows absolute paths in tracked implementation files');

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${warnings} warnings`);

if (failed > 0) process.exit(1);
process.exit(0);
