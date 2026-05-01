---
name: cv-tailor
description: Source-grounded CV tailoring workflow for Codex. Use when the user wants a CV or resume tailored to a job application, wants to ground their profile from CVs/GitHub/LinkedIn/projects, or wants an ATS-safe PDF.
user_invocable: true
args: request
argument-hint: "[init | profile | evaluate | pdf | story-bank | verify | job URL or pasted JD]"
---

# CV Tailor

CV Tailor turns candidate context and a job description into a reviewed,
source-backed, ATS-safe CV PDF. It is adapted from the strongest relevant
Career Ops patterns, but the scope is CV tailoring rather than full job-search
automation.

## Non-Negotiable Rules

- Store user data only in the active workspace's `.cv-tailor/` directory.
- Never store candidate CVs, LinkedIn text, private source material, reports, or PDFs inside this plugin repo.
- Never invent experience, metrics, employers, credentials, awards, publications, or dates.
- Every tailored achievement must be grounded in a known source from `.cv-tailor/source-registry.json` or a user-provided source in the current chat.
- Ask for user approval before final PDF generation when tailoring choices materially affect positioning, section order, project selection, or gap framing.
- Ask the user to choose the final renderer for each PDF run: HTML/Playwright or LaTeX/Tectonic.
- Do not scrape LinkedIn behind authentication. Prefer pasted profile text, exported profile PDF/text, or user-approved visible browser context.
- Never submit an application or click a final submit/send/apply button.

## Runtime Layout

There are two important roots:

- **Plugin root:** the installed `cv-tailor` plugin directory that contains `scripts/`, `schemas/`, `templates/`, and this skill.
- **Workspace root:** the user's active project/work folder where runtime data must live.

Before running scripts, identify both paths. Run all CV Tailor scripts from the
plugin root, and pass the user's workspace explicitly with `--workspace` when a
script reads or writes runtime data.

If `.cv-tailor/` is missing in the workspace, run:

```bash
npm --prefix <plugin-root> run init -- --workspace <workspace-root>
```

Expected runtime files:

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

## Routing

Determine the mode from `{{request}}`.

| Input | Mode |
| --- | --- |
| Empty request | Discovery menu |
| `init` | Initialize `.cv-tailor/` |
| `profile` | Gather or update candidate profile/context |
| `evaluate` | Evaluate job fit and tailoring strategy only |
| `pdf` | Generate PDF from an approved tailored CV JSON/HTML |
| `story-bank` | Inspect or update STAR+R story bank |
| `verify` | Validate setup and artifacts |
| Job URL or pasted JD | Full tailor pipeline |

If the request is not a known subcommand but looks like a job URL or JD text,
run the full tailor pipeline.

## Start Here Decision Tree

Use this order for every invocation:

1. Identify `<plugin-root>` and `<workspace-root>`.
2. If the user asks for setup, profile grounding, or the workspace has no `.cv-tailor/`, run `init`.
3. If the user asks to update personal context, add a CV, add GitHub/LinkedIn/project material, or fix profile facts, run `profile`.
4. If the user gives a job URL or pasted JD and asks "should I apply?", "how good is this fit?", or "evaluate", run `evaluate`.
5. If the user gives a job URL or pasted JD and asks for a tailored CV/resume, run the full tailor pipeline.
6. If the user already has an approved `.cv-tailor/runs/{run-id}/tailored-cv.json`, run `pdf`.
7. If the user asks about interview stories, proof points, achievements, or behavioral examples, run `story-bank`.
8. If anything fails or artifacts look inconsistent, run `verify`.

Default to the full tailor pipeline when a request contains both candidate
context and a target job. Do not ask where files are unless the workspace cannot
be inferred.

## Mode Contracts

### `init`

