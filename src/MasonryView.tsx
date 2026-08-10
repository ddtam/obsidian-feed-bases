import { App, BasesEntry } from "obsidian";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ContentMode, FeedEntryCard } from "./FeedEntryCard";
import {
  CONTAINER_PADDING,
  EDITOR_OVERSCAN,
  measureFeedElement,
} from "./measure";
import { useApp } from "./hooks";

export const MasonryView: React.FC<MasonryViewProps> = ({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);

  // Track container width for responsive column calculation
  useEffect(() => {
    if (!containerRef.current) return;

    const columnsForWidth = (width: number) => {
      // Account for gaps between columns (16px per gap)
      const gapSize = 16;
      const availableWidth = width - gapSize * 2; // padding on sides
      return Math.max(
        1,
        Math.floor((availableWidth + gapSize) / (maxCardWidth + gapSize)),
      );
    };

    let lastWidth = containerRef.current.offsetWidth;
    setColumnCount(columnsForWidth(lastWidth));

    // The observer fires on height changes too — and this container's height
    // changes constantly as rows are measured and async content lands. Reading
    // offsetWidth on each of those forces a layout during scroll for a result
    // that hasn't changed, so take the width from the entry and bail early.
    const resizeObserver = new ResizeObserver((observed) => {
      const box = observed[0]?.borderBoxSize?.[0];
      const width = box
        ? box.inlineSize
        : (containerRef.current?.offsetWidth ?? lastWidth);
      if (width === lastWidth) return;
      lastWidth = width;
      setColumnCount(columnsForWidth(width));
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [maxCardWidth]);

  // Distribute entries across columns
  const columns = useMemo(() => {
    const cols: BasesEntry[][] = Array.from({ length: columnCount }, () => []);

    // Distribute entries evenly across columns (round-robin)
    entries.forEach((entry, index) => {
      cols[index % columnCount].push(entry);
    });

    return cols;
  }, [entries, columnCount]);

  return (
    <div ref={containerRef} className="bases-feed bases-feed-masonry">
      {entries.length === 0 ? (
        <div className="bases-feed-empty">No notes to display</div>
      ) : (
        <div
          className="bases-feed-masonry-grid"
          style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
        >
          {columns.map((columnEntries, columnIndex) => (
            <MasonryColumn
              key={columnIndex}
              entries={columnEntries}
              scrollElement={scrollElement}
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
          ))}
        </div>
      )}
    </div>
  );
};

const MasonryColumn: React.FC<MasonryColumnProps> = ({
  entries,
  scrollElement,
  app,
  showProperties,
  showLinkedMentions,
  contentMode,
  hiddenContent,
  scopeTerm,
  hostBasename,
  onEntryClick,
  onEntryContextMenu,
}) => {
  const getScrollEl = useMemo(() => () => scrollElement, [scrollElement]);

  const getItemKey = useCallback(
    (index: number) => entries[index]?.file.path ?? index,
    [entries],
  );

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: getScrollEl,
    getItemKey,
    estimateSize: () => 280,
    // Note this is per column, so the mounted-editor count is
    // columnCount * (visible + 2 * overscan).
    overscan: EDITOR_OVERSCAN,
    scrollMargin: CONTAINER_PADDING,
    measureElement: measureFeedElement,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="bases-feed-masonry-column">
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
                  // See the single-column view: vi.start includes scrollMargin.
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
    </div>
  );
};


// Props

type MasonryViewProps = {
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

type MasonryColumnProps = {
  entries: BasesEntry[];
  scrollElement: HTMLElement;
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

