# CLAUDE.md

Last verified: 2026-08-09

Personal fork of [edrickleong/obsidian-feed-bases](https://github.com/edrickleong/obsidian-feed-bases) — a feed layout for Obsidian Bases. Distributed via BRAT from `ddtam/obsidian-feed-bases`, never through the community store.

**`AGENTS.md` in this repo is inherited upstream boilerplate** (generic sample-plugin scaffolding, not specific to this plugin). Prefer this file.

## Commands

- `npm run dev` — esbuild watch build. Writes straight into `$OBSIDIAN_VAULT/.obsidian/plugins/feed-bases-fork/` when `.env.local` sets `OBSIDIAN_VAULT`, otherwise to the repo root.
- `npm run build` — type-check (`tsc -noEmit`) + production build to the repo root.
- `npm test` — vitest over `src/excerpt.test.ts`. Lint is inherited eslint (`npx eslint src/ --ext .ts,.tsx`); **there is no Biome config here**, unlike the todoist fork.
- `npm run brat:build` — build, then verify `main.js` / `styles.css` / `manifest.json` exist. Dry run for a release.
- `npm run brat:release -- <version>` — bump `manifest.json` + `versions.json`, build, commit, push to `fork`, and cut a published GitHub release with the artifacts attached.

After any rebuild, **reload Obsidian (Ctrl/Cmd-R)** — esbuild rebuilding is not the same as Obsidian re-reading the plugin.

## Fork conventions

- **Remotes are inverted from the usual habit:** `origin` is upstream (`edrickleong`), `fork` is ours (`ddtam`). `main` tracks `fork/main`. A careless `git push origin` targets someone else's repo.
- **Plugin id is `feed-bases-fork`**, display name stays "Feed Bases" — the same rebrand shape as the sibling `calendar-bases-fork`. The id doubles as the install directory under `<vault>/.obsidian/plugins/`.
- **Version scheme is `0.2.0-plus.N`** — upstream's release, then the fork's counter.
- **`main.js` is gitignored** (upstream's convention, deliberately kept). It ships as a GitHub release asset only; BRAT reads it from there, not from the tree. `brat:release` therefore stages `manifest.json`, `versions.json`, and `styles.css` only.

## The view-type decision

`src/main.ts` registers the Bases view type `feed` (`FeedViewType` in `src/feed-view.tsx`) — **the same identifier upstream uses**. That is deliberate: existing `.base` files with `type: feed` render under the fork with no migration.

**Consequence:** this fork and the original cannot both be enabled — whichever registers last wins, unpredictably. The original must be disabled. The sibling `calendar-bases-fork` made the same call after an earlier `calendar-fork` view type proved worse (it needed a self-healing rewrite of `.base` files because sync kept reverting them).

## What the fork adds

### The focused feed

| View option | Default | Effect |
|---|---|---|
| `contentMode` | `editor` | `editor` = live editor (upstream behaviour). `excerpt` = read-only rendered excerpt. `excerpt-edit` = excerpt at rest, live editor on click, back on blur. |
| `hiddenContent` | `todoist-task, todoist, base` | Content kinds to strip — see below |
| `sectionScope` | `""` (off) | Blank = whole note. `auto` = the note an embedded base sits in. Otherwise a literal term. Only has an effect in the excerpt modes. |
| `showLinkedMentions` | `false` | The in-document backlinks pane |
| `maxCardWidth` | `550` | Upstream defaulted to 400 and capped at 800; 700 read as wider than normal text. Slider now goes to 2000 |

**Two defaults were walked back after first use**, and the reasons are worth keeping:
`excerpt-edit` was the initial default, but swapping between rendered and editable reflows the
card both entering *and* leaving, which reads as the feed jumping around under you. And
`sectionScope` originally defaulted to the host note — trimming a card to one section is a
surprising thing to do to someone who didn't ask for it, so it is opt-in now.

**`hiddenContent` matches by kind, not by syntax.** Each token is checked against fenced-code
language, callout type *and* embed target extension, so `base` hides both an inline ```` ```base ````
fence and an `![[x.base]]` embed. Adding `dataview` or `png` later needs no code change. A
`%% feed:hide %%` … `%% /feed:hide %%` pair is the per-instance escape hatch.

Caveat: one token spans three namespaces, so a callout written `> [!base]` is also hit.

**Excerpt mode is the only place filtering is real.** It renders a *string*, so a hidden code
block never runs its processor and an embedded base never executes its query. A live
`MarkdownView` owns the whole file and cannot be filtered that way, so editor mode falls back to
generated CSS (`src/hidden-content-styles.ts`) — scoped per view, since the option is per base.

**Section scoping**: when the matched line *is itself a heading*, that heading's section is the
slice — do not "fix" this to walk back to the parent, it is the dominant case (a work log
organised as `## [[Project]]` with detail nested under it). No match, or a match before any
heading, falls back to the whole note. The base's own filters are **not** reachable from
`BasesViewConfig` or `QueryController`, so the term cannot be inferred from the query — hence
the option plus the `auto` keyword.

A **non-configurable** guard drops embeds pointing back at the host note, independent of
`hiddenContent`, so emptying that option can't re-enable recursive rendering.

### Render-path fixes (upstream bugs, worth offering back)

- **`esbuild.config.mjs` had no `define` for `process.env.NODE_ENV` and no `minify`**, so the
  released plugin shipped React's *development* build. That left `<StrictMode>` live, which
  double-invokes ref callbacks — and cards mount their editor from a ref callback, so every card
  built **two** `WorkspaceLeaf`es. 1.15 MB → ~230 KB.
- **Editors were leaked.** Upstream `189c336` removed `leaf.detach()` and replaced it with
  nothing; `replaceChildren` only unparents DOM, so each card's `MarkdownView`, its CodeMirror
  instance and its vault/metadataCache listeners survived forever. `detach()` was the wrong call
  (these leaves are never in the workspace tree) — `leaf.view.unload()` is right. See
  `src/entry-editor.ts`.
- **The view re-sorted presorted data.** `getSort()`'s own doc comment says
  `BasesQueryResult.data` is presorted; the comparator called `entry.getValue` twice per
  comparison, possibly evaluating formulas. Now only a collator fallback when no sort is set.
- **Rows were keyed by index**, so any re-order rebuilt the editor at that index — meaning
  typing in a card sorted by `mtime` destroyed the editor under the cursor. Keyed by
  `file.path` now.
- **`measureElement` returned `0`** for never-measured rows during upward scroll, pinning them at
  zero permanently, and forced a synchronous layout per observed row. See `src/measure.ts`.

## Project structure

- `src/main.ts` — plugin entry; `registerBasesView` and the view-options schema
- `src/feed-view.tsx` — the Bases view class, `FeedViewType`, `resolveScopeTerm()`
- `src/FeedEntryCard.tsx` — the shared card and its three content states
- `src/entry-editor.ts` / `src/entry-excerpt.ts` — the two content hosts
- `src/excerpt.ts` (+ `.test.ts`) — pure slicing/filtering; all ranges computed against the
  original text and applied together, so removals never invalidate later offsets
- `src/hidden-content.ts`, `src/hidden-content-styles.ts` — the `hiddenContent` option
- `src/content-cache.ts` — LRU over `cachedRead`, keyed `path:mtime`; cleared in `onunload`
- `src/measure.ts` — virtualizer measurement + overscan/padding constants
- `src/FeedReactView.tsx`, `src/MasonryView.tsx` — React render layers (React 19,
  `@tanstack/react-virtual`)
- `src/context.tsx`, `src/hooks.tsx` — shared context and hooks
- `styles.css` — all styles, `.bases-feed-*` prefixed
- `scripts/brat-release.mjs`, `scripts/brat-publish.mjs` — release tooling

## Known rough edges

- **Masonry runs one virtualizer per column, all bound to the same scroll element** — N
  ResizeObservers and N independent `scrollTop` adjustments per frame, fighting each other.
  Untouched because no `.base` in use sets `multipleColumns`.
- **CodeMirror renders every line** in editor mode: `styles.css` sets `height: auto` with no
  `max-height`, so the scroller is unbounded and CM6 can't viewport-virtualize. Bounding it would
  mean per-card scrollbars; excerpt mode is the answer instead.
- The `:has(+ .internal-embed…)` rule generated in `hidden-content-styles.ts` is the most fragile
  selector in the plugin — it assumes the embed widget is the immediate sibling of its cm-line.
