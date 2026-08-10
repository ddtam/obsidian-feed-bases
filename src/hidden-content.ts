/**
 * The `hiddenContent` view option: a comma-separated list of content *kinds*
 * to suppress in feed cards.
 *
 * Each token is matched against three namespaces rather than one syntax, so a
 * single entry covers every way the same kind of content can be written:
 *
 *   ```<lang>        fenced code block language
 *   > [!<type>]      callout type
 *   ![[x.<ext>]]     embed target extension
 *
 * That matters because the same content genuinely appears both ways — a Bases
 * view can be an inline ```base fence or an ![[x.base]] embed in the very same
 * note. Matching by kind means `base` covers both; matching by syntax would
 * need two unrelated controls.
 *
 * Trade-off worth knowing: a callout literally written `> [!base]` is also hit
 * by the token `base`. Unlikely, and the price of kind-matching.
 */
export const HIDDEN_CONTENT_DEFAULT = "todoist-task, todoist, base";

export function parseHiddenContent(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token.length > 0),
  );
}

/** Language of a fenced code block, given the section's first line. */
export function fenceLanguage(firstLine: string): string | null {
  const match = /^\s*(?:```+|~~~+)\s*([^\s`{]+)/.exec(firstLine);
  return match ? match[1].toLowerCase() : null;
}

/** Type of a callout, given the section's first line. */
export function calloutType(firstLine: string): string | null {
  const match = /^\s*>\s*\[!([^\]\s|]+)/.exec(firstLine);
  return match ? match[1].toLowerCase() : null;
}

/** Extension of an embed target, e.g. `![[Foo.base]]` -> `base`. */
export function embedExtension(link: string): string | null {
  // Strip any subpath/alias before looking at the extension.
  const target = link.split("#")[0].split("|")[0].trim();
  const dot = target.lastIndexOf(".");
  if (dot === -1 || dot === target.length - 1) return null;
  return target.slice(dot + 1).toLowerCase();
}
