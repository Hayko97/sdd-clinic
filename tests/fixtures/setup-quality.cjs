// Scripted provider output for orchestration tests, not a semantic model evaluation.
module.exports = function qualityFixture(prompt) {
  const input = JSON.parse(prompt.split("REVIEW_INPUT\n").at(-1));
  const source = input.evidence.flatMap((e) => e.sources).slice(0, 1);
  const topics = [
    "purpose",
    "architecture",
    "interfaces",
    "data",
    "workflows",
    "navigation",
    "responsive",
    "states",
    "accessibility",
    "visual",
    "localization",
    "authentication",
    "security",
    "operations",
    "nonfunctional",
    "verification",
    "roadmap",
  ];
  const result = {
    areas: Object.fromEntries(
      topics.map((name) => [
        name,
        {
          status: name === "purpose" ? "evidenced" : "unknown",
          details:
            name === "purpose"
              ? "The fixture describes a small existing capability whose documented outcomes must be preserved during setup and subsequent implementation."
              : `The controlled fixture does not establish ${name} contracts; the owner must provide relevant constraints before implementing affected behavior.`,
          sources: source,
          gaps: [
            `Confirm ${name} details with the owner and inspect the relevant implementation or product references.`,
          ],
        },
      ]),
    ),
    checks: input.scenarios.map((s) => ({
      scenarioId: s.id,
      kind: "proposed-test",
      prerequisites:
        "Use an isolated local test environment with a disposable fixture store; no production access is required.",
      fixture:
        "Create records A (active) and B (inactive), and a separate empty collection. Supply integer inputs 2 and 3 for arithmetic fixtures.",
      action: `Implement a proposed check for ${s.requirement} / ${s.name}: invoke the public entry point once with each fixture and capture the returned result; this test does not exist yet.`,
      assertions: `Assert the specified output and zero unintended writes for ${s.requirement} / ${s.name}. Expected observations: ${s.behavior}`,
      evidence:
        "Capture fixture inputs, actual result, application revision, specification hash and the proposed test log in a separate verification report.",
      testSources: [],
    })),
    decisions: [],
    blockingIssues: [],
  };
  const visual = input.evidence.find((e) => /green/i.test(e.text));
  if (visual)
    result.areas.visual = {
      status: "evidenced",
      details:
        "The supplied product reference requires accessible green primary actions. Preserve this visual intent; actual rendering and accessibility conformance remain unverified.",
      sources: visual.sources,
      gaps: [
        "Validate the chosen color's contrast and interaction states with actual rendered controls.",
      ],
    };
  return result;
};