- **Goal:** Create the workspace-local `.cv-tailor/` runtime folder.
- **Read:** Plugin templates only.
- **Write:** `.cv-tailor/profile.yml`, `.cv-tailor/source-registry.json`, `.cv-tailor/story-bank.md`, `.cv-tailor/sources/`, `.cv-tailor/reports/`, `.cv-tailor/output/`, `.cv-tailor/runs/`.
- **Run:** `npm --prefix <plugin-root> run init -- --workspace <workspace-root>`.
- **Stop when:** The runtime folder exists and the user knows which profile/source files still need real data.

### `profile`

- **Goal:** Build or update durable candidate context.
- **Read:** `.cv-tailor/profile.yml`, `.cv-tailor/source-registry.json`, `.cv-tailor/story-bank.md`, files in `.cv-tailor/sources/`, and user-provided chat context.
- **Write:** Profile updates, source registry entries, source files, and story bank entries only when the user confirms the facts are durable.
- **Run when adding files:** `npm --prefix <plugin-root> run add-source -- --workspace <workspace-root> --id <source-id> --type <type> --title <title> --path <file> --facts "fact one|fact two"`.
- **Ask for:** Missing CV/profile text, GitHub/project links, LinkedIn export or pasted profile text, awards, publications, constraints, and target roles.
- **Stop when:** Profile has enough evidence to tailor a CV or when the next missing context is clearly identified.

### `evaluate`

- **Goal:** Produce a job fit report and tailoring strategy without final PDF generation.
- **Read:** Profile, source registry, story bank, candidate sources, and the JD.
- **Write:** `.cv-tailor/reports/{yyyymmdd}-{company-slug}-{role-slug}.md`.
- **Research:** Use web search for current compensation/company context when useful; cite sources. Use browser/Playwright for job URL extraction when available.
- **Stop when:** The report includes A-G blocks, source-backed match table, gaps, ATS keywords, and proposed tailoring choices.

### Full Tailor Pipeline

- **Goal:** Evaluate the job, draft a tailored CV, get human approval, validate source backing, and render an ATS PDF.
- **Read:** Everything used by `evaluate`.
- **Write:** Evaluation report, `.cv-tailor/runs/{run-id}/tailored-cv.json`, rendered HTML, PDF, and run manifest.
- **Approval required before:** Final PDF generation.
- **Stop when:** PDF exists, validation passes, and the user has artifact paths plus residual caveats.

### `pdf`

- **Goal:** Render an already-approved tailored CV JSON/HTML into an ATS PDF.
- **Read:** Approved `tailored-cv.json`, source registry, HTML template, LaTeX template, fonts, and bundled Tectonic on Windows.
- **Write:** HTML or TeX intermediate files plus `.cv-tailor/output/*.pdf`.
- **Ask:** If the user has not already chosen, ask whether to render with HTML/Playwright or LaTeX/Tectonic.
- **Run:** `validate-tailored-cv`, then `render-cv -- --engine=html|latex`, or the explicit renderer scripts.
- **Stop when:** The PDF exists, is non-empty, and the run manifest records the output.

### `story-bank`

- **Goal:** Maintain reusable STAR+R stories for CV bullets, application answers, and interviews.
- **Read:** Story bank, source registry, CV/project sources, evaluation reports.
- **Write:** `.cv-tailor/story-bank.md` only after confirming the story is true and worth keeping.
- **Stop when:** Stories are deduplicated, source-backed, and mapped to likely question or resume-use themes.

### `verify`

- **Goal:** Validate install health and artifact integrity.
- **Read:** Plugin files and, when provided, workspace runtime files.
- **Run:** `npm --prefix <plugin-root> run doctor -- --workspace <workspace-root>`, `npm --prefix <plugin-root> run verify`, and for full repository validation `npm --prefix <plugin-root> run test-all`.
- **Stop when:** Failures are fixed or clearly reported with exact next actions.

## Discovery Mode

Show this concise menu:

```text
CV Tailor

Commands:
  cv-tailor init          Set up .cv-tailor/ in this workspace
  cv-tailor profile       Ground or update candidate context
  cv-tailor evaluate      Create a fit report and tailoring plan
  cv-tailor pdf           Render an approved ATS PDF
  cv-tailor story-bank    Review or update STAR+R stories
  cv-tailor verify        Validate setup and artifacts

Paste a job URL or job description to run the full tailor pipeline.
```

