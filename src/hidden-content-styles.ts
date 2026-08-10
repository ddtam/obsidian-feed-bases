/**
 * Editor-mode half of the `hiddenContent` filter.
 *
 * In excerpt mode the content is removed from the markdown string before it is
 * rendered, which is a real filter — the block never runs. A live MarkdownView
 * owns the whole file and cannot be filtered that way, so editor mode falls
 * back to hiding the rendered output with CSS.
 *
 * The rules are generated rather than written statically because the token list
 * is user-configurable, and scoped to one view because the option lives on the
 * base: two feeds open with different lists must not fight over one stylesheet.
 */

let nextScopeId = 0;

/** CSS.escape isn't available for attribute *values* built into a selector. */
function quote(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

/** A token can only reach a class name if it is a safe identifier. */
function isSafeClassToken(token: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(token);
}

export function buildHiddenContentCss(
  tokens: Iterable<string>,
  scopeClass: string,
): string {
  const rules: string[] = [];
  const editor = `.${scopeClass} .bases-feed-entry-editor`;

  for (const token of tokens) {
    const q = quote(token);

    if (isSafeClassToken(token)) {
      // registerMarkdownCodeBlockProcessor("todoist-task") renders into
      // .block-language-todoist-task, and so on for every fence language.
      rules.push(`${editor} .block-language-${token} { display: none; }`);
    }

    rules.push(`${editor} .callout[data-callout="${q}"] { display: none; }`);
    rules.push(`${editor} .internal-embed[src$=".${q}"] { display: none; }`);
    // Live Preview keeps the source line above the rendered embed widget.
    // This is the most fragile selector in the plugin: it depends on the widget
    // being the *immediate* sibling of its own cm-line. If embeds start showing
    // their `![[...]]` source again, look here first.
    rules.push(
      `${editor} .cm-line:has(+ .internal-embed[src$=".${q}"]) { display: none; }`,
    );
  }

  return rules.join("\n");
}

/**
 * Owns one <style> element and the scope class that pairs with it. One instance
 * per FeedView; call destroy() from the view's onunload.
 */
export class HiddenContentStyles {
  readonly scopeClass = `bases-feed-hc-${nextScopeId++}`;
  private styleEl: HTMLStyleElement | null = null;

  apply(tokens: Set<string>): void {
    if (tokens.size === 0) {
      this.destroy();
      return;
    }

    const css = buildHiddenContentCss(tokens, this.scopeClass);

    if (!this.styleEl) {
      this.styleEl = document.createElement("style");
      document.head.appendChild(this.styleEl);
    }
    if (this.styleEl.textContent !== css) this.styleEl.textContent = css;
  }

  destroy(): void {
    this.styleEl?.remove();
    this.styleEl = null;
  }
}
