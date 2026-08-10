import type { CachedMetadata } from "obsidian";
import { calloutType, embedExtension, fenceLanguage } from "./hidden-content";

/** Half-open [start, end) offsets into the original note text. */
export type Range = { start: number; end: number };

export type ExcerptOptions = {
  /**
   * Scope the excerpt to the section(s) mentioning this term. Null keeps the
   * whole note.
   */
  scopeTerm?: string | null;
  /** Content kinds to strip — see hidden-content.ts. */
  hidden?: Set<string>;
  /**
   * Basename of the file hosting this feed. Embeds pointing back at it are
   * always removed, regardless of `hidden`, so a base can't render itself
   * recursively through its own results.
   */
  hostBasename?: string | null;
};

const HIDE_MARKER =
  /%%\s*feed:hide\s*%%[\s\S]*?%%\s*\/\s*feed:hide\s*%%/g;

function eq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** `[[Foo|bar]]`, `#foo`, `Foo#Heading` -> `foo`. */
export function normalizeTerm(term: string): string {
  let t = term.trim();
  if (t.startsWith("[[") && t.endsWith("]]")) t = t.slice(2, -2);
  // Strip a tag's leading '#' before splitting on '#' for subpaths — the other
  // order turns "#proj" into the empty string.
  if (t.startsWith("#")) t = t.slice(1);
  t = t.split("|")[0].split("#")[0].trim();
  if (t.toLowerCase().endsWith(".md")) t = t.slice(0, -3);
  return t.trim();
}

/** Target of a wikilink, with alias and subpath removed. */
function linkTarget(link: string): string {
  const target = link.split("#")[0].split("|")[0].trim();
  return target.toLowerCase().endsWith(".md") ? target.slice(0, -3) : target;
}

/**
 * Lines that mention `term`, preferring the metadata cache over string search
 * so `[[X|alias]]`, `[[X#Heading]]` and `#x/nested` all resolve correctly.
 */
export function findMatchLines(
  text: string,
  cache: CachedMetadata,
  term: string,
): number[] {
  const needle = normalizeTerm(term);
  if (!needle) return [];

  const lines = new Set<number>();

  for (const ref of [...(cache.links ?? []), ...(cache.embeds ?? [])]) {
    if (eq(linkTarget(ref.link), needle)) lines.add(ref.position.start.line);
  }

  for (const tag of cache.tags ?? []) {
    const bare = tag.tag.startsWith("#") ? tag.tag.slice(1) : tag.tag;
    if (eq(bare, needle) || bare.toLowerCase().startsWith(`${needle.toLowerCase()}/`)) {
      lines.add(tag.position.start.line);
    }
  }

  if (lines.size > 0) return [...lines].sort((a, b) => a - b);

  // Last resort: a plain textual mention (e.g. a bare alias in prose).
  const lower = needle.toLowerCase();
  const out: number[] = [];
  text.split("\n").forEach((line, i) => {
    if (line.toLowerCase().includes(lower)) out.push(i);
  });
  return out;
}

/**
 * The section containing `line`.
 *
 * When the matched line *is* a heading, that heading's own section is the
 * answer — do not walk back to its parent. This is the dominant case for
 * project work logs, where the note is organised as `## [[Project]]` with the
 * relevant detail nested underneath; walking back would return the whole note
 * and the scoping would do nothing.
 */
export function sectionRangeForLine(
  line: number,
  cache: CachedMetadata,
  textLength: number,
): Range | null {
  const headings = cache.headings ?? [];
  if (headings.length === 0) return null;

  let index = -1;
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].position.start.line;
    if (start === line) {
      index = i;
      break;
    }
    if (start < line) index = i;
    else break;
  }
  if (index === -1) return null; // match sits in the preamble

  const heading = headings[index];
  let end = textLength;
  for (let i = index + 1; i < headings.length; i++) {
    if (headings[i].level <= heading.level) {
      end = headings[i].position.start.offset;
      break;
    }
  }

  return { start: heading.position.start.offset, end };
}

export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges]
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

