# CV Tailor

CV Tailor is a root-level Codex plugin for creating source-grounded, ATS-safe
CVs tailored to a specific job application.

The workflow is intentionally human-in-the-loop. Codex gathers candidate
context, grounds claims in known sources, evaluates the job, proposes tailoring
choices, asks for approval, and only then renders a PDF.

## Install

Install this repository as a local Codex plugin. The manifest lives at:

```text
.codex-plugin/plugin.json
```

Install dependencies for PDF generation:

```bash
npm install
npx playwright install chromium
```

Validate the plugin:

```bash
npm run doctor
npm run verify
```

## Runtime Data

User-specific data is never stored in the plugin files. When used inside a
workspace, CV Tailor writes runtime files under that workspace's `.cv-tailor/`
directory:

```text
.cv-tailor/
  profile.yml
  source-registry.json
  story-bank.md
  sources/
  reports/
  output/
  runs/
```

Initialize a workspace manually:

```bash
npm run init -- --workspace /path/to/workspace
```

## Skill Usage

After installing the plugin, ask Codex:

```text
Tailor my CV for this job description.
Ground my profile from my CV and GitHub projects.
Generate an ATS PDF after I approve the tailoring plan.
```

The `cv-tailor` skill supports:

- `init`
- `profile`
- `evaluate`
- `pdf`
- `story-bank`
- `verify`
- raw job descriptions or job URLs for the full pipeline

## PDF Pipeline

Render HTML to PDF:

```bash
npm run render-pdf -- input.html output.pdf --format=a4
```

Render a validated tailored CV JSON file to HTML:

```bash
npm run render-html -- examples/tailored-cv.example.json output/sample.html
```

Validate source-backed claims:

```bash
npm run validate-tailored-cv -- examples/tailored-cv.example.json --source-registry examples/source-registry.example.json
```

## Attribution

This plugin adapts selected MIT-licensed workflow ideas from
[Career Ops](https://github.com/santifer/career-ops), focused specifically on
Codex plugin installation and CV tailoring.
