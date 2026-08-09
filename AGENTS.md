<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.
- [ ] Before committing any set of changes, run the `/caveman-review` skill on the diff and apply the fixes it suggests.

<!--VITE PLUS END-->

## Communication style

Minimum words. Never repeat yourself. Applies everywhere: chat replies, commit
messages, PR titles/descriptions, code comments, docs, GitHub issues, and PR/issue
comments.

## UI verification

- Any change that touches rendered markup, CSS, or client-side interaction
  must be verified in a real browser with the `agent-browser` skill before
  it's reported as done — don't rely on reading the CSS/JSX and reasoning
  about what it probably looks like.
- Start the dev server (`vp dev` / `pnpm dev`) and drive it with
  `agent-browser` (navigate, click, fill, screenshot) against the actual
  running page. Load `agent-browser skills get core` first if you haven't
  used it yet in this session.
- Screenshot every breakpoint or state called out by the task or `docs/SPEC.md`
  (e.g. the 360px/768px/1280px widths noted there), not just one default
  viewport.
- Treat a claim like "verified visually" or "screenshots taken" as
  unsubstantiated unless the commands were actually run this session —
  don't narrate hypothetical `agent-browser` output.

## Code style

- Prefer functions over classes by default — plain functions and modules, not
  object-oriented wrappers, for application logic, utilities, and scripts.
- Exception: Cloudflare Durable Objects. The platform requires a class that
  extends `DurableObject` (or implements the `fetch`/`alarm`/`webSocketMessage`
  contract) — there is no official functional API for this. See
  `src/durable-objects/room-do.ts` and `docs/SPEC.md` §3. Don't add a
  wrapper library to fake a functional style here; it's one class at the
  platform boundary, not a pattern to spread elsewhere.
- Scripts (e.g. `scripts/`) are TypeScript, run directly with `node` (Node's
  native TS support) — not plain `.js`/`.mjs`, and not a second runtime like
  Bun. This project already standardises on pnpm + Node + wrangler; adding
  Bun would mean provisioning a second runtime in CI for no benefit over
  what Node already does natively.

## Validation

- Any input crossing a trust boundary (WebSocket messages, request bodies,
  query params — anything from a client) is parsed with a `zod` schema, not
  `JSON.parse` plus a hand-rolled type guard. See `docs/SPEC.md` §4 and
  `src/durable-objects/messages.ts` for the pattern. Reject malformed input
  (`safeParse`), don't throw on it.

## Testing

- New logic ships with `vitest` tests in the same PR — this applies from
  the first line of logic, not deferred to a later milestone.
- Prefer testing pure functions directly. Where logic is entangled with a
  runtime that's expensive to simulate (e.g. a Durable Object's
  `ctx.storage`/`ctx.acceptWebSocket()`), extract the pure part (parsing,
  message building, state transitions) into a plain function and test that;
  keep the class itself as thin runtime glue. See
  `src/durable-objects/messages.ts` / `messages.test.ts`.
- `pnpm test` (`vp test`) runs in CI — a PR with untested new logic doesn't
  meet the bar even if `pnpm check` is green.
