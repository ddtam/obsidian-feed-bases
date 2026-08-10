import { describe, expect, it } from "vitest";
import { buildExcerpt, sectionRangeForLine, subtractRanges } from "./excerpt";
import { parseHiddenContent } from "./hidden-content";
import { makeCache } from "./test-cache";

const run = (text: string, options = {}) =>
  buildExcerpt(text, makeCache(text), options);

describe("sectionRangeForLine", () => {
  const text = ["# Title", "", "## A", "body a", "## B", "body b"].join("\n");

  it("returns the heading's own section when the match line is a heading", () => {
    const range = sectionRangeForLine(2, makeCache(text), text.length);
    expect(text.slice(range!.start, range!.end).trim()).toBe("## A\nbody a");
  });

  it("walks back to the enclosing heading for a non-heading line", () => {
    const range = sectionRangeForLine(3, makeCache(text), text.length);
    expect(text.slice(range!.start, range!.end).trim()).toBe("## A\nbody a");
  });

  it("returns null for a line before any heading", () => {
    const preamble = ["intro line", "", "## A", "body a"].join("\n");
    expect(
      sectionRangeForLine(0, makeCache(preamble), preamble.length),
    ).toBeNull();
  });

  it("treats a line under a top-level heading as that heading's section", () => {
    // Not the preamble: line 1 is blank but still inside `# Title`.
    const range = sectionRangeForLine(1, makeCache(text), text.length);
    expect(text.slice(range!.start, range!.end)).toBe(text);
  });
});

describe("subtractRanges", () => {
  it("applies multiple removals without invalidating later offsets", () => {
    const keeps = [{ start: 0, end: 100 }];
    const removals = [
      { start: 60, end: 70 },
      { start: 10, end: 20 },
    ];
    expect(subtractRanges(keeps, removals)).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 60 },
      { start: 70, end: 100 },
    ]);
  });
});

describe("section scoping", () => {
  // The shape of a real work log: the ticket is an H2, detail nested under it,
  // and an unrelated section alongside.
  const workLog = [
    "---",
    "type: work log",
    "---",
    "",
    "# 2026-05-21 Work Log",
    "",
    "## Reading",
    "some unrelated notes",
    "",
    "## [[KARSANBIO-4439|KARSANBIO-4439]]",
    "did the thing",
    "",
    "### Progress Reflection",
    "went fine",
    "",
    "## Other Project",
    "not this one",
  ].join("\n");

  it("keeps only the matched section and its deeper subsections", () => {
    const out = run(workLog, { scopeTerm: "KARSANBIO-4439" });
    expect(out).toContain("## [[KARSANBIO-4439|KARSANBIO-4439]]");
    expect(out).toContain("### Progress Reflection");
    expect(out).toContain("went fine");
    expect(out).not.toContain("## Reading");
    expect(out).not.toContain("## Other Project");
  });

  it("strips frontmatter", () => {
    expect(run(workLog, { scopeTerm: "KARSANBIO-4439" })).not.toContain(
      "type: work log",
    );
  });

  it("matches a bracketed term the same as a bare one", () => {
    expect(run(workLog, { scopeTerm: "[[KARSANBIO-4439]]" })).toBe(
      run(workLog, { scopeTerm: "KARSANBIO-4439" }),
    );
  });

  it("keeps every matched section when a note mentions the term twice", () => {
    const text = [
      "# Log",
      "## [[Proj]] morning",
      "a",
      "## Unrelated",
      "b",
      "## [[Proj]] evening",
      "c",
    ].join("\n");
    const out = run(text, { scopeTerm: "Proj" });
    expect(out).toContain("morning");
    expect(out).toContain("evening");
    expect(out).not.toContain("Unrelated");
  });

  it("matches a link in a heading that has trailing text", () => {
    // Real shape from 2026-08-06 Work Log: two H2s for the same ticket, the
    // second carrying a suffix.
    const text = [
      "# 2026-08-06 Work Log",
      "",
      "Main reminders:",
      "",
      "## [[KARSANBIO-4810]]",
      "",
      "> migrated from [[KARSANBIO-4439]]",
      "",
      "## [[KARSANBIO-4810]] Final Report",
      "",
      "the conclusion",
    ].join("\n");

    const out = run(text, { scopeTerm: "KARSANBIO-4810" });
    expect(out).toContain("Final Report");
    expect(out).toContain("the conclusion");
    expect(out).not.toContain("Main reminders");
  });

  it("matches an unlinked heading even when the term is linked elsewhere", () => {
    const text = [
      "# Log",
      "",
      "## [[Proj]]",
      "linked section",
      "",
      "## Proj summary",
      "plain-text heading",
      "",
      "## Unrelated",
      "no",
    ].join("\n");

    const out = run(text, { scopeTerm: "Proj" });
    expect(out).toContain("linked section");
    expect(out).toContain("plain-text heading");
    expect(out).not.toContain("## Unrelated");
  });

  it("does not match a term that is only a prefix of a longer word", () => {
    const text = [
      "# Log",
      "",
      "## Projection work",
      "not this",
      "",
      "## [[Proj]]",
      "this one",
    ].join("\n");

    const out = run(text, { scopeTerm: "Proj" });
    expect(out).toContain("this one");
    expect(out).not.toContain("Projection work");
  });

  it("falls back to the whole note when the term is missing", () => {
    const out = run(workLog, { scopeTerm: "Nonexistent" });
    expect(out).toContain("## Reading");
    expect(out).toContain("## Other Project");
  });

  it("falls back to the whole note when the match is in the preamble", () => {
    const text = ["Mentions [[Proj]] up top.", "", "## A", "body"].join("\n");
    const out = run(text, { scopeTerm: "Proj" });
    expect(out).toContain("## A");
    expect(out).toContain("Mentions");
  });

  it("matches a tag as well as a link", () => {
    const text = ["# Log", "## Work #proj", "detail", "## Other", "no"].join(
      "\n",
    );
    const out = run(text, { scopeTerm: "#proj" });
    expect(out).toContain("detail");
    expect(out).not.toContain("## Other");
  });
});

