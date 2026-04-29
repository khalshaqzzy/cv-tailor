# Security

CV Tailor handles sensitive career material, so the repo separates plugin code
from runtime user data.

## Security Model

- Plugin files are versioned and reusable.
- Runtime user data belongs in `.cv-tailor/` inside the active workspace.
- `.cv-tailor/` is gitignored by default.
- Final CV claims must reference registered source IDs before PDF generation.
- LinkedIn/profile handling should use pasted, exported, or user-visible
  context rather than unauthorized scraping.

## Recommended Practices

- Keep private CVs, profile exports, and job notes out of the plugin repo.
- Run `npm run doctor -- --workspace <path>` before generating final PDFs.
- Run `npm run validate-tailored-cv -- <json> --source-registry <registry>`
  before rendering.
- Review generated PDFs manually before submission.
- Remove generated artifacts from shared workspaces when they are no longer
  needed.

## Reporting Issues

Open a GitHub issue for bugs or security concerns. Do not include private CVs,
job applications, profile exports, credentials, tokens, or personal documents in
public reports.
