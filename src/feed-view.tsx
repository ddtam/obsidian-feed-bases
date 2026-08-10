import { BasesEntry, BasesView, Menu, QueryController, TFile } from "obsidian";
import { StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import { FeedReactView } from "./FeedReactView";
import { asContentMode } from "./FeedEntryCard";
import { AppContext } from "./context";
import { HIDDEN_CONTENT_DEFAULT, parseHiddenContent } from "./hidden-content";
import { HiddenContentStyles } from "./hidden-content-styles";

export const FeedViewType = "feed";

// Hoisted: constructing a collator (or passing an options bag to localeCompare)
// per comparison is the slow path.
const TITLE_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export class FeedView extends BasesView {
  type = FeedViewType;
  scrollEl: HTMLElement;
  containerEl: HTMLElement;
  root: Root | null = null;

  private entries: BasesEntry[] = [];
  private hiddenStyles = new HiddenContentStyles();
  private hiddenContentRaw: string | null = null;
  private hiddenContentParsed: Set<string> = new Set();

  constructor(controller: QueryController, scrollEl: HTMLElement) {
    super(controller);
    this.scrollEl = scrollEl;
    this.containerEl = scrollEl.createDiv({
      // hiddenStyles.scopeClass keeps this view's generated rules from
      // applying to another base's feed.
      cls: `bases-feed-container is-loading ${this.hiddenStyles.scopeClass}`,
      attr: { tabIndex: 0 },
    });
  }

  onload(): void {
    // React components will handle their own lifecycle
  }

  onunload() {
    if (this.root) {
      // Unmounting runs every card's ref cleanup, which is what releases the
      // detached leaves and their editors (see mountEntryEditor). Closing the
      // base therefore reclaims them; before that cleanup existed, it didn't.
      this.root.unmount();
      this.root = null;
    }
    this.hiddenStyles.destroy();
    this.entries = [];
  }

  onResize(): void {
    // Feed view should adapt to resizing automatically
  }

  public focus(): void {
    this.containerEl.focus({ preventScroll: true });
  }

  public onDataUpdated(): void {
    this.containerEl.removeClass("is-loading");
    this.updateFeed();
  }

  private updateFeed(): void {
    if (!this.data) {
      this.root?.unmount();
      this.root = null;
      this.containerEl.empty();
      this.containerEl.createDiv("bases-feed-empty").textContent =
        "No entries to display";
      return;
    }

    // BasesQueryResult.data already has the user's sort and limit applied
    // ("Note that data from BasesQueryResult will be presorted" — getSort()'s
    // own doc comment). Re-sorting here reproduced that ordering at the cost of
    // an O(n log n) pass calling entry.getValue twice per comparison, which for
    // a formula property may run the formula evaluator. So: trust the order.
    this.entries = this.data.data.filter(
      (entry) => entry.file.extension === "md",
    );

    // Only when the user has configured no sort at all is the incoming order
    // unspecified; fall back to file title A–Z with a hoisted collator.
    if (this.config.getSort().length === 0) {
      this.entries.sort((a, b) =>
        TITLE_COLLATOR.compare(a.file.basename, b.file.basename),
      );
    }

    this.renderReactFeed();
  }

  private renderReactFeed(): void {
    if (!this.root) {
      this.root = createRoot(this.containerEl);
    }

    const showProperties =
      (this.config.get("showProperties") as boolean | undefined) ?? false;
    const multipleColumns =
      (this.config.get("multipleColumns") as boolean | undefined) ?? false;
    const maxCardWidth =
      (this.config.get("maxCardWidth") as number | undefined) ?? 400;
    const showLinkedMentions =
      (this.config.get("showLinkedMentions") as boolean | undefined) ?? false;

    const contentMode = asContentMode(this.config.get("contentMode"));
    const hiddenContent = this.hiddenContentSet(
      (this.config.get("hiddenContent") as string | undefined) ??
        HIDDEN_CONTENT_DEFAULT,
    );

    // Editor mode can only hide this content with CSS; excerpt mode strips it
    // from the markdown before rendering, so the block never runs at all.
    this.hiddenStyles.apply(hiddenContent);

    const hostFile = this.app.workspace.getActiveFile();
    const scopeTerm = this.resolveScopeTerm(hostFile);

    // Drives the CSS fallback for the in-document backlinks pane; the editor
    // also tries to unload the component outright (see mountEntryEditor).
    this.containerEl.toggleClass(
      "bases-feed-hide-mentions",
      !showLinkedMentions,
    );

    this.root.render(
      <StrictMode>
        <AppContext.Provider value={this.app}>
          <FeedReactView
            entries={this.entries}
            scrollElement={this.scrollEl}
            showProperties={showProperties}
            showLinkedMentions={showLinkedMentions}
            contentMode={contentMode}
            hiddenContent={hiddenContent}
            scopeTerm={scopeTerm}
            hostBasename={hostFile?.basename ?? null}
            multipleColumns={multipleColumns}
            maxCardWidth={maxCardWidth}
            onEntryClick={this.handleEntryClick}
            onEntryContextMenu={this.handleEntryContextMenu}
          />
        </AppContext.Provider>
      </StrictMode>,
    );
  }

  /**
   * Parse `hiddenContent` at most once per distinct value.
   *
   * A fresh Set on every render would be a new prop identity, which defeats
   * React.memo on the card and — because the Set is a dependency of the
   * excerpt's ref callback — would tear down and re-render every visible
   * excerpt on each data update.
   */
  private hiddenContentSet(raw: string): Set<string> {
    if (raw !== this.hiddenContentRaw) {
      this.hiddenContentRaw = raw;
      this.hiddenContentParsed = parseHiddenContent(raw);
    }
    return this.hiddenContentParsed;
  }

  /**
   * The term whose section each card is scoped to, or null for no scoping.
   *
   * Opt-in: blank means show the whole note. Trimming a card to one section is
   * a surprising thing to do to someone who didn't ask for it, so it isn't the
   * default even though the host note is usually the right term.
   *
   * The literal `auto` resolves to the note an embedded base sits in. That is
   * the case worth the feature: a base embedded in a project note and filtered
   * on `file.links.contains(this.file.name)` wants exactly the section linking
   * back to that note, so the auto term and the filter agree by construction.
   *
   * Note the base's own filters are not reachable from BasesViewConfig or
   * QueryController, so the term genuinely cannot be inferred from the query —
   * hence the option rather than something cleverer.
   */
  private resolveScopeTerm(hostFile: TFile | null): string | null {
    const configured = (
      (this.config.get("sectionScope") as string | undefined) ?? ""
    ).trim();
    if (!configured) return null;

    if (configured.toLowerCase() === "auto") {
      // A standalone .base open in its own tab is not a scoping context.
      return hostFile && hostFile.extension === "md" ? hostFile.basename : null;
    }

    return configured;
  }

  // Bound once, not re-created inside render(). Fresh identities every update
  // would defeat React.memo on the card and, through the card's ref deps,
  // rebuild editors that had no reason to change.
  private handleEntryClick = (entry: BasesEntry, isModEvent: boolean): void => {
    this.app.workspace
      .openLinkText(entry.file.path, "", isModEvent)
      .catch((err) => {
        console.error("Failed to open link:", err);
      });
  };

  private handleEntryContextMenu = (
    evt: React.MouseEvent,
    entry: BasesEntry,
  ): void => {
    evt.preventDefault();
    this.showEntryContextMenu(evt.nativeEvent, entry);
  };

  private showEntryContextMenu(evt: MouseEvent, entry: BasesEntry): void {
    const file = entry.file;
    const menu = Menu.forEvent(evt);

    this.app.workspace.handleLinkContextMenu(menu, file.path, "");
  }
}
