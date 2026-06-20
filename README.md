# Deobfuscator Studio

A local-first workbench for turning obfuscated or bundled JavaScript into code a human can inspect. It deobfuscates obfuscator.io output, unminifies syntax, restores JSX, and extracts webpack/browserify modules.

## What this fork improves

- Preserves the source and opens every result in a separate `*.deobfuscated.js` tab.
- Adds task presets, clearer recovery controls, run timing, byte counts, and recovered-module counts.
- Includes a one-click obfuscator.io-style example and a redesigned responsive workspace.
- Validates remote URLs and enforces an 8 MB remote-file limit without sending URLs through a public CORS proxy.
- Runs structural deobfuscation passes even when obfuscator.io string-array encoding is disabled.
- Keeps all analysis in a browser worker; pasted and local-file code is not uploaded.

## Run locally

Requirements: Node.js 22 or 24 and pnpm 11.

```bash
corepack enable
pnpm install
pnpm --filter playground dev
```

Then open the local URL printed by Vite. Press `Alt+Enter` to run the active file.

## Quality checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Engine and CLI

The reusable engine remains in `packages/webcrack`, including its API, CLI, transform suite, fixtures, and documentation. This keeps the project compatible with the original `webcrack` package architecture while the product UI lives in `apps/playground`.

## Attribution

This project is derived from [j4k0xb/webcrack](https://github.com/j4k0xb/webcrack), used under the MIT License. The original copyright and license text are preserved in [LICENSE](LICENSE).
