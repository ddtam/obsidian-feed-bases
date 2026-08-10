import type { App, TFile } from "obsidian";

/**
 * Small LRU over `vault.cachedRead`, so a row recycled back into view by the
 * virtualizer doesn't re-read the file.
 *
 * Ported from the sibling calendar fork's thumbnail cache: Map-as-LRU via
 * delete-then-set, the in-flight promise stored in the same map so concurrent
 * callers share one read, and failures deliberately *not* cached so a transient
 * error retries rather than sticking.
 *
 * The one thing that does not port is invalidation. That cache keys on
 * `vault.getResourcePath()` URLs, which Obsidian already stamps with the file
 * mtime — file contents carry no such stamp, so the mtime goes in the key here
 * explicitly. An edited note therefore lands on a fresh key and the stale entry
 * simply ages out.
 *
 * Strings only, never DOM: a node has one parent, so cached elements could not
 * be shared between virtual slots.
 */
const MAX_ENTRIES = 256;

const cache = new Map<string, string | Promise<string>>();

function remember(key: string, value: string | Promise<string>): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function keyFor(file: TFile): string {
  return `${file.path}:${file.stat.mtime}`;
}

export async function readNote(app: App, file: TFile): Promise<string> {
  const key = keyFor(file);

  const hit = cache.get(key);
  if (hit !== undefined) {
    remember(key, hit); // refresh recency
    return hit;
  }

  const pending = app.vault
    .cachedRead(file)
    .then((text) => {
      remember(key, text);
      return text;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });

  remember(key, pending);
  return pending;
}

/** Call from the plugin's onunload — this is module-level state. */
export function clearContentCache(): void {
  cache.clear();
}
