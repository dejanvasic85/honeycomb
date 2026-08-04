# Tooling notes

Researched 2026-08-04. Vite+ is in **beta** and post-dates model training data for
most LLM assistants — re-verify version numbers with `npm view <pkg> version` before
trusting anything below if it's been more than a few weeks.

---

## Vite+ (the toolchain)

- Site: https://vite.plus / https://viteplus.dev
- Repo: https://github.com/voidzero-dev/vite-plus
- Beta announcement: https://voidzero.dev/posts/announcing-vite-plus-beta

Vite+ is a unified toolchain replacing the usual pile of separate tools:

| Replaces | With | Notes |
|---|---|---|
| Vite core | `@voidzero-dev/vite-plus-core` | Rolldown-powered, API-compatible with Vite — existing plugins (`@cloudflare/vite-plugin`, `@tanstack/react-start/plugin/vite`, `@vitejs/plugin-react`) still slot into `plugins: []` normally |
| ESLint | Oxlint | via `vp lint` / `vp check` |
| Prettier | Oxfmt | via `vp fmt` / `vp check` |
| Vitest (standalone) | Vitest, re-exported by `vite-plus` | still Vitest under the hood, just version-locked |

**Do not install `eslint` or `prettier`.** Config lives in one `vite.config.ts` via
`defineConfig` from `vite-plus` (not from `vite`).

### Config shape

```ts
import { defineConfig } from 'vite-plus';

export default defineConfig({
  // standard Vite keys — work as normal
  plugins: [],
  server: {},
  build: {},
  preview: {},

  // vite-plus-specific keys
  create: {},          // project/template scaffolding
  run: {},              // Vite Task runner
  fmt: {},               // Oxfmt options
  lint: {},               // Oxlint options
  check: {},               // `vp check` defaults (lint+fmt+typecheck)
  test: {},                 // Vitest config
  pack: {},                  // tsdown bundling (for libraries — not needed here)
  staged: {},                 // lint-staged-style pre-commit checks
  defaultPackage: undefined,   // monorepo root target, N/A for us
});
```

Confirmed from docs: `plugins`/`server`/`build`/`preview` are plain Vite passthrough
keys, so the Cloudflare + TanStack Start plugin setup below is unaffected by the
Vite+ migration.

### Install

```bash
curl -fsSL https://vite.plus | bash     # macOS/Linux, installs the `vp` CLI
```

### Required package-manager overrides

Vite+ pins its own internal versions of `vite` (as `@voidzero-dev/vite-plus-core`)
and `vitest`. If you install `vite-plus` without also overriding these at the
package-manager level, a stray transitive `vite`/`vitest` resolution can silently
break the test runner (two different Vitest instances loaded, mocks stop working).

Checked from `vite-plus@0.2.7`'s own `package.json`:

```json
{
  "@voidzero-dev/vite-plus-core": "0.2.7",
  "vitest": "4.1.10"
}
```

So the required overrides (npm):

```json
{
  "overrides": {
    "vite": "npm:@voidzero-dev/vite-plus-core@0.2.7",
    "vitest": "4.1.10"
  }
}
```

pnpm: same keys under `pnpm.overrides` in `package.json`, or a top-level
`overrides:` block in `pnpm-workspace.yaml`. Yarn: `resolutions`.

**Rule of thumb:** whatever `vitest` version `vite-plus`'s installed
`package.json` declares (or equivalently what a fresh `vp --version`-driven
install resolves) is the version to pin — check with:

```bash
npm view vite-plus dependencies   # shows the exact vitest + vite-plus-core pins
```

### Versions at time of writing

| Package | Version |
|---|---|
| `vite-plus` | 0.2.7 |
| `@voidzero-dev/vite-plus-core` | 0.2.7 |
| `vitest` (pinned by vite-plus) | 4.1.10 |
| `oxlint` | 1.75.0 |
| `oxfmt` | 0.60.0 |

---

## Framework / hosting dependencies

Checked live via `npm view <pkg> version` on 2026-08-04 — **re-check before
scaffolding**, this moves fast:

| Package | Version | Notes |
|---|---|---|
| `@tanstack/react-start` | 1.168.35 | Use this, not `@tanstack/start` (that package is stale, last published ~1yr ago) |
| `@tanstack/react-router` | 1.170.18 | |
| `wrangler` | 4.118.0 | |
| `@cloudflare/vite-plugin` | 1.50.0 | |
| `react` / `react-dom` | 19.2.8 | |
| `typescript` | 7.0.2 | |
| `zod` | 4.4.3 | |
| `@anthropic-ai/sdk` | 0.115.0 | for LLM clustering later, M4 |

### TanStack Start + Cloudflare Workers setup

Source: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/

```bash
npm i -D @cloudflare/vite-plugin wrangler
```

`vite.config.ts` — Cloudflare plugin **must be listed first**:

```ts
import { defineConfig } from 'vite-plus';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    react(),
  ],
});
```

`wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "honeycomb",
  "compatibility_date": "2026-08-04",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry",
  "observability": { "enabled": true }
}
```

`package.json` scripts (Vite+ equivalents — use `vp` where it maps cleanly,
fall back to `vite`/`wrangler` directly for anything Vite+ doesn't wrap):

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler deploy",
    "cf-typegen": "wrangler types",
    "check": "vp check",
    "test": "vp test"
  }
}
```

DO / D1 bindings (for M1 issue #4) get added to `wrangler.jsonc` as
`durable_objects` / `d1_databases` blocks once the DO class exists — not
scaffolded yet.

---

## Open items to verify when actually scaffolding

- Confirm `vp create` has a TanStack Start + Cloudflare template, or whether to
  scaffold via `@tanstack/create-start` and then layer `vite-plus` on top via
  `vp migrate --no-interactive`.
- Re-run `npm view vite-plus dependencies` right before install — beta moves fast
  and the vitest pin above may be stale by the time #1 is picked up.
