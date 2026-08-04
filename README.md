# Honeycomb

A browser-based party game. See [`docs/SPEC.md`](docs/SPEC.md) for the full build spec and
[`docs/TOOLING.md`](docs/TOOLING.md) for toolchain notes (Vite+, current dependency versions).

Built with TanStack Start on Cloudflare Workers.

## Develop

```bash
npm install
npm run dev
```

Runs against a local `workerd` instance (via the Cloudflare Vite plugin), not a Node
polyfill — what runs locally is the same runtime Cloudflare deploys to.

## Typecheck

```bash
npm run typecheck
```

TypeScript strict mode is on (`tsconfig.json`).

## Build

```bash
npm run build
```

## Deploy

```bash
npm run deploy
```

This runs `npm run build && wrangler deploy`. You need Cloudflare credentials first —
either:

- `npx wrangler login` (interactive, opens a browser), or
- set `CLOUDFLARE_API_TOKEN` in the environment (for CI / non-interactive use).

Deploys publish to a `*.workers.dev` subdomain under your Cloudflare account, named from
`wrangler.jsonc`'s `name` field (currently `honeycomb`).

## Toolchain

This project uses [Vite+](https://viteplus.dev) (`vp`) instead of separate Vite/ESLint/
Prettier/Vitest installs — see `docs/TOOLING.md` for why and the required package-manager
overrides. Useful commands:

```bash
vp check   # lint (Oxlint) + format (Oxfmt) + typecheck
vp test    # vitest, once tests exist
```
