# EUIX Doctor — VS Code Extension

Brings [@euix/doctor](../doctor) static analysis into VS Code and Cursor. Diagnostics appear in the **Problems** panel; health status shows in the status bar.

## Features

- **Problems panel integration** — `EUIX1001`, `EUIX1101`, `EUIX1201`, `EUIX1301`, `EUIX1501`, and more
- **Analyze on save** — debounced workspace scan when `.xml` / `.html` files change
- **Commands**
  - `EUIX Doctor: Analyze Workspace`
  - `EUIX Doctor: Analyze Current File`
  - `EUIX Doctor: Run Safe Test Scenarios`
- **Status bar** — error/warning count at a glance

## Development (monorepo)

```bash
# Build doctor + extension
npm run vscode-doctor:build

# Package .vsix locally
npm run vscode-doctor:package

# Publish to VS Code Marketplace (after npm publish @euix/doctor)
npm run publish:vscode
npm run publish:vscode:dry-run   # package .vsix only, no Marketplace upload

# Press F5 in packages/vscode-euix-doctor (Extension Development Host)
```

Add to your workspace `.vscode/extensions.json`:

```json
{
  "recommendations": ["euix.euix-doctor"]
}
```

For local development, use **Run Extension** from `packages/vscode-euix-doctor`.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `euixDoctor.enable` | `true` | Enable diagnostics |
| `euixDoctor.runOnSave` | `true` | Re-analyze on save |
| `euixDoctor.runOnOpen` | `false` | Analyze when workspace opens |
| `euixDoctor.debounceMs` | `400` | Save debounce delay |
| `euixDoctor.showStatusBar` | `true` | Show status bar item |

## License

MIT
