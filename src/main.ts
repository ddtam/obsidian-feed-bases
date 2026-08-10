import { Plugin } from "obsidian";
import { FeedView, FeedViewType } from "./feed-view";
import { clearContentCache } from "./content-cache";
import { CONTENT_MODE_DEFAULT } from "./FeedEntryCard";
import { HIDDEN_CONTENT_DEFAULT } from "./hidden-content";

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
          default: false,
        },
        {
          key: "multipleColumns",
          type: "toggle",
          displayName: "Show notes in multiple columns (experimental)",
          default: false,
        },
        {
          key: "maxCardWidth",
          type: "slider",
          // Upstream capped this at 800, which is narrow for a single-column
          // feed of prose — a section that fits in a few lines in the note
          // stretches a long way in a 400px column. Slide to the max for
          // effectively full width.
          displayName: "Maximum card width",
          default: 700,
          min: 200,
          max: 2000,
          step: 20,
        },
        {
          key: "showLinkedMentions",
          type: "toggle",
          displayName: "Show linked mentions",
          default: false,
        },
        {
          key: "hiddenContent",
          type: "text",
          displayName: "Hide content (comma-separated)",
          default: HIDDEN_CONTENT_DEFAULT,
        },
        {
          key: "contentMode",
          type: "dropdown",
          displayName: "Card content",
          default: CONTENT_MODE_DEFAULT,
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
          default: "",
        },
      ],
    });
  }

  onunload() {
    // Module-level state; without this it survives a plugin reload.
    clearContentCache();
  }
}
