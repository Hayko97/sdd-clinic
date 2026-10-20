import { expect, it } from "vitest";
import {
  compactFindings,
  consolidateFindings,
  type Finding,
} from "../src/server/setup-consolidation.js";

const large = (): Finding[] =>
  Array.from({ length: 744 }, (_, id) => ({
    text: `Feature ${id} accepts item ${id}, rejects an invalid state and preserves its exact owner. `.repeat(
      4,
    ),
    sources: [
      { path: `src/module-${id % 239}.ts`, startLine: id + 1, endLine: id + 3 },
    ],
  }));
const run = (transform?: (result: any) => void) => {
  const notes = large();
  const messages: string[] = [];
  let calls = 0;
  return {
    notes,
    messages,
    calls: () => calls,
    result: consolidateFindings({
      notes,
      rebuilding: false,
      context: "fixture",
      progress: (message) => messages.push(message),
      validated: async (prompt, validate) => {
        calls++;
        const group = JSON.parse(prompt.split("FINDINGS\n").at(-1)!);
        const result = {
          notes: Array.from(
            { length: Math.ceil(group.length / 10) },
            (_, i) => {
              const items = group.slice(i * 10, (i + 1) * 10);
              return {
                text: `Features ${items.map((n: any) => n.id).join(",")}: each accepts its matching item, rejects invalid state and retains owner.`,
                findingIds: items.map((n: any) => n.id),
              };
            },
          ),
          questions: [],
        };
        transform?.(result);
        return validate(result);
      },
    }),
  };
};
it("converges heterogeneous findings in one bounded pass with lossless provenance and progress", async () => {
  const execution = run();
  const output = await execution.result;
  expect(output.notes.flatMap((n) => n.sources)).toEqual(
    execution.notes.flatMap((n) => n.sources),
  );
  expect(
    JSON.stringify(compactFindings(output.notes)).length,
  ).toBeLessThanOrEqual(180000);
  expect(execution.calls()).toBeLessThanOrEqual(6);
  expect(execution.messages.some((m) => m.includes("single pass"))).toBe(true);
  expect(execution.messages.at(-1)).toContain(
    "exact source references retained",
  );
});
it.each(["missing", "duplicate", "unknown", "oversized"])(
  "rejects %s consolidation output",
  async (kind) => {
    const execution = run((result) => {
      if (kind === "missing") result.notes.pop();
      if (kind === "duplicate")
        result.notes[0].findingIds.push(result.notes[1].findingIds[0]);
      if (kind === "unknown") result.notes[0].findingIds = [999999];
      if (kind === "oversized")
        result.notes.forEach((n: any) => (n.text = "A".repeat(5900)));
    });
    await expect(execution.result).rejects.toThrow(
      kind === "oversized" ? /budget/ : /finding ID/,
    );
    expect(execution.calls()).toBe(1);
  },
);
it("shares paths/ranges without changing absolute citations or requesting small-input consolidation", async () => {
  const notes = [
    {
      text: "a",
      sources: [{ path: "nested/a.ts", startLine: 30, endLine: 40 }],
    },
    {
      text: "b",
      sources: [{ path: "nested/a.ts", startLine: 30, endLine: 40 }],
    },
  ];
  expect(compactFindings(notes)).toEqual({
    files: ["nested/a.ts"],
    sources: [[0, 30, 40]],
    notes: [
      { text: "a", sources: [0] },
      { text: "b", sources: [0] },
    ],
  });
  const result = await consolidateFindings({
    notes,
    rebuilding: false,
    context: "",
    progress: () => {},
    validated: async () => {
      throw Error("unexpected provider call");
    },
  });
  expect(result.notes).toBe(notes);
});
