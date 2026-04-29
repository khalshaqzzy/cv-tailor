# Privacy

CV Tailor is designed for local, workspace-scoped CV tailoring.

## Data Location

The plugin repository contains generic source code, schemas, examples,
templates, fonts, and assets. It should not contain private user data.

User-specific runtime data is written under the active workspace:

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

This may include CVs, profile exports, job descriptions, project notes, source
files, generated reports, tailored CV JSON, HTML, and PDF artifacts.

## Network And AI Provider Use

CV Tailor itself does not operate a hosted service and does not collect data.
When used through Codex, the content you provide to Codex may be processed by
the AI provider and environment configured by the user. Review your Codex and
AI provider settings before sharing sensitive personal information.

## LinkedIn And Job Sites

CV Tailor does not require unauthorized scraping. Prefer pasted profile text,
exported profile PDFs/text, pasted job descriptions, or browser-visible content
the user has permission to view.

## User Responsibilities

Users should review generated artifacts before using them, avoid committing
`.cv-tailor/` runtime data, and remove private files from shared workspaces when
they are no longer needed.
