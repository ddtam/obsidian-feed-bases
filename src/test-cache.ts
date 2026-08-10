import type { CachedMetadata, Pos } from "obsidian";

/** Test-only approximation of Obsidian's metadata cache. */
export function makeCache(text: string): CachedMetadata {
  const lines = text.split("\n");
  const lineStart: number[] = [];
  let running = 0;
  for (const line of lines) {
    lineStart.push(running);
    running += line.length + 1;
  }

  const pos = (line: number, endLine = line): Pos => ({
    start: { line, col: 0, offset: lineStart[line] },
    end: {
      line: endLine,
      col: lines[endLine].length,
      offset: lineStart[endLine] + lines[endLine].length,
    },
  });

  const cache: CachedMetadata = {
    headings: [],
    sections: [],
    embeds: [],
    links: [],
    tags: [],
  };

  let i = 0;

  if (lines[0] === "---") {
    const close = lines.indexOf("---", 1);
    if (close > 0) {
      cache.frontmatterPosition = pos(0, close);
      i = close + 1;
    }
  }

  for (; i < lines.length; i++) {
    const line = lines[i];

    const heading = /^(#{1,6}) (.*)$/.exec(line);
    if (heading) {
      cache.headings?.push({
        heading: heading[2],
        level: heading[1].length,
        position: pos(i),
      });
      cache.sections?.push({ type: "heading", position: pos(i) });
    } else if (/^\s*```/.test(line)) {
      let j = i + 1;
      while (j < lines.length && !/^\s*```/.test(lines[j])) j++;
      const end = Math.min(j, lines.length - 1);
      cache.sections?.push({ type: "code", position: pos(i, end) });
      i = end;
      continue;
    } else if (/^\s*>/.test(line)) {
      let j = i;
      while (j + 1 < lines.length && /^\s*>/.test(lines[j + 1])) j++;
      cache.sections?.push({ type: "callout", position: pos(i, j) });
      // fall through so embeds/links inside the callout are still indexed
    }

    for (const m of line.matchAll(/!\[\[([^\]]+)\]\]/g)) {
      cache.embeds?.push({
        link: m[1],
        original: m[0],
        position: {
          start: { line: i, col: m.index ?? 0, offset: lineStart[i] + (m.index ?? 0) },
          end: {
            line: i,
            col: (m.index ?? 0) + m[0].length,
            offset: lineStart[i] + (m.index ?? 0) + m[0].length,
          },
        },
      });
    }

    for (const m of line.matchAll(/(?<!!)\[\[([^\]]+)\]\]/g)) {
      cache.links?.push({ link: m[1], original: m[0], position: pos(i) });
    }

    for (const m of line.matchAll(/(?:^|\s)(#[A-Za-z][\w/-]*)/g)) {
      cache.tags?.push({ tag: m[1], position: pos(i) });
    }
  }

  return cache;
}