/** keeps minus removals, both in original-text offsets. */
export function subtractRanges(keeps: Range[], removals: Range[]): Range[] {
  const cuts = mergeRanges(removals);
  let out = mergeRanges(keeps);

  for (const cut of cuts) {
    const next: Range[] = [];
    for (const keep of out) {
      if (cut.end <= keep.start || cut.start >= keep.end) {
        next.push(keep);
        continue;
      }
      if (cut.start > keep.start) next.push({ start: keep.start, end: cut.start });
      if (cut.end < keep.end) next.push({ start: cut.end, end: keep.end });
    }
    out = next;
  }
  return out;
}

/** Ranges to strip: frontmatter, hidden kinds, marker pairs, self-embeds. */
export function removalRanges(
  text: string,
  cache: CachedMetadata,
  options: ExcerptOptions,
): Range[] {
  const hidden = options.hidden ?? new Set<string>();
  const removals: Range[] = [];

  if (cache.frontmatterPosition) {
    removals.push({
      start: cache.frontmatterPosition.start.offset,
      end: cache.frontmatterPosition.end.offset,
    });
  }

  for (const section of cache.sections ?? []) {
    const { start, end } = section.position;
    if (section.type !== "code" && section.type !== "callout") continue;

    const newline = text.indexOf("\n", start.offset);
    const firstLineEnd =
      newline === -1 ? end.offset : Math.min(newline, end.offset);
    const firstLine = text.slice(start.offset, firstLineEnd);
    const kind =
      section.type === "code" ? fenceLanguage(firstLine) : calloutType(firstLine);

    if (kind && hidden.has(kind)) {
      removals.push({ start: start.offset, end: end.offset });
    }
  }

  for (const embed of cache.embeds ?? []) {
    const ext = embedExtension(embed.link);
    const target = linkTarget(embed.link);
    const isSelf =
      options.hostBasename != null && eq(target, options.hostBasename);

    // The self-embed guard is deliberately independent of `hidden`: emptying
    // that option must not be able to re-enable recursive rendering.
    if (isSelf || (ext && hidden.has(ext))) {
      removals.push({
        start: embed.position.start.offset,
        end: embed.position.end.offset,
      });
    }
  }

  HIDE_MARKER.lastIndex = 0;
  for (
    let match = HIDE_MARKER.exec(text);
    match !== null;
    match = HIDE_MARKER.exec(text)
  ) {
    removals.push({ start: match.index, end: match.index + match[0].length });
  }

  return removals;
}

/**
 * Drop callouts whose body is left empty by a removal.
 *
 * `> [!note]- Related` wrapping nothing but `![[related.base]]` would otherwise
 * survive as a bare, pointless header once the embed is stripped.
 */
export function collapseEmptyCallouts(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (calloutType(lines[i]) === null) {
      out.push(lines[i]);
      continue;
    }

    // Consume the whole blockquote and keep it only if it has real content.
    let j = i + 1;
    let hasBody = false;
    while (j < lines.length && /^\s*>/.test(lines[j])) {
      if (lines[j].replace(/^\s*>+/, "").trim().length > 0) hasBody = true;
      j++;
    }

    if (hasBody) out.push(...lines.slice(i, j));
    i = j - 1;
  }

  return out.join("\n");
}

/** Build the markdown an excerpt card should render. */
export function buildExcerpt(
  text: string,
  cache: CachedMetadata,
  options: ExcerptOptions = {},
): string {
  let keeps: Range[] = [{ start: 0, end: text.length }];

  if (options.scopeTerm) {
    const matches = findMatchLines(text, cache, options.scopeTerm);
    const sections: Range[] = [];
    let sawUnscopedMatch = matches.length === 0;

    for (const line of matches) {
      const range = sectionRangeForLine(line, cache, text.length);
      if (range) sections.push(range);
      else sawUnscopedMatch = true; // preamble match — can't scope meaningfully
    }

    // No match, or a match outside any heading: the base's own filter already
    // selected this note, so fall back to the whole thing rather than nothing.
    if (!sawUnscopedMatch && sections.length > 0) keeps = mergeRanges(sections);
  }

  const kept = subtractRanges(keeps, removalRanges(text, cache, options));
  const markdown = kept
    .map((r) => text.slice(r.start, r.end).trim())
    .filter((chunk) => chunk.length > 0)
    .join("\n\n");

  return collapseEmptyCallouts(markdown).trim();
}
