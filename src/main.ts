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
          displayName: "Maximum card width (experimental)",
          default: 400,
          min: 200,
          max: 800,
          step: 10,
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
          key: "sectionScope",
          type: "text",
          displayName: "Scope to section mentioning (blank = host note)",
          default: "",
        },
        {
          key: "contentMode",
          type: "dropdown",
          displayName: "Card content",
          default: CONTENT_MODE_DEFAULT,
          options: {
            "excerpt-edit": "Excerpt, editable on click",
            excerpt: "Excerpt only (read-only)",
            editor: "Live editor",
          },
        },
      ],
    });
  }

  onunload() {
    // Module-level state; without this it survives a plugin reload.
    clearContentCache();
  }
}
