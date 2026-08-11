# Honeycomb

A browser-based party game. See [`docs/SPEC.md`](docs/SPEC.md) for the full build spec and
[`docs/TOOLING.md`](docs/TOOLING.md) for toolchain notes (Vite+, current dependency versions).

Built with TanStack Start on Cloudflare Workers.

## Develop

```bash
pnpm install
pnpm dev
```

Runs against a local `workerd` instance (via the Cloudflare Vite plugin), not a Node
polyfill — what runs locally is the same runtime Cloudflare deploys to. The `RoomDO`
Durable Object and `DB` (D1) binding both run against local simulators in dev — no
network calls leave your machine. Copy `.dev.vars.example` to `.dev.vars` first (gitignored,
holds `ANTHROPIC_API_KEY`; the real value is set in production via `wrangler secret put`).

Visit `/debug` to confirm both bindings are wired up — it runs a trivial D1 query, pings
the `RoomDO`, and counts approved rows in the `questions` table.

## Database

Schema and seed data live in `migrations/` (D1's native migration format). On a fresh
clone, apply them to the local D1 simulator before running `pnpm dev`:

```bash
pnpm exec wrangler d1 migrations apply honeycomb --local
```

This creates the `questions` table and seeds 20 hand-written questions (§5 of
`docs/SPEC.md`). Both migrations are idempotent — safe to re-run. Add `--remote` (once
credentials exist) to apply against the real Cloudflare D1 database instead.

## Bindings

Declared in `wrangler.jsonc`: `ROOM_DO` (Durable Object, SQLite-backed storage) and `DB`
(D1 database named `honeycomb`). Run `pnpm cf-typegen` after changing bindings to regenerate
`worker-configuration.d.ts` (committed, gives `Env` its types).

## Typecheck

```bash
pnpm typecheck
```

TypeScript strict mode is on (`tsconfig.json`).

## Build

```bash
pnpm build
```

## Deploy

```bash
pnpm deploy
```

This runs `pnpm build && wrangler deploy`. You need Cloudflare credentials first — either:

- `pnpm exec wrangler login` (interactive, opens a browser), or
- set `CLOUDFLARE_API_TOKEN` in the environment (for CI / non-interactive use).

Deploys publish to a `*.workers.dev` subdomain under your Cloudflare account, named from
`wrangler.jsonc`'s `name` field (currently `honeycomb`).

## Toolchain

This project uses [Vite+](https://viteplus.dev) (`vp`) instead of separate Vite/ESLint/
Prettier/Vitest installs, and pnpm as its package manager — see `docs/TOOLING.md` for why
and the required overrides (now in `pnpm-workspace.yaml`, not `package.json`). Useful
commands:

```bash
vp check   # lint (Oxlint) + format (Oxfmt) + typecheck
vp test    # vitest, once tests exist
```
