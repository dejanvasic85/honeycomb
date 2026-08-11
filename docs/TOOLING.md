# Tooling notes

Researched 2026-08-04, updated 2026-08-05 (switched package manager to pnpm; see
"How #1 was actually scaffolded" below). Vite+ is in **beta** and post-dates model
training data for most LLM assistants — re-verify version numbers with
`npm view <pkg> version` before trusting anything below if it's been more than a
few weeks.

---

## Vite+ (the toolchain)

- Site: https://vite.plus / https://viteplus.dev
- Repo: https://github.com/voidzero-dev/vite-plus
- Beta announcement: https://voidzero.dev/posts/announcing-vite-plus-beta

Vite+ is a unified toolchain replacing the usual pile of separate tools:

| Replaces            | With                               | Notes                                                                                                                                                                                         |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite core           | `@voidzero-dev/vite-plus-core`     | Rolldown-powered, API-compatible with Vite — existing plugins (`@cloudflare/vite-plugin`, `@tanstack/react-start/plugin/vite`, `@vitejs/plugin-react`) still slot into `plugins: []` normally |
| ESLint              | Oxlint                             | via `vp lint` / `vp check`                                                                                                                                                                    |
| Prettier            | Oxfmt                              | via `vp fmt` / `vp check`                                                                                                                                                                     |
| Vitest (standalone) | Vitest, re-exported by `vite-plus` | still Vitest under the hood, just version-locked                                                                                                                                              |

**Do not install `eslint` or `prettier`.** Config lives in one `vite.config.ts` via
`defineConfig` from `vite-plus` (not from `vite`).

### Config shape

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  // standard Vite keys — work as normal
  plugins: [],
  server: {},
  build: {},
  preview: {},

  // vite-plus-specific keys
  create: {}, // project/template scaffolding
  run: {}, // Vite Task runner
  fmt: {}, // Oxfmt options
  lint: {}, // Oxlint options
  check: {}, // `vp check` defaults (lint+fmt+typecheck)
  test: {}, // Vitest config
  pack: {}, // tsdown bundling (for libraries — not needed here)
  staged: {}, // lint-staged-style pre-commit checks
  defaultPackage: undefined, // monorepo root target, N/A for us
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

**This project uses pnpm.** As of pnpm 11.x, `overrides` (and `onlyBuiltDependencies`)
are **not** read from `package.json`'s `"pnpm"` key anymore — pnpm silently ignores
them there with a `[WARN] ... no longer read by pnpm` and they must live in
`pnpm-workspace.yaml` instead (confirmed against https://pnpm.io/settings, which
now documents `pnpm-workspace.yaml` as the only home for non-auth/registry
settings). This applies even to a single-package repo with no real workspace —
`pnpm-workspace.yaml` still gets created just to hold these settings.

`pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: true
  workerd: true

overrides:
  vite: npm:@voidzero-dev/vite-plus-core@0.2.7
```

