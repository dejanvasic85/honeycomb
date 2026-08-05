# Honeycomb — Build Spec

> A browser-based party game. Everyone answers the same question; matching answers score.
> The differentiator: an LLM judges _semantic_ equivalence, so "McDonald's", "Maccas" and
> "Macca's" all land in the same cell.

**Status:** pre-alpha, greenfield.
**Audience:** families and classrooms. Kids ~7+.
**Constraint:** minimal graphics. Hexagons and text only.

---

## 1. Product summary

### Core loop

1. Host creates a room, gets a 6-character code.
2. Players join on their own devices (phone/tablet/laptop).
3. Host starts the game. A question appears on every screen.
4. Everyone types an answer privately. Nobody sees anyone else's.
5. When all have answered (or timer expires), answers are clustered into groups.
6. Reveal: clusters shown as honeycomb cells. Largest cluster earns **honey**.
7. A player whose answer matched nobody gets **stung** — they can't win until they offload it.
8. First to 8 honey wins.

### Non-goals for v1

- Accounts, logins, persistence of player identity across sessions.
- Custom question packs authored by users.
- Mobile apps. Browser only.
- Real-time animation beyond CSS transitions.

---

## 2. Architecture

### Stack

| Layer                 | Choice                       | Why                                                                                 |
| --------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| Framework             | TanStack Start               | Familiar, good Cloudflare adapter, file-based routing                               |
| Hosting               | Cloudflare Workers           | Edge, cheap, colocated with DOs                                                     |
| Realtime + game state | Durable Objects              | One DO per room = single-threaded authority, no race conditions                     |
| Question bank         | D1                           | Relational, cheap, not latency-critical                                             |
| LLM                   | Anthropic API (Claude Haiku) | Called server-side from the DO                                                      |
| Styling               | Plain CSS + CSS Modules      | Small surface, hexagon geometry needs real CSS, no team to protect from the cascade |

### Why Durable Objects

A DO is a stateful, single-threaded JS object with its own storage. Cloudflare guarantees
exactly one instance globally per ID. Room code → DO ID means:

- No "which server holds this room" routing problem.
- No distributed locking. The DO processes messages one at a time.
- No Redis. Game state lives in DO memory + DO storage.
- WebSocket Hibernation keeps sockets open while the DO is evicted from memory, so idle
  rooms cost nothing.

### Request flow

```
Browser ──HTTP──> Worker ──> static assets / SSR (TanStack Start)
Browser ──WS───>  Worker ──> idFromName(roomCode) ──> RoomDO
                                                       │
                                                       ├─ DO storage (game state)
                                                       ├─ D1 (fetch questions)
                                                       └─ Anthropic API (clustering)
```

---

## 3. The Room Durable Object

### State shape

```ts
type Phase =
  | "lobby"
  | "question" // question shown, brief read time
  | "answering" // inputs open
  | "judging" // LLM clustering in flight
  | "reveal" // clusters shown
  | "scoring" // honey awarded, sting assigned
  | "gameover";

interface Player {
  id: string; // UUID, issued on first join, stored in localStorage
  name: string;
  connected: boolean;
  honey: number;
  stung: boolean;
  joinedAtRound: number;
}

interface Answer {
  playerId: string;
  text: string;
  submittedAt: number;
}

interface Cluster {
  id: string;
  canonical: string; // display label, e.g. "McDonald's"
  playerIds: string[];
}

interface RoomState {
  code: string;
  hostId: string;
  phase: Phase;
  round: number;
  players: Record<string, Player>;
  currentQuestion: Question | null;
  answers: Record<string, Answer>; // NEVER broadcast before reveal
  clusters: Cluster[] | null;
  usedQuestionIds: string[];
  createdAt: number;
}
```

### Class skeleton

```ts
export class RoomDO implements DurableObject {
  private state: RoomState;

  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<RoomState>("state")) ?? freshState();
    });
  }

  async fetch(req: Request): Promise<Response> {
    // WS upgrade only
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]); // hibernation-aware
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string) {
    const msg = ClientMessage.parse(JSON.parse(raw)); // zod
    await this.handle(ws, msg);
    await this.persist();
  }

  async webSocketClose(ws: WebSocket) {
    /* mark disconnected, broadcast */
  }

  async alarm() {
    /* phase timeouts: answering → judging */
  }

  private broadcast(msg: ServerMessage) {
    /* to all sockets */
  }
  private send(ws: WebSocket, msg: ServerMessage) {
    /* to one */
  }
}
```

