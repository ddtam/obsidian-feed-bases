import { Plugin } from "obsidian";
import { FeedView, FeedViewType } from "./feed-view";
import { clearContentCache } from "./content-cache";
import { FEED_DEFAULTS } from "./options";

export default class ObsidianFeedPlugin extends Plugin {
  onload() {
    this.registerBasesView(FeedViewType, {
      name: "Feed",
      icon: "lucide-newspaper",
      factory: (controller, containerEl) =>
        new FeedView(controller, containerEl),
      options: () => [
        {
          key: "showProperties",
          type: "toggle",
          displayName: "Show note properties (experimental)",
          default: FEED_DEFAULTS.showProperties,
        },
        {
          key: "multipleColumns",
          type: "toggle",
          displayName: "Show notes in multiple columns (experimental)",
          default: FEED_DEFAULTS.multipleColumns,
        },
        {
          key: "maxCardWidth",
          type: "slider",
          // Upstream capped this at 800, which is narrow for a single-column
          // feed of prose — a section that fits in a few lines in the note
          // stretches a long way in a 400px column. Slide to the max for
          // effectively full width.
          displayName: "Maximum card width",
          default: FEED_DEFAULTS.maxCardWidth,
          min: 200,
          max: 2000,
          step: 20,
        },
        {
          key: "showLinkedMentions",
          type: "toggle",
          displayName: "Show linked mentions",
          default: FEED_DEFAULTS.showLinkedMentions,
        },
        {
          key: "hiddenContent",
          type: "text",
          displayName: "Hide content (comma-separated)",
          default: FEED_DEFAULTS.hiddenContent,
        },
        {
          key: "contentMode",
          type: "dropdown",
          displayName: "Card content",
          default: FEED_DEFAULTS.contentMode,
          options: {
            editor: "Live editor",
            excerpt: "Excerpt only (read-only)",
            "excerpt-edit": "Excerpt, editable on click",
          },
        },
        {
          key: "sectionScope",
          type: "text",
          // Opt-in: blank does nothing. "auto" resolves to the note an embedded
          // base sits in. Only has an effect in the excerpt content modes.
          displayName: "Scope to section (blank = off, or 'auto')",
          placeholder: "auto, or a term like [[Project X]]",
          default: FEED_DEFAULTS.sectionScope,
        },
      ],
    });
  }

  onunload() {
    // Module-level state; without this it survives a plugin reload.
    clearContentCache();
  }
}
