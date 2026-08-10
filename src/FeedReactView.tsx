import { BasesEntry } from "obsidian";
import React, { useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useApp } from "./hooks";
import { FeedEntryCard } from "./FeedEntryCard";
import { FEED_DEFAULTS, type ContentMode } from "./options";
import { MasonryView } from "./MasonryView";
import {
  CONTAINER_PADDING,
  EDITOR_OVERSCAN,
  measureFeedElement,
} from "./measure";

export const FeedReactView: React.FC<FeedReactViewProps> = ({
  entries,
  onEntryClick,
  onEntryContextMenu,
  scrollElement,
  showProperties,
  showLinkedMentions,
  contentMode,
  hiddenContent,
  scopeTerm,
  hostBasename,
  multipleColumns = FEED_DEFAULTS.multipleColumns,
  maxCardWidth = FEED_DEFAULTS.maxCardWidth,
}) => {
  // Conditionally render masonry or single column view
  if (multipleColumns) {
    return (
      <MasonryView
        entries={entries}
        onEntryClick={onEntryClick}
        onEntryContextMenu={onEntryContextMenu}
        scrollElement={scrollElement}
        showProperties={showProperties}
        showLinkedMentions={showLinkedMentions}
        contentMode={contentMode}
        hiddenContent={hiddenContent}
        scopeTerm={scopeTerm}
        hostBasename={hostBasename}
        maxCardWidth={maxCardWidth}
      />
    );
  }

  // Single column centered view
  return (
    <SingleColumnView
      entries={entries}
      onEntryClick={onEntryClick}
      onEntryContextMenu={onEntryContextMenu}
      scrollElement={scrollElement}
      showProperties={showProperties}
      showLinkedMentions={showLinkedMentions}
      contentMode={contentMode}
      hiddenContent={hiddenContent}
      scopeTerm={scopeTerm}
      hostBasename={hostBasename}
      maxCardWidth={maxCardWidth}
    />
  );
};

const SingleColumnView: React.FC<SingleColumnViewProps> = ({
  entries,
  onEntryClick,
  onEntryContextMenu,
  scrollElement,
  showProperties,
  showLinkedMentions,
  contentMode,
  hiddenContent,
  scopeTerm,
  hostBasename,
  maxCardWidth,
}) => {
  const app = useApp();
  const getScrollEl = useMemo(() => () => scrollElement, [scrollElement]);

  // Keying by file path rather than index is what stops a re-order from
  // rebuilding a row's editor onto a different note — which, when the base is
  // sorted by mtime, meant typing in a card destroyed the editor under the
  // cursor as soon as the edit bumped the note's position.
  const getItemKey = useCallback(
    (index: number) => entries[index]?.file.path ?? index,
    [entries],
  );

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: getScrollEl,
    getItemKey,
    estimateSize: () => 280,
    // Overscan expands in both directions, and here every extra row is a whole
    // editor rather than a cheap div. Kept low deliberately.
    overscan: EDITOR_OVERSCAN,
    // The container is padded, so content does not begin at scroll offset 0.
    scrollMargin: CONTAINER_PADDING,
    measureElement: measureFeedElement,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      className="bases-feed bases-feed-single-column"
      style={{ maxWidth: `${maxCardWidth}px` }}
    >
      {entries.length === 0 ? (
        <div className="bases-feed-empty">No notes to display</div>
      ) : (
        <div
          className="bases-feed-virtualizer"
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          {virtualItems.map(
            (vi: ReturnType<typeof rowVirtualizer.getVirtualItems>[number]) => {
              const entry = entries[vi.index];
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={rowVirtualizer.measureElement}
                  className="bases-feed-virtual-item"
                  style={{
                    // vi.start is offset by scrollMargin, while getTotalSize()
                    // subtracts it — so it has to come back off here.
                    transform: `translateY(${
                      vi.start - rowVirtualizer.options.scrollMargin
                    }px)`,
                  }}
                >
                  <FeedEntryCard
                    entry={entry}
                    app={app}
                    showProperties={showProperties}
                    showLinkedMentions={showLinkedMentions}
                    contentMode={contentMode}
                    hiddenContent={hiddenContent}
                    scopeTerm={scopeTerm}
                    hostBasename={hostBasename}
                    onEntryClick={onEntryClick}
                    onEntryContextMenu={onEntryContextMenu}
                  />
                </div>
              );
            },
          )}
        </div>
      )}
    </div>
  );
};


// Props

type FeedReactViewProps = {
  entries: BasesEntry[];
  onEntryClick: (entry: BasesEntry, isModEvent: boolean) => void;
  onEntryContextMenu: (evt: React.MouseEvent, entry: BasesEntry) => void;
  scrollElement: HTMLElement;
  showProperties: boolean;
  showLinkedMentions: boolean;
  contentMode: ContentMode;
  hiddenContent: Set<string>;
  scopeTerm: string | null;
  hostBasename: string | null;
  multipleColumns?: boolean;
  maxCardWidth?: number;
};

type SingleColumnViewProps = {
  entries: BasesEntry[];
  onEntryClick: (entry: BasesEntry, isModEvent: boolean) => void;
  onEntryContextMenu: (evt: React.MouseEvent, entry: BasesEntry) => void;
  scrollElement: HTMLElement;
  showProperties: boolean;
  showLinkedMentions: boolean;
  contentMode: ContentMode;
  hiddenContent: Set<string>;
  scopeTerm: string | null;
  hostBasename: string | null;
  maxCardWidth: number;
};