### Critical invariants

1. **Answers are never sent to clients before `reveal`.** During `answering`, clients receive
   only `{ answered: 3, total: 5 }`. Anyone with devtools open must not be able to see
   others' answers. This is the single most important rule in the codebase.
2. **The DO is the only source of truth.** Clients render what they're told. No optimistic
   scoring.
3. **All phase transitions happen in the DO**, triggered by either a host action, all-players-
   ready, or a DO alarm.
4. **Host actions are authorised by `playerId === state.hostId`.** Verify server-side.

### Reconnection

- On first join the DO issues a `playerId` UUID. Client stores it in `localStorage` keyed by
  room code.
- On reconnect the client sends `{ type: 'rejoin', roomCode, playerId }`.
- DO matches, flips `connected: true`, replays current phase + that player's own answer.
- A player who drops mid-round keeps their submitted answer.
- If the **host** disconnects for >30s, promote the longest-connected player.

### Hibernation notes

- Use `ctx.acceptWebSocket()`, not `ws.accept()`. The latter pins the DO in memory.
- Handlers must be `webSocketMessage` / `webSocketClose` on the class, not `addEventListener`.
- State must be recoverable from storage on wake — don't rely on in-memory-only fields.
- Use `ctx.storage.setAlarm()` for the answering-phase timer, not `setTimeout`.

---

## 4. Message protocol

All messages are JSON, validated with zod on both ends.

### Client → Server

| Type           | Payload                   | Notes                                   |
| -------------- | ------------------------- | --------------------------------------- |
| `join`         | `{ name }`                | Returns issued `playerId`               |
| `rejoin`       | `{ playerId }`            | Restores session                        |
| `start`        | —                         | Host only                               |
| `submitAnswer` | `{ text }`                | Editable until phase leaves `answering` |
| `mergeCluster` | `{ sourceId, targetId }`  | Host override of LLM                    |
| `splitCluster` | `{ clusterId, playerId }` | Host override                           |
| `nextRound`    | —                         | Host only                               |

### Server → Client