## Full Tailor Pipeline

### 1. Preflight

Run:

```bash
npm --prefix <plugin-root> run doctor -- --workspace <workspace-root>
```

If the user workspace is missing `.cv-tailor/`, run:

```bash
npm --prefix <plugin-root> run init -- --workspace <workspace-root>
```

Check for:

- `.cv-tailor/profile.yml`
- `.cv-tailor/source-registry.json`
- `.cv-tailor/story-bank.md`
- at least one candidate source: prior CV, LinkedIn/profile text, GitHub/project summary, portfolio, awards, publications, or user-provided context

If required context is missing, ask only for the missing pieces. Useful options:

- Paste an existing CV.
- Add previous CV files to `.cv-tailor/sources/`.
- Paste LinkedIn/profile text or upload an export.
- Share GitHub/project repo URLs and a brief summary of which projects matter.
- Paste job details or allow browser extraction of a job URL.

### 2. Job Extraction

For job URLs:

1. Prefer Playwright/browser rendering for modern job pages.
2. If blocked by auth, paywall, or a dynamic page that cannot be read, ask the user to paste the JD text.
3. For live URLs, use `npm --prefix <plugin-root> run check-liveness -- <job-url>` when a deterministic active/expired check is useful.
4. Use web search only for public company/compensation research, not to invent JD content.

For pasted JD text, use it directly.

### 3. Profile Grounding

Read and reconcile:

- `.cv-tailor/profile.yml`
- `.cv-tailor/source-registry.json`
- `.cv-tailor/story-bank.md`
- any user-supplied sources in the current task

Build a grounded profile with:

- target roles and positioning
- experience timeline
- proof points and metrics
- project inventory
- awards, publications, education, certifications
- constraints: location, work authorization, salary preferences, language, preferred CV length

Record new durable source material in `.cv-tailor/source-registry.json` only with user consent.

### 4. Evaluation Report

Produce and save a report in `.cv-tailor/reports/{yyyymmdd}-{company-slug}-{role-slug}.md`.

Use this structure:

```markdown
# CV Tailor Evaluation: {Company} - {Role}

**Date:** {YYYY-MM-DD}
**Source:** {JD URL or pasted text}
**Recommendation:** {Tailor now | Needs more context | Do not apply}
**PDF:** {pending}

## A) Role Summary
## B) Source-Backed CV Match
## C) Level And Positioning Strategy
## D) Compensation And Company Context
## E) CV Personalization Plan
## F) Story Bank And Interview Hooks
## G) Posting Legitimacy
## H) Human Review Choices
## ATS Keywords
```

For Block B, map each important JD requirement to exact candidate source IDs.
If no source supports a requirement, mark it as a gap and propose honest
mitigation.

For Block F, propose STAR+R stories and append durable stories to
`.cv-tailor/story-bank.md` only after user approval.

### 5. Human Review Gate

Draft reports, evidence matrices, and draft tailored CV JSON may be created
without approval. Final PDF generation requires approval whenever the CV changes
positioning, section order, selected projects, experience bullets, gap framing,
or any claim that could affect how the candidate is represented.

Before generating the final PDF, present a concise approval packet and ask the
user to approve or adjust:

- CV headline/positioning
- selected projects
- experience order and top bullets
- whether to include awards/publications/certifications
- gap framing
- paper format (`a4` or `letter`)
- one-page vs two-page target when relevant
- final renderer: `html` for the existing Playwright flow, or `latex` for the compact engineering resume template

If the user says "generate without asking", still stop for approval when:

- a claim is unsupported or ambiguous
- a title, employer, date, credential, award, publication, or metric is newly inferred
- a gap is being reframed as experience
- the CV would omit a major role or materially change seniority positioning
- the final renderer has not been selected