(`allowBuilds` is what pnpm 11.20 itself scaffolds in response to
`ERR_PNPM_IGNORED_BUILDS` — run `pnpm approve-builds --all` non-interactively to
generate/fill it rather than guessing the key name. It replaces the older
`onlyBuiltDependencies` array from `package.json`'s `"pnpm"` key.)

Added the `vitest` override (in `pnpm-workspace.yaml`, alongside the `vite`
one above) as of #5's first test — pinned to whatever `npm view vite-plus
dependencies` showed at that time (`4.1.10`). Tests now start with the first
line of logic, not deferred to a milestone gate — see AGENTS.md's Testing
section. Re-check the pin against `npm view vite-plus dependencies` if it
drifts from the `vitest` version actually installed.

For npm instead: `"overrides": { "vite": "npm:@voidzero-dev/vite-plus-core@0.2.7", "vitest": "4.1.10" }`
at the top level of `package.json`. Yarn: `resolutions`.

**Rule of thumb:** whatever `vitest` version `vite-plus`'s installed
`package.json` declares (or equivalently what a fresh `vp --version`-driven
install resolves) is the version to pin — check with:

```bash
npm view vite-plus dependencies   # shows the exact vitest + vite-plus-core pins
```

### Versions at time of writing

| Package                        | Version |
| ------------------------------ | ------- |
| `vite-plus`                    | 0.2.7   |
| `@voidzero-dev/vite-plus-core` | 0.2.7   |
| `vitest` (pinned by vite-plus) | 4.1.10  |
| `oxlint`                       | 1.75.0  |
| `oxfmt`                        | 0.60.0  |

---

## Framework / hosting dependencies

Checked live via `npm view <pkg> version` on 2026-08-04 — **re-check before
scaffolding**, this moves fast:

| Package                   | Version  | Notes                                                                            |
| ------------------------- | -------- | -------------------------------------------------------------------------------- |
| `@tanstack/react-start`   | 1.168.35 | Use this, not `@tanstack/start` (that package is stale, last published ~1yr ago) |
| `@tanstack/react-router`  | 1.170.18 |                                                                                  |
| `wrangler`                | 4.118.0  |                                                                                  |
| `@cloudflare/vite-plugin` | 1.50.0   |                                                                                  |
| `react` / `react-dom`     | 19.2.8   |                                                                                  |
| `typescript`              | 7.0.2    |                                                                                  |
| `zod`                     | 4.4.3    |                                                                                  |
| `@anthropic-ai/sdk`       | 0.115.0  | for LLM clustering later, M4                                                     |

`typescript` in this project is pinned to `^6.0.2` (resolves `6.0.3`), **not** the
7.0.2 shown as latest above. `@voidzero-dev/vite-plus-core` pins `typescript@6.0.3`
internally for its type-aware Oxlint checks (`oxlint-tsgolint`); forcing 7.x fights
that pin. Trust `vp migrate`'s own choice here over "install latest."

### TanStack Start + Cloudflare Workers setup

Source: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/

```bash
pnpm add -D @cloudflare/vite-plugin wrangler
```

`vite.config.ts` — Cloudflare plugin **must be listed first**:

```ts
import { defineConfig } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tanstackStart(), react()],
});
```

`wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "honeycomb",
  "compatibility_date": "2026-07-30",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry",
  "observability": { "enabled": true },
}
```

**`compatibility_date` gotcha:** it must not be later than what the installed
`workerd` binary supports, or `pnpm dev` fails immediately with
`ERR_FUTURE_COMPATIBILITY_DATE` — "today's date" is _not_ automatically safe.
Check what's actually installed and use that:

```bash
cat node_modules/workerd/package.json | grep version   # e.g. 1.20260730.1 -> use 2026-07-30
```

`package.json` scripts (Vite+ equivalents — use `vp` where it maps cleanly,
fall back to `wrangler` directly for anything Vite+ doesn't wrap):

```json
{
  "scripts": {
    "dev": "vp dev",
    "build": "vp build",
    "preview": "vp preview",
    "deploy": "pnpm build && wrangler deploy",
    "typecheck": "tsc --noEmit",
    "cf-typegen": "wrangler types",
    "check": "vp check",
    "test": "vp test"
  }
}
```

Note `pnpm deploy` as a _command someone types_ is unambiguous even though pnpm
also has a built-in `pnpm deploy` (for publishing a workspace package elsewhere)
— verified directly: with a `"deploy"` script defined and no `packages:` field in
`pnpm-workspace.yaml`, `pnpm deploy` runs the script, not the built-in.

DO / D1 bindings (for M1 issue #4) get added to `wrangler.jsonc` as
`durable_objects` / `d1_databases` blocks once the DO class exists — not
scaffolded yet.

### Adding Durable Objects alongside TanStack Start's entry point

`wrangler.jsonc`'s `main` can't stay `@tanstack/react-start/server-entry` once you need
extra named exports (a Durable Object class) — the framework's entry only exports a
default `fetch` handler. Per Cloudflare's TanStack Start guide, wrap it in a custom entry
instead:

```ts
// src/server.ts
import handler from "@tanstack/react-start/server-entry";
export { RoomDO } from "#/durable-objects/room-do";

export default { fetch: handler.fetch };
```

Then point `main` at `src/server.ts`. Access bindings from server functions/loaders via
`import { env } from "cloudflare:workers"` (not `context.cloudflare.env` or similar —
that module works in any server-side module, framework-agnostic).

Durable Object migrations should use `new_sqlite_classes` (SQLite-backed storage), not the
older `new_classes` — SQLite-backed is the current default/required path for new DOs.

---

## How #1 was actually scaffolded (2026-08-05)

`vp create @tanstack/start` (the built-in shorthand) just delegates to
`@tanstack/cli create` — so it's simpler to call that directly and skip the
indirection:

```bash
npx @tanstack/cli@latest create --framework React --deployment cloudflare \
  --blank --no-toolchain --package-manager pnpm --no-git --no-intent -y \
  --target-dir . --force
vp migrate --no-interactive
```

`--blank` skips Tailwind/examples/devtools (spec wants plain CSS, no utility
framework). `--no-toolchain` skips Biome/ESLint since Vite+ supplies Oxlint/Oxfmt
instead. `vp migrate` then layers the Vite+ toolchain on top: adds the `vite`
override, rewrites `vite.config.ts` to `defineConfig`/`lazyPlugins` from
`vite-plus`, and wires a pre-commit hook (`.vite-hooks/pre-commit` → `vp check --fix`).

**Switched from npm to pnpm** (originally scaffolded with `--package-manager npm`,
converted afterward — see the pnpm-specific override/build-approval notes above,
those weren't needed under npm). Converting after the fact: delete
`package-lock.json` and `node_modules`, update `devEngines.packageManager.name`,
run `vp install`, then `pnpm approve-builds --all` for any
`ERR_PNPM_IGNORED_BUILDS` (esbuild/workerd need postinstall scripts to run).

## Open items to verify next time

- Re-run `npm view vite-plus dependencies` right before install if the
  `vitest` override starts drifting from what's actually installed — beta
  moves fast.
- No `CLOUDFLARE_API_TOKEN` is available in the sandboxed dev environment, so real
  deploys can't be verified end-to-end there — `wrangler deploy --temporary` (or
  `pnpm exec wrangler deploy --temporary`) gets a real `*.workers.dev` URL on a
  throwaway account instead, good enough to prove the pipeline works but not a
  substitute for a real deploy once credentials exist.
- **Kill the dev server before running `pnpm check`.** TanStack Router's codegen
  rewrites `src/routeTree.gen.ts` in its own style (single quotes, no semicolons)
  every time its file watcher runs, which fights Oxfmt's formatting on the same
  file. If `pnpm dev` / `vp dev` is still running in the background, `pnpm check`
  flags `routeTree.gen.ts` as unformatted even right after `vp check --fix` — the
  watcher just re-dirties it. Stop the dev server first, then `vp check --fix`
  once, then `pnpm check` stays green.
