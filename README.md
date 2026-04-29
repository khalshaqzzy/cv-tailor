# CV Tailor

<p align="center">
  <img src="assets/logo.svg" alt="CV Tailor logo" width="160">
</p>

<p align="center">
  <strong>Codex plugin for source-grounded, ATS-safe CV tailoring.</strong><br>
  Turn a real candidate profile and a real job description into a reviewed,
  evidence-backed PDF resume.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Codex-plugin-111827?style=flat" alt="Codex plugin">
  <img src="https://img.shields.io/badge/Node.js-%3E=18-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js >= 18">
  <img src="https://img.shields.io/badge/Playwright-PDF-2EAD33?style=flat&logo=playwright&logoColor=white" alt="Playwright">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT">
</p>

## What Is This

CV Tailor is a root-level Codex plugin that helps Codex create tailored resumes
without inventing candidate experience.

Instead of asking an agent to "make my CV fit this job" and hoping it stays
truthful, CV Tailor gives Codex a workflow and tooling for:

- **Profile grounding** from CVs, GitHub/project repos, LinkedIn/profile text,
  portfolios, awards, publications, and user notes.
- **Source-backed claims** where every meaningful bullet or competency points
  to one or more registered evidence sources.
- **Job evaluation** using a structured A-G report: role summary, CV match,
  positioning strategy, company context, personalization plan, story bank hooks,
  and posting legitimacy.
- **Human-in-the-loop tailoring** before final PDF generation.
- **ATS-safe PDF generation** with a single-column HTML template, self-hosted
  fonts, Unicode normalization, and Playwright rendering.
- **Runtime isolation** so private user data lives in the user's workspace,
  never in this plugin repository.

> Important: CV Tailor is not a job-spam tool. It does not submit applications,
> does not fabricate missing experience, and should not be used to misrepresent
> a candidate. It helps make real evidence legible for a specific role.

## Features

| Feature | Description |
| --- | --- |
| Codex Skill | `cv-tailor` routes setup, profile grounding, evaluation, PDF rendering, story-bank work, and verification. |
| Source Registry | Durable evidence index in `.cv-tailor/source-registry.json`, with helper script for adding file-backed sources. |
| Claim Validation | Tailored CV JSON is checked for approved generation and valid `sourceIds`. Unsupported claims fail validation. |
| A-G Evaluation | Report structure adapted from Career Ops: role summary through posting legitimacy and human review choices. |
| Story Bank | STAR+R story-bank template for reusable interview and resume proof points. |
| ATS PDF | HTML-to-PDF rendering via Playwright with Space Grotesk + DM Sans, single-column layout, and ATS text normalization. |
| Keyword Coverage | Checks tailored CV content against a job dossier or keyword list. |
| Liveness Check | Playwright-based job URL active/expired classifier for posting legitimacy workflows. |
| Run Manifests | Captures generated artifacts, approval state, job metadata, and PDF verification. |
| Regression Suite | `npm run test-all` validates schemas, examples, runtime init, source ingestion, HTML/PDF rendering, liveness, and hygiene. |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/khalshaqzzy/cv-tailor.git
cd cv-tailor
npm install
npx playwright install chromium

# 2. Verify the plugin
npm run doctor
npm run test-all

# 3. Initialize a user workspace
npm run init -- --workspace /path/to/workspace

# 4. Add a real CV source
npm run add-source -- \
  --workspace /path/to/workspace \
  --id cv-current \
  --type cv \
  --title "Current CV" \
  --path /path/to/current-cv.md \
  --facts "Led ML platform team|Reduced deployment time from 2 weeks to 4 hours"
```

After installing the plugin in Codex, ask:

```text
Use cv-tailor to tailor my CV for this job description.
```

or:

```text
Use cv-tailor profile to ground my profile from this CV and these GitHub repos.
```

## Install As A Codex Plugin

This repository is the plugin root. The manifest is:

```text
.codex-plugin/plugin.json
```

The plugin exposes:

```text
skills/cv-tailor/SKILL.md
```

Install this repository as a local Codex plugin using your Codex plugin
installation flow. Once installed, Codex can trigger the `cv-tailor` skill when
the user asks for resume/CV tailoring, profile grounding, ATS PDF generation, or
job-specific CV evaluation.

## Runtime Data

User-specific data is stored in the active workspace under `.cv-tailor/`.
Plugin source files stay generic and installable.

```text
.cv-tailor/
  profile.yml              # Candidate identity, targets, constraints, preferences
  source-registry.json     # Source-backed evidence index
  story-bank.md            # Reusable STAR+R stories
  sources/                 # Private CVs, exports, notes, project evidence
  reports/                 # Evaluation reports
  output/                  # Generated PDFs
  runs/                    # Per-job tailored CV JSON, HTML, manifests
