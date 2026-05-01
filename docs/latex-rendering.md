# LaTeX Rendering

CV Tailor supports two final PDF renderers:

- **HTML**: the existing HTML -> Playwright flow.
- **LaTeX**: a compact engineering resume template compiled with the bundled
  Tectonic executable.

The user should choose the renderer during the human review gate before final
PDF generation.

## Commands

Render LaTeX from a tailored CV JSON file:

```bash
npm run render-latex -- examples/tailored-cv.latex.example.json /tmp/cv-tailor-example.tex
```

Compile LaTeX to PDF:

```bash
npm run compile-latex -- /tmp/cv-tailor-example.tex /tmp/cv-tailor-example.pdf
```

Render through the unified command:

```bash
npm run render-cv -- examples/tailored-cv.latex.example.json /tmp/cv-tailor-example.pdf --engine=latex
npm run render-cv -- examples/tailored-cv.example.json /tmp/cv-tailor-example.pdf --engine=html --format=a4
```

On Windows PowerShell, replace `/tmp/...` with a local path such as
`$env:TEMP\cv-tailor-example.tex`.

## Template Rules

The LaTeX template is intentionally close to the provided engineering resume
format:

- `letterpaper`, 11pt document class by default; `a4` maps to `a4paper`.
- `fullpage`, `titlesec`, `enumitem`, `hyperref`, `fancyhdr`, `tabularx`, and
  `geometry` are kept.
- `fontawesome5` remains disabled because it can crash bundled Tectonic on
  Windows.
- `glyphtounicode` remains disabled because it is pdfTeX-specific.
- Section order is fixed: Education, Work Experience, Projects, Leadership,
  Technical Skills.
- Empty sections are omitted rather than rendered with placeholder text.

## Writing Style

Both HTML and LaTeX renderers should use the same CV-writing policy:

- Compact bullets with action verbs, technical keywords, metrics, and outcomes.
- Markdown emphasis for scan-critical terms: `**Python**`, `**37%**`,
  `**LLM evaluation**`.
- Source-backed metrics only; never invent percentages, counts, credentials, or
  dates.
- Truthful JD vocabulary translation rather than keyword stuffing.

The renderers convert Markdown emphasis into:

- HTML: `<strong>...</strong>`
- LaTeX: `\textbf{...}`

## Compiler

This repository vendors the Windows Tectonic executable:

```text
bin/tectonic.exe
```

The first bundled target is Windows only. Non-Windows users can still use the
HTML renderer until platform-specific Tectonic binaries are added.

Tectonic is bundled as the compiler executable, so users do not need a system
TeX installation or the external LaTeX Tectonic Codex plugin. Tectonic may still
populate its own package cache when compiling documents that use standard LaTeX
packages.

Check the compiler:

```bash
npm run doctor
node scripts/tectonic-path.mjs
```

## Troubleshooting

- If LaTeX compilation fails, inspect the generated `.tex` file first.
- If a URL breaks compilation, keep the URL in candidate contact/project link
  fields so the renderer can escape it.
- If text contains `%`, `$`, `_`, `&`, `#`, braces, backslashes, tildes, or
  carets, keep it in JSON as normal text; the renderer escapes these characters.
- If the final PDF is too dense, reduce bullet count before changing spacing.
