import type { Virtualizer } from "@tanstack/react-virtual";

type FeedVirtualizer = Virtualizer<HTMLElement, Element>;

/**
 * Overscan expands in both directions, and here every extra row mounts a whole
 * CodeMirror editor rather than a cheap div — so this is deliberately far lower
 * than a normal virtual list would use. In masonry it applies per column.
 */
export const EDITOR_OVERSCAN = 2;

/** Must track `.bases-feed-container { padding: 20px }` in styles.css. */
export const CONTAINER_PADDING = 20;

/**
 * Read a row's height from the ResizeObserverEntry the observer already
 * computed. Falling back to getBoundingClientRect() — as this override used to
 * do unconditionally — forces a synchronous layout, and measureElement is
 * called for every observed row inside a single observer callback, interleaved
 * with the virtualizer's own scrollTop writes. That read-write-read thrash is
 * the stutter the override was written to remove.
 *
 * offsetHeight (the library's own fallback) is also integer rather than
 * fractional, so sub-pixel noise stops triggering spurious re-renders.
 */
function readBlockSize(
  element: Element,
  entry: ResizeObserverEntry | undefined,
): number {
  const box = entry?.borderBoxSize?.[0];
  if (box) return box.blockSize;
  return (element as HTMLElement).offsetHeight;
}

/**
 * Height measurement for feed rows.
 *
 * While scrolling up we prefer the cached size so rows entering above the
 * viewport don't resize and shove the scroll position around
 * (TanStack/virtual#659). The trap is rows that have *never* been measured:
 * returning 0 for those pinned them at zero permanently, because the cache then
 * held 0 and every later backward measurement returned that same 0. Only a
 * forward-direction remeasure could rescue them.
 *
 * That is not an edge case in this plugin — card content loads asynchronously,
 * so a row's real height routinely arrives while the user is scrolling up.
 */
export function measureFeedElement(
  element: Element,
  entry: ResizeObserverEntry | undefined,
  instance: FeedVirtualizer,
): number {
  const size = readBlockSize(element, entry);
  if (instance.scrollDirection !== "backward") return size;

  const index = Number((element as HTMLElement).getAttribute("data-index"));
  if (!Number.isInteger(index)) return size;

  // Keyed by item key, not index — rows are keyed by file path so that
  // re-ordering doesn't remount an editor onto a different note.
  const key = instance.options.getItemKey(index);
  // @ts-ignore - itemSizeCache is internal (see the issue above)
  const cached = instance.itemSizeCache.get(key) as number | undefined;

  return cached ?? size;
}
