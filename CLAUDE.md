# CLAUDE.md

Last verified: 2026-08-07

Personal fork of [edrickleong/obsidian-feed-bases](https://github.com/edrickleong/obsidian-feed-bases) — a feed layout for Obsidian Bases. Distributed via BRAT from `ddtam/obsidian-feed-bases`, never through the community store.

**`AGENTS.md` in this repo is inherited upstream boilerplate** (generic sample-plugin scaffolding, not specific to this plugin). Prefer this file.

## Commands

- `npm run dev` — esbuild watch build. Writes straight into `$OBSIDIAN_VAULT/.obsidian/plugins/feed-bases-fork/` when `.env.local` sets `OBSIDIAN_VAULT`, otherwise to the repo root.
- `npm run build` — type-check (`tsc -noEmit`) + production build to the repo root.
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

## Project structure

- `src/main.ts` — plugin entry; `registerBasesView` and the view options schema (`showProperties`, `multipleColumns`, `maxCardWidth`)
- `src/feed-view.tsx` — the Bases view class + `FeedViewType`
- `src/FeedReactView.tsx`, `src/MasonryView.tsx` — React render layers (React 19, `@tanstack/react-virtual` for virtualization)
- `src/context.tsx`, `src/hooks.tsx` — shared context and hooks
- `styles.css` — all styles, `.bases-feed-*` prefixed
- `scripts/brat-release.mjs`, `scripts/brat-publish.mjs` — release tooling
