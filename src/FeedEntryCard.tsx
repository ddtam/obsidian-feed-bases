import { App, BasesEntry } from "obsidian";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { mountEntryEditor } from "./entry-editor";
import { mountEntryExcerpt } from "./entry-excerpt";

export type ContentMode = "editor" | "excerpt" | "excerpt-edit";

export const CONTENT_MODES: ContentMode[] = [
  "editor",
  "excerpt",
  "excerpt-edit",
];

export const CONTENT_MODE_DEFAULT: ContentMode = "excerpt-edit";

export function asContentMode(value: unknown): ContentMode {
  return CONTENT_MODES.includes(value as ContentMode)
    ? (value as ContentMode)
    : CONTENT_MODE_DEFAULT;
}

export type FeedEntryCardProps = {
  entry: BasesEntry;
  app: App;
  showProperties: boolean;
  showLinkedMentions: boolean;
  contentMode: ContentMode;
  hiddenContent: Set<string>;
  scopeTerm: string | null;
  hostBasename: string | null;
  onEntryClick: (entry: BasesEntry, isModEvent: boolean) => void;
  onEntryContextMenu: (evt: React.MouseEvent, entry: BasesEntry) => void;
};

/**
 * One feed card: title header plus the note's content.
 *
 * Shared by the single-column and masonry views, which previously carried
 * byte-identical copies of this component.
 *
 * Memoized because each virtualizer notifies on every scroll tick, which
 * re-renders its list; without this, every mounted card re-renders each frame.
 * It only holds because FeedView passes bound methods rather than fresh arrows.
 */
export const FeedEntryCard = React.memo(function FeedEntryCard({
  entry,
  app,
  showProperties,
  showLinkedMentions,
  contentMode,
  hiddenContent,
  scopeTerm,
  hostBasename,
  onEntryClick,
  onEntryContextMenu,
}: FeedEntryCardProps) {
  // In excerpt-edit the card starts as an excerpt and swaps to a live editor
  // for the whole note once clicked, reverting on blur.
  const [editing, setEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isEditor = contentMode === "editor" || editing;
  const canEdit = contentMode === "excerpt-edit";

  // Switching bases (or toggling the option) must not strand a card in the
  // editing state it entered under the old mode.
  useEffect(() => {
    if (!canEdit) setEditing(false);
  }, [canEdit]);

  useEffect(() => {
    if (!editing) return;

    const onPointerDown = (evt: PointerEvent) => {
      const target = evt.target as Node | null;
      if (target && contentRef.current?.contains(target)) return;
      setEditing(false);
    };

    // Capture phase: the editor stops some events from bubbling.
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [editing]);

  const handleTitleClick = (evt: React.MouseEvent) => {
    evt.preventDefault();
    const isModEvent = evt.ctrlKey || evt.metaKey;
    onEntryClick(entry, isModEvent);
  };

  const handleContextMenu = (evt: React.MouseEvent) => {
    onEntryContextMenu(evt, entry);
  };

  const handleContentClick = (evt: React.MouseEvent) => {
    if (!canEdit || editing) return;

    // Don't swallow interactions with the rendered excerpt itself — clicking an
    // internal link, embed or checkbox should do its own thing rather than
    // silently swap the card into an editor.
    const target = evt.target as HTMLElement | null;
    if (target?.closest("a, button, input, .internal-embed, .callout-fold")) {
      return;
    }

    setEditing(true);
  };

  const handleHover = (evt: React.MouseEvent) => {
    if (app) {
      app.workspace.trigger("hover-link", {
        event: evt.nativeEvent,
        source: "bases",
        hoverParent: app.renderContext,
        targetEl: evt.currentTarget,
        linktext: entry.file.path,
      });
    }
  };

  const setEditorHost = useCallback(
    (node: HTMLDivElement) =>
      mountEntryEditor(app, entry.file, node, { showLinkedMentions }),
    [app, entry.file, showLinkedMentions],
  );

  const setExcerptHost = useCallback(
    (node: HTMLDivElement) =>
      mountEntryExcerpt(app, entry.file, node, {
        hidden: hiddenContent,
        scopeTerm,
        hostBasename,
      }),
    [app, entry.file, hiddenContent, scopeTerm, hostBasename],
  );

  return (
    <div className="bases-feed-entry" onContextMenu={handleContextMenu}>
      <div className="bases-feed-entry-header">
        <a
          className="bases-feed-entry-title"
          onClick={handleTitleClick}
          onMouseEnter={handleHover}
          href="#"
        >
          {entry.file.basename}
        </a>
      </div>

      <div
        className="bases-feed-entry-content"
        ref={contentRef}
        onClick={handleContentClick}
      >
        {isEditor ? (
          <div
            key="editor"
            ref={setEditorHost}
            className="bases-feed-entry-editor"
            style={
              {
                "--metadata-display-editing": showProperties ? "block" : "none",
              } as React.CSSProperties
            }
          />
        ) : (
          <div
            key="excerpt"
            ref={setExcerptHost}
            className="bases-feed-entry-excerpt markdown-rendered"
          />
        )}
      </div>
    </div>
  );
});