```

The runtime folder includes its own `.gitignore` so local private material is
not accidentally committed.

## Usage

The `cv-tailor` skill supports these modes:

| User intent | Mode |
| --- | --- |
| Set up runtime files | `cv-tailor init` |
| Add or update candidate context | `cv-tailor profile` |
| Evaluate a job without final PDF | `cv-tailor evaluate` |
| Render an approved tailored CV | `cv-tailor pdf` |
| Review or update proof stories | `cv-tailor story-bank` |
| Validate plugin/runtime health | `cv-tailor verify` |
| Paste a JD or job URL | Full tailor pipeline |

Suggested prompts:

```text
Use cv-tailor to initialize this workspace.
Use cv-tailor profile. I am pasting my current CV and project notes.
Use cv-tailor evaluate for this job URL.
Use cv-tailor to generate an ATS PDF after I approve the tailoring plan.
Use cv-tailor story-bank to turn these achievements into STAR+R stories.
```

## How It Works

```text
Candidate sources + job description
        |
        v
Preflight and workspace setup
        |
        v
Profile grounding and source registry
        |
        v
A-G evaluation report
        |
        v
Human review gate
        |
        v
tailored-cv.json
        |
        v
source validation -> HTML -> PDF -> run manifest
```

## Source-Backed Claim Model

The core rule is simple: if the final CV says it, there must be evidence for it.

Each meaningful claim in `tailored-cv.json` includes `sourceIds`:

```json
{
  "text": "Reduced model deployment time from 2 weeks to 4 hours with CI/CD paths for tested model releases.",
  "sourceIds": ["cv-current"]
}
```

Competencies are source-backed too:

```json
{
  "text": "LLM evaluation",
  "sourceIds": ["project-eval-toolkit"]
}
```

Unsupported sources fail validation:

```bash
npm run validate-tailored-cv -- \
  examples/unsupported-claim.example.json \
  --source-registry examples/source-registry.example.json
```

## Full Tailor Pipeline

The full workflow is intentionally conservative:

1. **Preflight** - Check plugin install, dependencies, browser, and workspace.
2. **Context gathering** - Ask only for missing CV/profile/project/JD context.
3. **Profile grounding** - Build the evidence map from profile and registry.
4. **Job extraction** - Read a pasted JD or browser-render a public job URL.
5. **Evaluation** - Create an A-G report with match, gaps, strategy, and ATS keywords.
6. **Human review** - Ask the user to approve positioning, project selection, gap framing, and PDF settings.
7. **Tailored CV JSON** - Produce structured CV content with `sourceIds`.
8. **Validation and rendering** - Validate claims, render HTML, create PDF, write manifest.

## Script Reference

| Command | Purpose |
| --- | --- |
| `npm run doctor` | Validate plugin prerequisites. Add `-- --workspace <path>` to check runtime files. |
| `npm run init -- --workspace <path>` | Create `.cv-tailor/` runtime structure. |
| `npm run add-source -- ...` | Copy a source file into `.cv-tailor/sources/` and register its facts. |
| `npm run validate-tailored-cv -- <json>` | Validate tailored CV shape, approval, and source references. |
| `npm run render-html -- <json> <html>` | Render a tailored CV JSON file to ATS-safe HTML. |
| `npm run render-pdf -- <html> <pdf> --format=a4` | Render HTML to PDF using Playwright. |
| `npm run ats-keyword-check -- <json> --job-dossier <job.json>` | Measure keyword coverage against a job dossier. |
| `npm run check-liveness -- <url>` | Check whether a public job URL appears active, expired, or uncertain. |
| `npm run write-run-manifest -- ...` | Record generated artifacts and approval state. |
| `npm run verify` | Validate plugin files and examples. |
| `npm run test-all` | Run the full regression suite. |

## Examples

The `examples/` directory contains fixtures adapted from the Career Ops style:

| File | Purpose |
| --- | --- |
| `examples/cv-example.md` | Example candidate CV source. |
| `examples/source-registry.example.json` | Evidence registry for the example CV/project. |
| `examples/job-dossier.example.json` | Example job dossier and ATS keywords. |
| `examples/evaluation-report.example.md` | Example A-G evaluation report. |
| `examples/tailored-cv.example.json` | Valid source-backed tailored CV fixture. |
| `examples/unsupported-claim.example.json` | Negative fixture that should fail validation. |
| `examples/run-manifest.example.json` | Example run manifest. |

Try the example pipeline:

```bash
npm run validate-tailored-cv -- \
  examples/tailored-cv.example.json \
  --source-registry examples/source-registry.example.json

