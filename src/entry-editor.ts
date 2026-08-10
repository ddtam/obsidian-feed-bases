import { App, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";

/**
 * Mount a live Markdown editor for `file` inside `node`, returning a cleanup.
 *
 * Each feed card hosts a real MarkdownView in a detached leaf. Upstream commit
 * 189c336 ("fix: remove leaf.detach causing errors") removed the only teardown
 * and put nothing in its place, so every card leaked its view: `replaceChildren`
 * unparents the DOM but never runs MarkdownView.onunload(), never disposes the
 * CodeMirror instance, and never releases the view's vault / metadataCache /
 * workspace event refs. Those keep firing for the rest of the session, so one
 * keystroke fans out to every card ever scrolled past.
 *
 * `detach()` was the wrong call rather than the wrong idea: these leaves are
 * built with `new WorkspaceLeaf(app)` and never inserted into the workspace
 * tree, so detach walks up to a parent that doesn't exist. `Component.unload()`
 * is the lifecycle that actually disposes the view.
 */
export type EntryEditorOptions = {
  /** When false, the in-document Linked Mentions pane is torn down. */
  showLinkedMentions: boolean;
};

/**
 * Drop the in-document backlinks pane.
 *
 * There is no public backlinks API on MarkdownView, so this is best-effort and
 * `styles.css` keeps a `display: none` fallback. It is worth attempting anyway:
 * hiding the pane with CSS still leaves every visible card computing its own
 * backlinks, which on a large feed is the expensive half.
 */
function dropLinkedMentions(view: MarkdownView): void {
  try {
    const backlinks = (view as unknown as { backlinks?: { unload?: () => void } })
      .backlinks;
    backlinks?.unload?.();
  } catch {
    // Internal API — CSS covers us if the shape changes.
  }
}

export function mountEntryEditor(
  app: App,
  file: TFile,
  node: HTMLElement,
  options: EntryEditorOptions,
): () => void {
  let alive = true;
  let released = false;
  // @ts-ignore using internal API
  const leaf: WorkspaceLeaf = new WorkspaceLeaf(app);

  // Idempotent: cleanup and the in-flight openFile path can both reach it.
  const release = () => {
    if (released) return;
    released = true;
    try {
      leaf.view?.unload();
    } catch (e) {
      console.error("feed-bases: failed to unload entry editor view", e);
    }
  };

  void (async () => {
    try {
      await leaf.openFile(file, {
        state: { mode: "source", source: false },
      });

      // Cleanup ran while openFile was in flight, so nothing else will ever
      // reach this leaf — it is ours to release.
      if (!alive) {
        release();
        return;
      }

      const view = leaf.view;
      if (!(view instanceof MarkdownView)) {
        node.replaceChildren();
        node.createDiv("bases-feed-error").setText("Failed to load Markdown editor");
        release();
        return;
      }

      if (!options.showLinkedMentions) dropLinkedMentions(view);

      node.replaceChildren(view.containerEl);
    } catch (e) {
      if (alive) console.error("Error setting up editor:", e);
      release();
    }
  })();

  return () => {
    alive = false;
    node.replaceChildren();
    release();
  };
}
