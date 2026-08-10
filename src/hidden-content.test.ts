import { describe, expect, it } from "vitest";
import { buildHiddenContentCss } from "./hidden-content-styles";
import {
  calloutType,
  embedExtension,
  fenceLanguage,
  parseHiddenContent,
} from "./hidden-content";

describe("kind matching", () => {
  it("reads a fence language", () => {
    expect(fenceLanguage("```todoist-task")).toBe("todoist-task");
    expect(fenceLanguage("~~~base")).toBe("base");
    expect(fenceLanguage("```")).toBeNull();
  });

  it("reads a callout type", () => {
    expect(calloutType("> [!todoist] Tasks")).toBe("todoist");
    expect(calloutType("> [!note]- Related")).toBe("note");
    expect(calloutType("> just a quote")).toBeNull();
  });

  it("reads an embed target extension, subpath and alias included", () => {
    expect(embedExtension("related.base")).toBe("base");
    // Embedding one view of a base — the case editor-mode CSS used to miss.
    expect(embedExtension("2026_cancun_dayplans.base#calendar")).toBe("base");
    expect(embedExtension("x.base|alias")).toBe("base");
    expect(embedExtension("Some Note")).toBeNull();
  });
});

describe("parseHiddenContent", () => {
  it("trims, lowercases and drops empties", () => {
    expect([...parseHiddenContent(" Todoist-Task ,, base ,")]).toEqual([
      "todoist-task",
      "base",
    ]);
    expect(parseHiddenContent("").size).toBe(0);
    expect(parseHiddenContent(undefined).size).toBe(0);
  });
});

describe("editor-mode CSS", () => {
  const css = buildHiddenContentCss(new Set(["base"]), "scope");

  it("covers a plain embed and one targeting a view", () => {
    expect(css).toContain('.internal-embed[src$=".base" i]');
    expect(css).toContain('.internal-embed[src*=".base#" i]');
  });

  it("emits fence and callout rules too", () => {
    expect(css).toContain(".block-language-base");
    expect(css).toContain('.callout[data-callout="base"]');
  });

  it("scopes every rule to the view", () => {
    for (const rule of css.split("\n").filter(Boolean)) {
      expect(rule.startsWith(".scope ")).toBe(true);
    }
  });

  it("skips the class-based rule for tokens that aren't safe identifiers", () => {
    const odd = buildHiddenContentCss(new Set(['a"b']), "scope");
    expect(odd).not.toContain(".block-language-");
    expect(odd).toContain('\\"');
  });
});