npm run render-html -- \
  examples/tailored-cv.example.json \
  /tmp/cv-tailor-example.html

npm run render-pdf -- \
  /tmp/cv-tailor-example.html \
  /tmp/cv-tailor-example.pdf \
  --format=a4

npm run ats-keyword-check -- \
  examples/tailored-cv.example.json \
  --job-dossier examples/job-dossier.example.json \
  --min 0.5
```

On Windows PowerShell, replace `/tmp/...` with a local path such as
`$env:TEMP\cv-tailor-example.html`.

## Project Structure

```text
cv-tailor/
  .codex-plugin/
    plugin.json
  skills/
    cv-tailor/
      SKILL.md
  scripts/
    add-source.mjs
    ats-keyword-check.mjs
    check-liveness.mjs
    doctor.mjs
    init.mjs
    render-html.mjs
    render-pdf.mjs
    test-all.mjs
    validate-tailored-cv.mjs
    verify.mjs
    write-run-manifest.mjs
    lib/
      workspace.mjs
  schemas/
    profile.schema.json
    source-registry.schema.json
    job-dossier.schema.json
    tailored-cv.schema.json
    run-manifest.schema.json
  templates/
    cv-template.html
    profile.example.yml
    source-registry.example.json
    story-bank.template.md
  examples/
  fonts/
  assets/
```

## Data Contract

CV Tailor follows the same separation principle as Career Ops:

| Layer | Files | Rule |
| --- | --- | --- |
| Plugin/system layer | `skills/`, `scripts/`, `schemas/`, `templates/`, `examples/`, `fonts/`, `assets/` | Safe to version and update. No private user data. |
| User/runtime layer | `.cv-tailor/profile.yml`, `.cv-tailor/source-registry.json`, `.cv-tailor/sources/`, `.cv-tailor/reports/`, `.cv-tailor/output/`, `.cv-tailor/runs/` | Private workspace data. Do not commit by default. |

## ATS PDF Design

The default template is intentionally plain and parser-friendly:

- Single-column layout.
- Standard section names.
- Selectable text, not rasterized content.
- No critical information in images.
- Space Grotesk headings and DM Sans body text.
- Self-hosted `.woff2` fonts.
- ASCII-safe normalization for smart quotes, dashes, zero-width characters, and non-breaking spaces.
- A4 or Letter output through Playwright.

## Human-In-The-Loop Rules

Codex can draft reports, evidence matrices, and tailored CV JSON. It should stop
for user approval before final PDF generation when the CV changes:

- headline or seniority positioning
- selected projects
- experience bullet order or wording
- awards, publications, certifications, or credentials
- gap framing
- page format or length target

Even if the user asks to generate without review, unsupported or ambiguous
claims must be resolved before rendering the final PDF.

## Privacy And Ethics

CV Tailor is local software. It does not host, collect, or store your data
outside your machine. Your data may still be sent to whatever AI provider or
Codex environment you choose to use.

Use it responsibly:

- Do not invent experience, metrics, education, employers, credentials, awards,
  or publications.
- Do not scrape private LinkedIn pages or authenticated job systems without
  user-visible consent.
- Do not submit applications automatically.
- Review every generated CV before using it.
- Respect job board and employer terms of service.

## Testing

Run the complete test suite before committing changes:

```bash
npm run test-all
```

The suite checks:

- script syntax
- plugin verification
- JSON schemas and examples
- valid and invalid source-backed CV fixtures
- runtime workspace initialization
- source ingestion
- HTML and PDF rendering
- run manifest writing
- ATS keyword coverage
- liveness classification
- repository hygiene

## Roadmap

Useful next improvements:

- More source ingestion helpers for GitHub repos, exported LinkedIn PDFs, and
  portfolio pages.
- A deterministic job-dossier builder from pasted JD text.
- Better rendered-PDF layout inspection.
- Optional cover letter generation using the same source-backed claim model.
- Multilingual mode references for non-English CVs and job descriptions.

## Attribution

CV Tailor adapts selected MIT-licensed workflow ideas from
[Career Ops](https://github.com/santifer/career-ops), especially the
human-in-the-loop career workflow, A-G evaluation structure, story-bank concept,
ATS PDF strategy, and Playwright-based rendering approach.

## License

MIT
