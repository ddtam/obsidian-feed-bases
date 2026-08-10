/**
 * One source of truth for the view options' defaults.
 *
 * `BasesViewConfig.get()` returns undefined for an option the user has never
 * explicitly set — the value registered in `registerBasesView` is what the
 * settings UI seeds a control with, not what `get()` falls back to. So every
 * default exists in two places: the registration and the read site.
 *
 * They drifted immediately (maxCardWidth was registered as 700 while the read
 * site still said 400, so a base only picked up the new width once you nudged
 * the slider and wrote an explicit value). Both sides now read from here.
 */

export type ContentMode = "editor" | "excerpt" | "excerpt-edit";

export const CONTENT_MODES: ContentMode[] = [
  "editor",
  "excerpt",
  "excerpt-edit",
];

export const FEED_DEFAULTS = {
  showProperties: false,
  multipleColumns: false,
  /**
   * Upstream defaulted to 400 and capped the slider at 800. 400 was too narrow
   * for a single-column feed of prose; 700 turned out to be wider than the
   * editor's own readable line width. 600 sits just above normal text width.
   * The slider still goes to 2000.
   */
  maxCardWidth: 600,
  showLinkedMentions: false,
  hiddenContent: "todoist-task, todoist, base",
  /**
   * Live editor, not an excerpt: swapping between rendered and editable reflows
   * the card both entering and leaving, which reads as the feed jumping around.
   */
  contentMode: "editor" as ContentMode,
  /** Blank = no scoping. Opt-in; see resolveScopeTerm. */
  sectionScope: "",
} as const;

export function asContentMode(value: unknown): ContentMode {
  return CONTENT_MODES.includes(value as ContentMode)
    ? (value as ContentMode)
    : FEED_DEFAULTS.contentMode;
}
