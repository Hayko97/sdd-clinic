import { z } from "zod";
import { assert } from "./util.js";
import { boundedGroups } from "./project-inventory.js";

type Source = { path: string; startLine: number; endLine: number };
export type Finding = { text: string; sources: Source[] };

// Paths occur once, ranges retain absolute lines, and findings cite range indices.
export function compactFindings(notes: Finding[]) {
  const files: string[] = [];
  const sources: number[][] = [];
  const ids = new Map<string, number>();
  return {
    files,
    sources,
    notes: notes.map((note) => ({
      text: note.text,
      sources: [
        ...new Set(
          note.sources.map((source) => {
            let file = files.indexOf(source.path);
            if (file < 0) {
              file = files.length;
              files.push(source.path);
            }
            const range = [file, source.startLine, source.endLine];
            const key = JSON.stringify(range);
            let id = ids.get(key);
            if (id === undefined) {
              id = sources.length;
              ids.set(key, id);
              sources.push(range);
            }
            return id;
          }),
        ),
      ],
    })),
  };
}
export const compactInstructions =
  "FINDINGS is a compact evidence ledger: files[fileIndex] is a path; sources[sourceIndex] is [fileIndex, absoluteStartLine, absoluteEndLine]; each note.sources contains sourceIndex values. Resolve these indices when returning ordinary path/startLine/endLine citations. Never widen ranges.";

export async function consolidateFindings(options: {
  notes: Finding[];
  context: string;
  rebuilding: boolean;
  progress(message: string, details?: object): void;
  validated<T>(prompt: string, validate: (value: unknown) => T): Promise<T>;
}) {
  const input = compactFindings(options.notes);
  const inputSize = JSON.stringify(input).length;
  if (inputSize <= 300_000)
    return { notes: options.notes, questions: [] as string[] };
  const groups = boundedGroups(
    options.notes.map((note, id) => ({ id, text: note.text })),
  );
  // Reserve the full provenance ledger, every source occurrence and JSON framing.
  const overhead = JSON.stringify(
    compactFindings(options.notes.map((n) => ({ ...n, text: "" }))),
  ).length;
  const budget = Math.floor((290_000 - overhead) / groups.length);
  assert(
    budget >= 1000,
    "Evidence references exceed the synthesis budget. No complete baseline was produced; split the project into independently reviewable components.",
  );
  const notes: Finding[] = [];
  const questions: string[] = [];
  for (const [index, group] of groups.entries()) {
    options.progress(
      `Consolidating group ${index + 1} of ${groups.length} (single pass; output budget ${budget} characters).`,
      {
        group: index + 1,
        groups: groups.length,
        inputCharacters: JSON.stringify(group).length,
        outputBudget: budget,
      },
    );
    const result = await options.validated(
      `CLINIC_BASELINE_CONSOLIDATE\n${options.context}\nConsolidate redundant wording while retaining distinct capabilities, failures, constraints and contradictions. ${options.rebuilding ? "Preserve exact reconstruction contracts, field names, values and unknowns." : ""} Return {"notes":[{"text":"concise combined behavior","findingIds":[0,1]}],"questions":[]}. Account for EVERY supplied finding id EXACTLY ONCE across notes. Use only supplied IDs. The application preserves their exact source references; do not write citation ranges. The COMPLETE JSON response must contain at most ${budget} characters. Compress repeated wording, not distinct behavior.\nFINDINGS\n${JSON.stringify(group)}`,
      (value) => {
        const parsed = z
          .object({
            notes: z
              .array(
                z.object({
                  text: z.string().min(1).max(6000),
                  findingIds: z.array(z.number().int().nonnegative()).min(1),
                }),
              )
              .min(1),
            questions: z.array(z.string().max(2000)).max(40),
          })
          .parse(value);
        assert(
          JSON.stringify(parsed).length <= budget,
          `Consolidation exceeds its ${budget}-character output budget (${JSON.stringify(parsed).length}); shorten redundant wording while retaining every finding ID and distinct behavior.`,
        );
        const ids = parsed.notes.flatMap((n) => n.findingIds);
        const supplied = new Set(group.map((n) => n.id));
        assert(
          ids.length === group.length &&
            new Set(ids).size === group.length &&
            ids.every((id) => supplied.has(id)),
          "Consolidation must account for every supplied finding ID exactly once; missing, duplicate or unknown finding IDs are invalid.",
        );
        return parsed;
      },
    );
    notes.push(
      ...result.notes.map((n) => ({
        text: n.text,
        sources: [
          ...new Map(
            n.findingIds
              .flatMap((id) => options.notes[id].sources)
              .map((s) => [JSON.stringify(s), s]),
          ).values(),
        ],
      })),
    );
    questions.push(...result.questions);
    options.progress(
      `Consolidated group ${index + 1} of ${groups.length}: ${JSON.stringify(group).length} → ${JSON.stringify(result).length} characters.`,
      { completedGroups: index + 1, totalGroups: groups.length },
    );
  }
  const outputSize = JSON.stringify(compactFindings(notes)).length;
  assert(
    outputSize <= 300_000,
    "Consolidated findings exceed the synthesis budget. No complete baseline was produced.",
  );
  options.progress(
    `Consolidation complete: ${inputSize} → ${outputSize} characters; exact source references retained.`,
    { inputCharacters: inputSize, outputCharacters: outputSize },
  );
  return { notes, questions };
}
