import { App, Component, MarkdownRenderer, TFile } from "obsidian";
import { readNote } from "./content-cache";
import { buildExcerpt, ExcerptOptions } from "./excerpt";

export type ExcerptMountOptions = ExcerptOptions;

/**
 * Render a read-only excerpt of `file` into `node`, returning a cleanup.
 *
 * This is the counterpart to mountEntryEditor. Because it renders a *string*
 * rather than hosting the file, content can genuinely be removed before it is
 * rendered — a hidden code block never runs its processor, and an embedded base
 * never executes its query. The editor path can only hide such things with CSS.
 *
 * MarkdownRenderer.render produces the same DOM as Reading mode, so callouts,
 * images and third-party code-block processors all still work. What's lost is
 * editing: this output is not a MarkdownPreviewView, so even task checkboxes
 * don't write back.
 */
export function mountEntryExcerpt(
  app: App,
  file: TFile,
  node: HTMLElement,
  options: ExcerptMountOptions,
): () => void {
  let alive = true;
  // Owns the lifecycle of whatever MarkdownRenderer attaches (embeds, code
  // block processors, image loaders). Without it those are never unloaded.
  const component = new Component();
  component.load();

  void (async () => {
    try {
      const text = await readNote(app, file);
      if (!alive) return;

      const cache = app.metadataCache.getFileCache(file) ?? {};
      const markdown = buildExcerpt(text, cache, options);

      node.replaceChildren();
      if (markdown.length === 0) {
        node.createDiv("bases-feed-excerpt-empty").setText("Nothing to show");
        return;
      }

      await MarkdownRenderer.render(app, markdown, node, file.path, component);
    } catch (e) {
      if (alive) console.error("feed-bases: failed to render excerpt", e);
    }
  })();

  return () => {
    alive = false;
    component.unload();
    node.replaceChildren();
  };
}
