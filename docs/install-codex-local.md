# Install CV Tailor As A Local Codex Plugin

CV Tailor is a plugin root. Codex discovers it through a local marketplace entry
and an enabled plugin block in `config.toml`.

There are two supported workflows:

- **Scripted install**: use `npm run install:codex` to create/update local
  marketplace metadata and Codex config.
- **Manual install**: copy the snippets below if you want to manage Codex config
  yourself.

After either workflow, restart Codex or open a new thread so the plugin list is
refreshed.

## Scripted Local Install

Windows PowerShell:

```powershell
git clone https://github.com/khalshaqzzy/cv-tailor "$HOME\plugins\cv-tailor"
Set-Location "$HOME\plugins\cv-tailor"
npm run setup
npm run install:codex
npm run doctor -- --codex
```

macOS/Linux:

```bash
git clone https://github.com/khalshaqzzy/cv-tailor "$HOME/plugins/cv-tailor"
cd "$HOME/plugins/cv-tailor"
npm run setup
npm run install:codex
npm run doctor -- --codex
```

The installer is idempotent. It:

- uses the current plugin root as the source
- installs or verifies the plugin at `<home>/plugins/cv-tailor`
- creates or updates `<home>/.agents/plugins/marketplace.json`
- preserves existing marketplace entries
- adds `cv-tailor` only if missing
- adds `[marketplaces.local]` and `[plugins."cv-tailor@local"]` to
  `<home>/.codex/config.toml` when missing
- refuses to replace a dirty existing plugin directory unless `--force` is used

Useful options:

```bash
npm run install:codex -- --skip-config
npm run install:codex -- --force
npm run install:codex -- --home /custom/home
npm run install:codex -- --install-dir /custom/plugins/cv-tailor
npm run install:codex -- --marketplace /custom/.agents/plugins/marketplace.json
npm run install:codex -- --config /custom/.codex/config.toml
npm run install:codex -- --dry-run
```

If you use `--skip-config`, add the config snippet manually.

## Manual Local Install

Clone the plugin into the local marketplace root.

Windows PowerShell:

```powershell
git clone https://github.com/khalshaqzzy/cv-tailor "$HOME\plugins\cv-tailor"
Set-Location "$HOME\plugins\cv-tailor"
npm run setup
```

macOS/Linux:

```bash
git clone https://github.com/khalshaqzzy/cv-tailor "$HOME/plugins/cv-tailor"
cd "$HOME/plugins/cv-tailor"
npm run setup
```

Create or update `<home>/.agents/plugins/marketplace.json`:

```json
{
  "name": "local",
  "interface": {
    "displayName": "Local Plugins"
  },
  "plugins": [
    {
      "name": "cv-tailor",
      "source": {
        "source": "local",
        "path": "./plugins/cv-tailor"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

Create or update `<home>/.codex/config.toml`:

```toml
[marketplaces.local]
last_updated = "2026-01-01T00:00:00Z"
source_type = "local"
source = '<home>'

[plugins."cv-tailor@local"]
enabled = true
```

Replace `<home>` with the same home directory that contains `plugins/cv-tailor`
and `.agents/plugins/marketplace.json`.

## Verify Codex Discovery

From the plugin root:

```bash
npm run doctor -- --codex
```

The Codex discovery check verifies:

- plugin files exist under `<home>/plugins/cv-tailor`
- `.codex-plugin/plugin.json` exists in the installed root
- `skills/cv-tailor/SKILL.md` resolves from the installed manifest
- the local marketplace contains a complete `cv-tailor` entry
- Codex config contains `[marketplaces.local]`
- Codex config enables `[plugins."cv-tailor@local"]`

If the checks pass but Codex does not list the plugin yet, restart Codex or open
a new thread.

## Develop The Plugin

For development, the repo can be cloned anywhere. You do not have to place the
development checkout under `<home>/plugins`.

```bash
git clone https://github.com/khalshaqzzy/cv-tailor.git
cd cv-tailor
npm install
npx playwright install chromium
npm run test-all
```

Use this workflow when editing schemas, scripts, templates, examples, or the
skill. Use the install workflow only when you want Codex to discover the plugin.
