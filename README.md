## Obsidian Feed Bases

This is a **personal fork** of [edrickleong/obsidian-feed-bases](https://github.com/edrickleong/obsidian-feed-bases), rebranded to plugin id `feed-bases-fork` so it installs alongside the original. All credit for the plugin goes to [Edrick Leong](https://github.com/edrickleong) — please support the original author below.

<a href='https://ko-fi.com/W7W71T4JPP' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi5.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

![](screenshot.png)

Adds a feed layout to [Obsidian Bases](https://help.obsidian.md/bases) so you can display notes with their content in an editable feed view.

- Display all notes from your bases in a scrollable feed.
- Edits are automatically saved back to the source file.
- Sort by modified date, created date, or name (default).
- Click note titles to open them or use context menus for more options.

## Installation

This plugin currently requires Obsidian v1.10.0 or later to work.

Obsidian v1.10.0 is currently in [Early Access](https://help.obsidian.md/early-access), so you will need a [Catalyst license](https://help.obsidian.md/catalyst) to use it.

### Install via BRAT

1. Install the [BRAT plugin](obsidian://show-plugin?id=obsidian42-brat) under Community Plugins.
2. Open BRAT settings and click "Add beta plugin".
3. Enter the URL of **this fork**: `https://github.com/ddtam/obsidian-feed-bases` (for the original, use `https://github.com/edrickleong/obsidian-feed-bases`).
4. Under "Select a version", choose the Latest version.
5. Click "Add plugin".

**Note:** this fork registers the same `feed` Bases view type as the original, so existing `.base` files keep working unchanged — but that also means **the two cannot both be enabled at once**. Disable the original Feed Bases before enabling this one.

### Install via Community Plugins

The original Feed Bases is under review for Community Plugins. This fork is BRAT-only by design and will not be submitted.

## Usage

1. Create or open a Bases view.
2. Click the view type selector and choose "Feed".
3. Configure sorting options in the view settings.
4. Edit notes directly in the feed by clicking on them.
5. Any changes you make are automatically saved.

## License

This project is licensed under the MIT License.