| Type                          | Payload                                             |
| ----------------------------- | --------------------------------------------------- |
| `state`                       | Full sanitised snapshot (no other players' answers) |
| `playerJoined` / `playerLeft` | `{ player }`                                        |
| `phase`                       | `{ phase, endsAt? }`                                |
| `question`                    | `{ text, category }`                                |
| `answerProgress`              | `{ answered, total }`                               |
| `reveal`                      | `{ clusters, answersByPlayer }`                     |
| `scores`                      | `{ players, stungPlayerId }`                        |
| `error`                       | `{ code, message }`                                 |

**Sanitisation rule:** write one `sanitiseFor(playerId, state)` function and route _every_
outbound state message through it. Never serialise `RoomState` directly.

---

## 5. Question bank

### Generation, not live inference

Questions are **pre-generated in batches and human-reviewed**, then stored in D1. Do not
generate at runtime — latency, cost, and unpredictable output aren't acceptable with kids
on screen.

### Schema

```sql
CREATE TABLE questions (
  id          TEXT PRIMARY KEY,
  text        TEXT NOT NULL,
  category    TEXT NOT NULL,     -- food, animals, school, movies, silly, would-you-rather
  age_band    TEXT NOT NULL,     -- 'kids' | 'family' | 'adult'
  locale      TEXT DEFAULT 'en-AU',
  approved    INTEGER DEFAULT 0,
  created_at  INTEGER
);
```

### What makes a good question

- Has a _likely_ majority answer but isn't a trivia question with one right answer.
  Good: "Name a topping you'd put on a pizza." Bad: "What's the capital of France?"
- Answerable in 1–3 words.
- No knowledge barrier — a 7-year-old and a grandparent should both have an answer.
- Culturally neutral or explicitly localised. "Name a fast food place" works everywhere;
  "Name a footy team" needs `locale`.

### Pipeline (offline script, not in the app)

1. Prompt Claude for N questions in a category + age band, as JSON.
2. Dedupe against existing bank (embedding similarity or simple normalised text match).
3. Dump to a review file.
4. Human approves → `approved = 1` → insert into D1.

Target for v1: **300 approved questions**, weighted toward `family` and `kids`.

---

## 6. Answer clustering (deferred — stub it)

Not designed in this session. For now:

- Implement `clusterAnswers(answers): Promise<Cluster[]>` behind an interface.
- **v0 implementation:** normalise (lowercase, trim, strip punctuation) and group on exact
  match. Ships a working game immediately.
- **v1 implementation:** single Claude Haiku call from inside the DO with all answers,
  returning cluster assignments. Falls back to v0 on error or timeout.
- Host always has manual merge/split controls as the escape hatch. These stay even once the
  LLM is good — it's a party game, the table's judgement wins.

API key lives in Worker secrets. Never client-side.

---

## 7. UI

Five screens. Hexagons and text.

1. **Landing** — "Create room" / "Join with code".
2. **Lobby** — room code big, player list, host sees Start.
3. **Answering** — question, text input, "3 of 5 answered".
4. **Reveal** — clusters as honeycomb cells. Big cluster centre, singletons on the edge.
5. **Scores** — honey counts, who got stung, next round.

Visual language: a hexagon is a cell is an answer. Matching answers snap into a contiguous
cluster. That's the whole design system — no illustration required.

Accessibility: this will be used in classrooms. Keyboard navigable, 44px touch targets,
don't encode meaning in colour alone (the stung state needs an icon, not just pink).

### Visual direction — Risograph print

Flat spot inks on newsprint stock. Zine aesthetic: heavy black keylines, saturated
unsubtle colour, deliberate misregistration. Playful without being babyish, and it needs
zero illustration.

**Why riso specifically:** overprinting. Print the same ink twice and it deepens. So each
player in a matching cluster adds one layer of yellow — one match is pale, four matches is
deep amber. **Colour density encodes herd size.** The aesthetic and the mechanic are the
same thing. That's the signature; keep everything else quiet.

Deliberately avoided: warm cream + terracotta (the generic default), primary-colour edtech
brightness, and pink — which would echo Big Potato's Pink Cow too closely. Blue for the
stung state reads as isolation, which suits it better anyway.

### Tokens

```css
:root {
  /* ---- ink ---- */
  --paper: #e9e6dc; /* newsprint, cooler than cream */
  --paper-shade: #ddd9cc; /* pressed/inset areas */
  --ink: #1f1c17; /* keylines and body — never pure black */
  --ink-muted: #6b655c;

  /* honey — overprint tiers, one per matching player */
  --honey-1: #ffefb8;
  --honey-2: #ffd84f;
  --honey-3: #f9b700;
  --honey-4: #de8500; /* 4+ clamps here */

  --sting: #2b4fd8; /* riso federal blue */
  --sting-tint: #c7d2f7;

  /* ---- type ---- */
  --font-display: "Bricolage Grotesque", system-ui, sans-serif;
  --font-body: "Atkinson Hyperlegible", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --text-xs: 0.75rem; /* 12 — labels */
  --text-sm: 0.875rem; /* 14 — secondary */
  --text-base: 1rem; /* 16 — body floor, never smaller for kids */
  --text-lg: 1.25rem; /* 20 — player names */
  --text-xl: 1.75rem; /* 28 — question text */
  --text-2xl: 2.5rem; /* 40 — headings */
  --text-code: 3.5rem; /* 56 — room code */

  --leading-tight: 1.1; /* display */
  --leading-body: 1.5;
  --tracking-code: 0.15em; /* room code only */

  /* ---- space — 4px base ---- */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* ---- borders ---- */
  --stroke: 2px; /* default keyline */
  --stroke-heavy: 3px; /* active/selected cells */
  --stroke-hair: 1px; /* dividers only */
  --misreg: 2px; /* print offset — the aesthetic risk */

  --radius: 0; /* riso doesn't do rounded. Hexagons have no corners anyway */
  --radius-input: 2px; /* the single exception, for text fields */

  /* ---- geometry ---- */
  --cell-w: 6rem;
  --cell-h: 6.9rem; /* pointy-top hex ratio, w × 1.1547 */
  --cell-gap: 0.375rem;
  --hex-clip: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);

  /* ---- motion ---- */
  --ease: cubic-bezier(0.2, 0, 0, 1);
  --ease-snap: cubic-bezier(0.34, 1.4, 0.64, 1); /* cells snapping into cluster */
  --dur-fast: 120ms;
  --dur: 220ms;
  --dur-slow: 420ms; /* reveal sequence */
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-fast: 0ms;
    --dur: 0ms;
    --dur-slow: 0ms;
  }
}
```

### Type rationale

| Face                  | Role               | Why this one                                                                                                              |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Bricolage Grotesque   | Display, questions | Variable width/weight, genuinely characterful, not the default friendly-rounded sans                                      |
| Atkinson Hyperlegible | Body, names, UI    | Built by the Braille Institute for low-vision legibility. In a mixed-ability classroom this is functional, not decorative |
| JetBrains Mono        | Room codes, scores | Slashed zero, unambiguous `1`/`l`/`I` — codes get read aloud across rooms                                                 |

All three are free on Google Fonts. Self-host via `@font-face` with `font-display: swap`;
subset to Latin. Variable versions only.

### The misregistration detail

Each hexagon renders as two stacked layers: a black keyline outline, and a colour fill
offset by `--misreg` down and right. It reads as a slightly-off print run. This is the one
place to spend boldness — everything else stays disciplined.

```css
.cell {
  position: relative;
}
.cell__fill {
  position: absolute;
  inset: 0;
  transform: translate(var(--misreg), var(--misreg));
  clip-path: var(--hex-clip);
  background: var(--honey-1);
  transition: background var(--dur) var(--ease);
}
.cell__line {
  position: absolute;
  inset: 0;
  clip-path: var(--hex-clip);
  background: var(--ink);
}
.cell__line::after {
  content: "";
  position: absolute;
  inset: var(--stroke);
  clip-path: var(--hex-clip);
  background: var(--paper);
}
```

Honey tier maps directly to cluster size: `--honey-{min(n, 4)}`.

### Accessibility floor

Used in classrooms — this is a requirement, not a nice-to-have.

- Body text never below 16px.
- Honey tiers are **not** the only signal of cluster size — show the count as a numeral too.
- The stung state needs an icon and a label, not just blue.
- `--sting` on `--paper` is 6.8:1. `--ink` on every honey tier passes AA. Verify with a
  contrast checker in CI if you can be bothered; check manually if not.
- Visible focus rings — a 3px `--ink` outline offset by 2px, never `outline: none`.
- 44px minimum touch targets. A `--cell-w` hexagon is well clear.
- Respect `prefers-reduced-motion`; the reveal must work as a static state change.

### CSS architecture

No utility framework. Plain CSS, because the surface is small, the hexagon geometry needs
real `clip-path` and `grid`, and there's no team to enforce conventions on.

```
src/styles/
  tokens.css      # :root custom properties — the ONLY place raw values live
  reset.css
  global.css      # element defaults, @layer setup
src/components/
  Hexagon/
    Hexagon.tsx
    Hexagon.module.css
```

**Token discipline is the rule that matters.** An agent writing plain CSS without a fixed
vocabulary will invent `#f4c542` in one file and `#f5c63f` in the next. Every component
stylesheet must reference tokens, never literals. Add a lint rule if you can — no hex
values outside `tokens.css`.

Use `@layer reset, base, components, utilities;` so specificity never becomes a fight.

---

## 8. Issue sequence

Dependency-ordered. Each independently shippable. **Create issues one milestone at a time** —
building M2 will teach you things that change M4.

Labels: `infra`, `durable-object`, `ui`, `game-logic`, `llm`, `spike`, `a11y`.

---

### Milestone 1 — Skeleton

---

#### #1 Scaffold TanStack Start on Cloudflare Workers

`infra`

Stand up the project and prove the deploy pipeline works end to end before anything else.

- [ ] TanStack Start app created with the Cloudflare Workers target
- [ ] `wrangler.jsonc` committed; `pnpm dev` runs locally against workerd
- [ ] `pnpm deploy` publishes to a `*.workers.dev` subdomain
- [ ] A route renders server-side and is verifiable in `view-source` (not client-only)
- [ ] TypeScript strict mode on; `pnpm typecheck` passes
- [ ] README records the deploy command and the live URL

**Done when:** a teammate can clone, install, and deploy without asking a question.

---

#### #2 CSS foundation — tokens, layers, reset

`ui`

Establish the styling vocabulary before any component exists, so nothing gets built against
hardcoded values.

- [ ] `tokens.css` created with the full token set from §7
- [ ] Three fonts self-hosted as variable woff2, Latin subset, `font-display: swap`
- [ ] `@layer reset, base, components, utilities` declared in `global.css`
- [ ] Modern reset applied (box-sizing, margin zeroing, `text-size-adjust`)
- [ ] CSS Modules confirmed working — a `.module.css` import compiles and scopes
- [ ] `prefers-reduced-motion` zeroes all `--dur-*` tokens globally
- [ ] Lint or CI check: no raw hex values outside `tokens.css`
- [ ] Dark mode deferred — riso-on-newsprint is the identity, don't invert it

**Done when:** a demo route shows the full palette, type scale, and spacing ramp, all
sourced from tokens.

---

#### #3 Hexagon component + landing page

`ui`

The core visual primitive. Everything in this game is a hexagon.

- [ ] `<Hexagon>` accepts `size`, `state` (`empty | filled | honey | stung`), `tier` (1-4), children
- [ ] Two-layer render: `--ink` keyline plus colour fill offset by `--misreg`
- [ ] Uses `--hex-clip` and scales purely from `--cell-w` / `--cell-h`
- [ ] `tier` maps to `--honey-{n}`, clamped at 4
- [ ] Text inside stays legible and centred at all sizes; long words wrap or truncate
- [ ] A `<HexGrid>` wrapper lays out N hexagons in a proper offset honeycomb tessellation
- [ ] Landing page: "Create room" and "Join with code" (6-char input, auto-uppercase, mono)
- [ ] Keyboard navigable; 3px `--ink` focus rings; 44px minimum touch targets
- [ ] Verified at 360px, 768px, and 1280px widths

**Done when:** the landing page is deployed, the grid tessellates without gaps, and the
misregistration reads as intentional rather than broken.

---

#### #4 Wrangler bindings — DO, D1, secrets

`infra`

- [ ] `RoomDO` durable object binding declared with a migration tag
- [ ] D1 database created and bound; connection verified with a trivial query
- [ ] `ANTHROPIC_API_KEY` set via `wrangler secret` (unused for now, wired for later)
- [ ] `Env` interface typed; `wrangler types` generates and is committed
- [ ] Local dev uses local DO + local D1 (no remote calls in `pnpm dev`)
- [ ] `.dev.vars` gitignored; `.dev.vars.example` committed

**Done when:** a debug route reads from D1 and instantiates a DO, both locally and deployed.

---

#### #5 RoomDO skeleton with hibernation-correct WebSockets

`durable-object` `spike`

**The highest-risk issue in the project.** Getting hibernation wrong here means rebuilding
later, and means idle rooms cost money. Budget learning time.

- [ ] `RoomDO` class exported and reachable via `idFromName()`
- [ ] Worker route `/api/room/:code/ws` upgrades and forwards to the DO
- [ ] Uses `ctx.acceptWebSocket()` — **not** `ws.accept()`
- [ ] Handlers are class methods `webSocketMessage`, `webSocketClose`, `webSocketError` —
      **not** `addEventListener`
- [ ] `blockConcurrencyWhile` restores state from `ctx.storage` in the constructor
- [ ] Echo: client sends `{type:'ping'}`, receives `{type:'pong'}`
- [ ] Two browser tabs on the same code reach the same DO instance; a message from one
      broadcasts to both
- [ ] Verified the DO evicts while sockets stay open, then wakes and still responds

**Done when:** two tabs can ping-pong, and eviction/wake is confirmed rather than assumed.

**Reference:** Cloudflare WebSocket Hibernation API docs. Read them before writing code —
the non-hibernating API looks almost identical and silently costs 10x.

---

### Milestone 2 — Rooms

---

#### #6 Room codes and routing

`durable-object`

- [ ] 6-character code generator, uppercase, ambiguity-safe alphabet (no `O/0`, `I/1`, `S/5`)
- [ ] `POST /api/room` creates a room, returns the code
- [ ] Collision check: the DO refuses to initialise twice over an existing room
- [ ] Joining a nonexistent code returns a clear error, not a blank room
- [ ] Codes are case-insensitive on input, normalised uppercase server-side
- [ ] Room stores `createdAt`; a stub cleanup alarm is registered (policy TBD)

**Done when:** creating a room returns a code that a second browser can successfully hit.

---

#### #7 Join, rejoin, and player identity

`durable-object` `game-logic`

Party games live or die on reconnection. A kid dropping off wifi mid-round must come back
with their answer intact.

- [ ] `join` message with `{ name }` → DO issues a `playerId` UUID
- [ ] Client persists `playerId` in `localStorage`, keyed by room code
- [ ] `rejoin` with `{ playerId }` restores the player, flips `connected: true`
- [ ] Unknown `playerId` falls back to a fresh join rather than erroring out
- [ ] Names validated: 1–20 chars, trimmed, duplicates disambiguated (`Sam`, `Sam (2)`)
- [ ] `webSocketClose` marks `connected: false` — it does **not** delete the player
- [ ] All messages validated with zod at the DO boundary; malformed input is rejected, not
      thrown on
- [ ] Manual test: join, hard-refresh, confirm same identity and score restored

**Done when:** refreshing mid-session is invisible to other players.

---

#### #8 Lobby UI

`ui`

- [ ] Room code displayed large (`--text-code`) with a copy-to-clipboard control
- [ ] Player list updates live as people join and leave
- [ ] Disconnected players shown greyed with an icon — **not** colour alone
- [ ] Host sees a Start button; non-hosts see a waiting state
- [ ] Start is disabled below 3 players, with the reason shown
- [ ] Shareable join URL (`/join/HX7K2P`) prefills the code
- [ ] Screen-reader announcement on join/leave via a polite live region

**Done when:** three devices can join and all three lists agree.

---

#### #9 Host designation and migration

`durable-object` `game-logic`

- [ ] First player to join becomes host; `hostId` stored in DO state
- [ ] **Every** host-only action verifies `playerId === state.hostId` server-side — never
      trust the client's claim
- [ ] If the host disconnects for >30s, promote the longest-connected player
- [ ] Promotion broadcasts to all clients; the new host's UI updates without refresh
- [ ] Original host rejoining does **not** reclaim the role
- [ ] If the last player leaves, the room schedules itself for cleanup
- [ ] Test: host closes tab mid-lobby, a new host emerges and can start the game

**Done when:** no sequence of disconnects leaves the room unstartable.

---

### Milestone 3 — Game loop

_Expand these into full criteria when M2 lands — building the DO will change your view of them._

10. Phase state machine in DO + `phase` broadcasts
11. D1 question schema + seed with 20 hand-written questions
12. Question selection avoiding `usedQuestionIds`
13. `sanitiseFor()` + test that answers never leak pre-reveal — **write this before #14**
14. Answer submission + `answerProgress`
15. Exact-match clustering (v0)
16. Reveal UI — honeycomb clusters
17. Scoring: honey, sting, offload rule, win at 8
18. Answering-phase alarm/timer

### Milestone 4 — Make it good

19. Host merge/split cluster controls
20. LLM clustering behind the interface, with fallback
21. Question generation script + review workflow → 300 questions
22. Reconnection hardening + edge cases (empty room GC)
23. Accessibility pass
24. Rate limiting on room creation

---

## 9. Open questions

- Room lifetime and cleanup policy — DO storage isn't free forever.
- Max players? Clustering cost and reveal UI both degrade past ~15.
- Timer: fixed, host-configurable, or none?
- Do we need moderation on player-typed answers before they're revealed to a class?
- Name: "Honeycomb" — check trademark class 9/41 availability, secure a domain
  (`playhoneycomb.*`, `honeycomb.game`). Avoid cereal-box and cow visual cues.