describe("hiddenContent filtering", () => {
  const hidden = parseHiddenContent("todoist-task, todoist, base");

  it("strips a fenced block by language", () => {
    const text = ["# N", "", "```todoist-task", "id: 42", "```", "", "after"].join(
      "\n",
    );
    const out = run(text, { hidden });
    expect(out).not.toContain("id: 42");
    expect(out).toContain("after");
  });

  it("leaves fences whose language is not listed", () => {
    const text = ["# N", "", "```text", "keep me", "```"].join("\n");
    expect(run(text, { hidden })).toContain("keep me");
  });

  it("strips a callout by type", () => {
    const text = ["# N", "", "> [!todoist] Tasks", "> body", "", "after"].join(
      "\n",
    );
    const out = run(text, { hidden });
    expect(out).not.toContain("body");
    expect(out).toContain("after");
  });

  it("strips an embed by target extension", () => {
    const text = ["# N", "", "![[related.base]]", "", "after"].join("\n");
    const out = run(text, { hidden });
    expect(out).not.toContain("related.base");
    expect(out).toContain("after");
  });

  it("strips an embed that targets one view of a base", () => {
    const text = [
      "# N",
      "",
      "![[2026_cancun_dayplans.base#calendar]]",
      "",
      "after",
    ].join("\n");
    const out = run(text, { hidden });
    expect(out).not.toContain("cancun");
    expect(out).toContain("after");
  });

  it("hits fence and embed forms with the one `base` token", () => {
    const text = [
      "# N",
      "",
      "![[related.base]]",
      "",
      "```base",
      "filters: {}",
      "```",
      "",
      "after",
    ].join("\n");
    const out = run(text, { hidden });
    expect(out).not.toContain("related.base");
    expect(out).not.toContain("filters: {}");
    expect(out).toContain("after");
  });

  it("collapses a callout left empty by a removed embed", () => {
    const text = ["# N", "", "> [!note]- Related", "> ![[related.base]]", "", "after"].join(
      "\n",
    );
    const out = run(text, { hidden });
    expect(out).not.toContain("Related");
    expect(out).toContain("after");
  });

  it("keeps a callout that still has body text", () => {
    const text = ["# N", "", "> [!note]- Related", "> keep", "> ![[x.base]]"].join(
      "\n",
    );
    expect(run(text, { hidden })).toContain("keep");
  });

  it("removes a self-referencing embed even with an empty hidden list", () => {
    const text = ["# N", "", "![[KARSANBIO-4439]]", "", "after"].join("\n");
    const out = run(text, {
      hidden: new Set<string>(),
      hostBasename: "KARSANBIO-4439",
    });
    expect(out).not.toContain("KARSANBIO-4439]]");
    expect(out).toContain("after");
  });

  it("honours the %% feed:hide %% marker pair", () => {
    const text = [
      "# N",
      "",
      "%% feed:hide %%",
      "secret",
      "%% /feed:hide %%",
      "",
      "after",
    ].join("\n");
    const out = run(text, {});
    expect(out).not.toContain("secret");
    expect(out).toContain("after");
  });

  it("applies scoping and filtering together", () => {
    // Mirrors the real split: the day-level query sits in the preamble and is
    // dropped by scoping, while the badge inside the matched section is not —
    // only the content filter removes that one.
    const text = [
      "# 2026-05-21 Work Log",
      "",
      "```todoist",
      'filter: "today"',
      "```",
      "",
      "## [[Proj]]",
      "",
      "```todoist-task",
      "id: 7",
      "```",
      "",
      "detail",
    ].join("\n");

    const scopedOnly = run(text, { scopeTerm: "Proj" });
    expect(scopedOnly).not.toContain('filter: "today"');
    expect(scopedOnly).toContain("id: 7");

    const both = run(text, { scopeTerm: "Proj", hidden });
    expect(both).not.toContain('filter: "today"');
    expect(both).not.toContain("id: 7");
    expect(both).toContain("detail");
  });
});