Do not render the final PDF until these choices are settled. Never treat the
approval gate as permission to submit an application.

### 6. Tailored CV JSON

Create `.cv-tailor/runs/{run-id}/tailored-cv.json` using
`schemas/tailored-cv.schema.json` as the target shape.

Every bullet or substantial claim must include `sourceIds`.
When the final renderer is selected, set `metadata.renderEngine` to `html` or
`latex`. Use Markdown emphasis such as `**Python**`, `**37%**`, or
`**LLM evaluation**` for scan-critical terms; renderers convert this to
`<strong>` or `\textbf{}`.

Validate:

```bash
npm --prefix <plugin-root> run validate-tailored-cv -- <workspace-root>/.cv-tailor/runs/{run-id}/tailored-cv.json --workspace <workspace-root>
```

### 7. Render PDF

Use the renderer approved by the user.

Unified rendering:

```bash
npm --prefix <plugin-root> run render-cv -- <workspace-root>/.cv-tailor/runs/{run-id}/tailored-cv.json <workspace-root>/.cv-tailor/output/cv-{candidate}-{company}-{date}.pdf --engine=html --format=a4
```

For LaTeX:

```bash
npm --prefix <plugin-root> run render-cv -- <workspace-root>/.cv-tailor/runs/{run-id}/tailored-cv.json <workspace-root>/.cv-tailor/output/cv-{candidate}-{company}-{date}.pdf --engine=latex
```

Explicit HTML steps:

```bash
npm --prefix <plugin-root> run render-html -- <workspace-root>/.cv-tailor/runs/{run-id}/tailored-cv.json <workspace-root>/.cv-tailor/runs/{run-id}/cv.html
```

Render PDF:

```bash
npm --prefix <plugin-root> run render-pdf -- <workspace-root>/.cv-tailor/runs/{run-id}/cv.html <workspace-root>/.cv-tailor/output/cv-{candidate}-{company}-{date}.pdf --format=a4
```

Explicit LaTeX steps:

```bash
npm --prefix <plugin-root> run render-latex -- <workspace-root>/.cv-tailor/runs/{run-id}/tailored-cv.json <workspace-root>/.cv-tailor/runs/{run-id}/cv.tex
npm --prefix <plugin-root> run compile-latex -- <workspace-root>/.cv-tailor/runs/{run-id}/cv.tex <workspace-root>/.cv-tailor/output/cv-{candidate}-{company}-{date}.pdf
```

Check ATS keyword coverage when a job dossier or keyword list exists:

```bash
npm --prefix <plugin-root> run ats-keyword-check -- <workspace-root>/.cv-tailor/runs/{run-id}/tailored-cv.json --job-dossier <workspace-root>/.cv-tailor/runs/{run-id}/job-dossier.json --min 0.6
```

Update the run manifest after generation:

```bash
npm --prefix <plugin-root> run write-run-manifest -- --workspace <workspace-root> --tailored-cv <workspace-root>/.cv-tailor/runs/{run-id}/tailored-cv.json --html <workspace-root>/.cv-tailor/runs/{run-id}/cv.html --tex <workspace-root>/.cv-tailor/runs/{run-id}/cv.tex --pdf <workspace-root>/.cv-tailor/output/cv-{candidate}-{company}-{date}.pdf --renderer <html|latex> --approved
```

### 8. Verification

Run:

```bash
npm --prefix <plugin-root> run verify
```

For a full plugin regression check, run:

```bash
npm --prefix <plugin-root> run test-all
```

Also check that:

- PDF exists and is non-empty.
- The generated CV avoids unsupported claims.
- The output uses standard ATS sections.
- The user has reviewed the final content before using it.

## Source Registry Update Rules

Use `.cv-tailor/source-registry.json` as the durable evidence index. Update it
conservatively.

- Add a source only when the user provides it or explicitly approves making it durable.
- Use stable IDs: `cv-2026`, `linkedin-2026-04`, `github-repo-{slug}`, `project-{slug}`, `award-{slug}`, `publication-{slug}`.
- Prefer storing source files in `.cv-tailor/sources/` and referencing them by relative path.
- For URLs, keep the URL and add a short `notes` summary. Do not treat a URL as proof of a fact unless the visible content supports it.
- Extract `facts` as short, atomic statements. Keep the user's wording when precision matters.
- Do not silently add inferred facts, guessed metrics, or rewritten achievements to the registry.
- When new chat context matters for future CVs, ask: "Should I add this to your CV Tailor source registry?"
- Deduplicate by source URL/path/title before adding a new source.
- If a source contradicts another source, keep both and note the conflict instead of overwriting history.
- If a fact is sensitive or private, ask whether it should be excluded from generated CVs by default.
- Use `add-source` for durable file-backed sources so files are copied into `.cv-tailor/sources/` and dedupe rules are applied.

## Writing And ATS Rules

- Use standard section names: Professional Summary, Core Competencies, Work Experience, Projects, Education, Certifications, Skills.
- Use single-column layout, selectable text, no images for critical information.
- Use action verbs and concrete proof.
- Prefer compact technical delivery: "Engineered X using Y, improving Z by N" over broad responsibility statements.
- Use Markdown emphasis around scan-critical technologies, metrics, and outcomes, but do not bold ordinary filler.
- Avoid "passionate about", "results-oriented", "proven track record", "leveraged", "spearheaded", "synergies", "cutting-edge", and generic filler.
- Keyword injection must be truthful: translate user evidence into the JD's vocabulary without adding fake skills.
- Prefer ASCII punctuation in generated CV text for ATS compatibility.

## LaTeX Resume Style

Use this style for both renderers, because the writing quality should be
renderer-neutral.

- Write dense, technical, achievement-led bullets similar to the bundled LaTeX sample.
- Start bullets with precise verbs such as Engineered, Analyzed, Integrated, Designed, Implemented, Programmed, Centralized, Built, Developed, Shipped, Automated.
- Include technologies in bold only when they matter for recruiter scan or ATS match.
- Include metrics only when sourced: counts, money, percentages, users, latency, throughput, deployment time, or recurring operations scale.
- Prefer one-line bullets; allow two lines only for high-value evidence.
- Preserve exact titles, organizations, dates, awards, schools, and credentials from sources.
- Do not manufacture internships, work experience, metrics, GPA, graduation dates, or course names.
- For LaTeX output, preserve section order: Education, Work Experience, Projects, Leadership, Technical Skills.
- Skip LaTeX sections with no source-backed content; do not render "N/A" placeholders.
- Use `metadata.renderEngine = "latex"` only after the user chooses the LaTeX renderer.

## CV Content Generation

Generate CV content from evidence first, writing second. Use the Career Ops
pattern: JD requirements -> candidate proof -> honest gap strategy -> ATS
wording -> reviewed PDF.

### 1. Build The Evidence Matrix

Before drafting, create a working matrix:

| JD requirement | Priority | Candidate evidence | Source IDs | Gap strategy |
| --- | --- | --- | --- | --- |

Rules:

- Treat must-have requirements, repeated keywords, role scope, and first-year responsibilities as high priority.
- Match evidence to exact source IDs, not memory.
- Mark unsupported requirements as gaps. Do not hide them.
- Use adjacent evidence only when the relationship is honest and explainable.

### 2. Select The Resume Strategy

Choose the strategy from the matrix:

- **Direct match:** Lead with exact proof and JD language.
- **Adjacent match:** Lead with transferable systems, domain, scale, or stakeholder proof.
- **Stretch:** Be explicit about learning/gap mitigation; do not claim experience.
- **Low fit:** Recommend against tailoring unless the user gives a reason to proceed.

Also decide:

- primary title/headline
- top 6-8 competencies
- top 3-5 source-backed achievements
- which projects to include or omit
- whether the CV should target one page or two pages

### 3. Professional Summary

Write 3-4 lines. Include:

- current professional identity matched to the role
- strongest source-backed scope or domain
- 1-2 sourced proof points or measurable outcomes
- bridge to the target company/role domain

Do not write generic claims like "passionate", "results-oriented", or
"proven track record". Do not overstuff keywords. Every sentence must be
defensible from source IDs.

### 4. Core Competencies

Choose 6-8 phrases from the JD that are also supported by evidence. Use exact
JD vocabulary when it is truthful. Prefer phrases such as:

- "LLM evaluation and regression testing"
- "Postgres-backed data pipelines"
- "Cross-functional product delivery"

Avoid unsupported skill tags. If a keyword is only adjacent, place it in a
bullet with context rather than as a standalone competency.

In `tailored-cv.json`, each competency must be an object:

```json
{ "text": "LLM evaluation", "sourceIds": ["project-eval-toolkit"] }
```

### 5. Work Experience

Keep titles, employers, dates, and locations faithful to source material.

For each selected role:

- Put the most job-relevant bullet first.
- Start bullets with concrete action verbs.
- Include metrics only when sourced.
- Prefer "Built X that achieved Y" over broad responsibility statements.
- Reword for the JD vocabulary without changing the underlying claim.
- Keep bullets concise: usually 1 line, max 2 lines in the rendered PDF.

Good transformations:

- Source: "built retrieval over internal docs" + JD: "RAG pipelines" -> "Built retrieval-augmented workflows over internal documents..."
- Source: "monitored model drift" + JD: "MLOps observability" -> "Implemented MLOps observability for model drift..."

Bad transformations:

- Adding Kubernetes because the JD mentions it but sources only show Docker.
- Turning "worked with the ML team" into "led ML strategy".
- Rounding vague impact into a fake percentage.

### 6. Projects

Select projects that close JD gaps or prove role-specific strengths. For each
project include:

- project name
- one-line outcome or problem solved
- relevant technologies
- source IDs

Prefer a smaller number of sharper projects over a long project list. Put public
links in contact/profile context when they materially help the recruiter verify
the work.

### 7. Education, Certifications, Awards, Publications

Include these when they strengthen the application or satisfy explicit JD
requirements. Never invent credentials. For awards/publications, include the
issuer/venue and year when sourced. Omit weak or irrelevant credentials if the
CV is space-constrained.

### 8. Skills

Group skills by useful recruiter scan categories:

- Languages
- AI/ML
- Data
- Cloud/Infrastructure
- Product/Delivery
- Domain

Only include skills supported by sources or explicitly confirmed by the user.
Use skill groups to mirror the JD, but do not keyword-stuff.

### 9. Gap Handling

Do not disguise gaps as experience. Use one of:

- omit the unsupported keyword from the CV
- include an adjacent proof point
- mention a fast-learning or portfolio mitigation in the report, not the CV
- ask the user for a real source if they have the experience

### 10. Final Content Quality Bar

Before validation/rendering, check:

- Every substantial claim has `sourceIds`.
- The top third of the CV explains fit within a 6-second scan.
- The first page contains the strongest JD-relevant proof.
- Keywords appear naturally in summary, competencies, top bullets, and skills.
- There are no unsupported seniority upgrades, fake metrics, or invented tools.
- Text uses ASCII-safe punctuation where possible.
- The rendered CV has no obvious overflow, tiny text, or section crowding.

## Source-Backed Claim Model

A claim is source-backed when it references one or more source IDs from
`.cv-tailor/source-registry.json` or from a source newly provided in the chat.

Examples:

- Good: "Reduced fraud review latency by 42%" with `sourceIds: ["cv-2026", "project-fraudshield"]`.
- Bad: "Expert in Kubernetes" when no source mentions Kubernetes.
- Good mitigation: "Adjacent experience: shipped Dockerized services; Kubernetes is a learning gap."

If the user explicitly asks to include a claim that is not sourced, flag it and
ask for a source or rewrite it as an aspiration/gap, not as experience.
