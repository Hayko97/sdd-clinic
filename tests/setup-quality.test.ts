import { afterEach, expect, it, vi } from "vitest";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  qualityDocuments,
  qualityAreas,
  reviewSetup,
  reviewSourceCoverage,
  scenarioCases,
  setupReviewPath,
  validateQuality,
} from "../src/server/setup-quality.js";
import { inventoryProject } from "../src/server/project-inventory.js";
import {
  setupOverview,
  modulePreambleLines,
  overviewCoverage,
} from "../src/server/setup-overview.js";
import { qualityFixture } from "./setup-quality-fixture.js";
import { tempDir } from "./helpers.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
const files = [
  {
    path: "openspec/specs/orders/spec.md",
    after: `# Orders
## Purpose
Allow customers to manage their own order before fulfillment.
## Requirements
### Requirement: Customer cancellation
Customers SHALL cancel their own pending orders.
#### Scenario: Cancel pending order
- **WHEN** the owner cancels a pending order
- **THEN** the order becomes canceled and its stock is restored exactly once
`,
  },
];
const evidence = [
  {
    text: "Owner confirmed: keep customer cancellation required and record the implementation gap.",
    sources: [
      { path: "openspec/project/decisions.md", startLine: 1, endLine: 1 },
    ],
  },
  {
    text: "Only admins may update order status; the customer UI has no cancellation action.",
    sources: [{ path: "db/policy.sql", startLine: 2, endLine: 4 }],
  },
  {
    text: "it('restores stock once', () => assert.equal(stock, 3));",
    sources: [{ path: "tests/orders.test.ts", startLine: 1, endLine: 1 }],
  },
];
const cases = scenarioCases(files);
const prompt = `REVIEW_INPUT\n${JSON.stringify({ scenarios: cases, evidence })}`;
function reviewed() {
  const quality = qualityFixture(prompt);
  quality.checks[0] = {
    scenarioId: cases[0].id,
    kind: "proposed-test",
    prerequisites:
      "Use a disposable local database with customers C1 and C2, admin A1, and stock tracking enabled; no remote credentials.",
    fixture:
      "Create pending order O1 owned by C1 for quantity 2 of product P1 with current stock 3. Create a second order O2 owned by C2.",
    action:
      "As C1 open order O1, activate Cancel and confirm. Retry the identical cancellation request. Attempt to cancel O2 as C1.",
    assertions:
      "O1 status is canceled and stock becomes 5 after the first request and remains 5 after retry. O2 is unchanged and the ownership violation is rejected.",
    evidence:
      "Record request/response bodies, before/after status and stock snapshots, UI feedback screenshot, environment and exact application/specification revisions.",
    testSources: [],
  };
  quality.decisions = [
    {
      kind: "implementation-gap",
      intent:
        "Customers must be able to cancel their own pending orders; the owner explicitly retained this requirement.",
      observed:
        "The inspected SQL permits only administrators to update status, and the customer UI lacks a cancel action.",
      disposition:
        "Preserve the cancellation requirement. Implement customer authorization and UI through a separately reviewed change; do not weaken intent to match this bug.",
      sources: evidence.slice(0, 2).flatMap((e) => e.sources),
    },
  ];
  return quality;
}

it("retains required cancellation and produces concrete unverified checks with portable provenance", async () => {
  const root = await tempDir();
  roots.push(root);
  const quality = validateQuality(reviewed(), cases, evidence);
  const docs = await qualityDocuments({
    root,
    files,
    quality,
    coverage:
      "PARTIAL: database and owner decisions supplied; browser behavior unverified.",
    sources: [{ path: "db/policy.sql", hash: "dirty-source-sha" }],
  });
  expect(docs.find((f) => f.path === files[0].path)?.after).toBe(
    files[0].after,
  );
  const validation = docs.find((f) => f.path.endsWith("/validation.md"))!.after;
  expect(validation).toContain("stock becomes 5");
  expect(validation).toContain("proposed-test");
  expect(validation).not.toContain("Actual result");
  const report = docs.find((f) => f.path === setupReviewPath)!.after;
  expect(report).toContain("implementation-gap");
  expect(report).toContain("not granted by generation or application");
  expect(report).toContain('"version": "1.14.2"');
  expect(report).toContain("dirty-source-sha");
  for (const topic of Object.keys(qualityAreas))
    expect(report).toContain(`## ${topic}`);
  for (const doc of [
    "mission",
    "tech-stack",
    "architecture",
    "contracts",
    "ui-ux",
    "operations",
    "roadmap",
  ])
    expect(docs.some((f) => f.path === `openspec/project/${doc}.md`)).toBe(
      true,
    );
});

it.each([
  [
    "missing scenario",
    (q: ReturnType<typeof reviewed>) => {
      q.checks = [];
    },
    /every qualified scenario/,
  ],
  [
    "duplicate scenario",
    (q: ReturnType<typeof reviewed>) => {
      q.checks.push(q.checks[0]);
    },
    /every qualified scenario/,
  ],
  [
    "generic check",
    (q: ReturnType<typeof reviewed>) => {
      q.checks[0].action =
        "Arrange the stated preconditions and perform the WHEN action.";
    },
    /generic/,
  ],
  [
    "restated scenario",
    (q: ReturnType<typeof reviewed>) => {
      q.checks[0].action = "the owner cancels a pending order";
    },
    /restates/,
  ],
  [
    "fictional test",
    (q: ReturnType<typeof reviewed>) => {
      q.checks[0].kind = "existing-test";
    },
    /actual test references/,
  ],
  [
    "documentation as test",
    (q: ReturnType<typeof reviewed>) => {
      q.checks[0].kind = "existing-test";
      q.checks[0].testSources = evidence[0].sources;
    },
    /test code/,
  ],
  [
    "unseen source",
    (q: ReturnType<typeof reviewed>) => {
      q.areas.data.sources = [
        { path: "db/policy.sql", startLine: 1, endLine: 4 },
      ];
    },
    /unavailable evidence/,
  ],
  [
    "unsupported architecture",
    (q: ReturnType<typeof reviewed>) => {
      q.areas.architecture.status = "evidenced";
      q.areas.architecture.sources = [];
    },
    /supporting sources/,
  ],
  [
    "hidden uncertainty",
    (q: ReturnType<typeof reviewed>) => {
      q.areas.security.gaps = [];
    },
    /explicit gaps/,
  ],
  [
    "scaffold mission",
    (q: ReturnType<typeof reviewed>) => {
      q.areas.purpose.details =
        "[CLINIC:DRAFT] Define the target users and their desired outcomes.";
    },
    /scaffold/,
  ],
] as const)("rejects %s before application", (_name, damage, error) => {
  const quality = reviewed();
  damage(quality);
  expect(() => validateQuality(quality, cases, evidence)).toThrow(error);
});

it("accepts a cited existing test while preserving absent UI constraints as unknown", () => {
  const q = reviewed();
  q.checks[0].kind = "existing-test";
  q.checks[0].testSources = evidence[2].sources;
  expect(validateQuality(q, cases, evidence).areas.visual.status).toBe(
    "unknown",
  );
});

it("supports backend-only applicability without fabricating UI specifications", async () => {
  const q = reviewed();
  for (const name of [
    "navigation",
    "responsive",
    "visual",
    "accessibility",
  ] as const)
    q.areas[name] = {
      status: "not-applicable",
      details:
        "This fixture is a database-only service with no presentation interface or human-operated controls in the intended scope.",
      sources: evidence[1].sources,
      gaps: [],
    };
  expect(validateQuality(q, cases, evidence).areas.navigation.status).toBe(
    "not-applicable",
  );
});

it("does not ask a reviewer to erase a semantic blocker from the same deficient specifications", async () => {
  const q = reviewed();
  q.blockingIssues = [
    "The generated order specification omits the documented 24-hour draft expiry and uncertain retry behavior.",
  ];
  const invoke = vi.fn(async () => JSON.stringify(q));
  await expect(
    reviewSetup({
      files,
      evidence,
      coverage: "partial",
      signal: new AbortController().signal,
      invoke,
      progress: () => {},
    }),
  ).rejects.toThrow("blocking generation defects");
  expect(invoke).toHaveBeenCalledTimes(1);
});

it("bounds malformed-output repairs, accepts concrete correction and does not retry provider failures", async () => {
  const options = {
    files,
    evidence,
    coverage: "partial",
    signal: new AbortController().signal,
    progress: () => {},
  };
  const malformed = vi.fn(async () => "{}");
  await expect(reviewSetup({ ...options, invoke: malformed })).rejects.toThrow(
    "No applicable",
  );
  expect(malformed).toHaveBeenCalledTimes(3);
  const repaired = vi
    .fn()
    .mockResolvedValueOnce("not json")
    .mockResolvedValue(JSON.stringify(reviewed()));
  expect(
    (await reviewSetup({ ...options, invoke: repaired })).checks[0].fixture,
  ).toContain("quantity 2");
  const offline = vi.fn(async () => {
    throw new Error("provider offline");
  });
  await expect(reviewSetup({ ...options, invoke: offline })).rejects.toThrow(
    "provider offline",
  );
  expect(offline).toHaveBeenCalledTimes(1);
});

it("preserves custom guidance and refuses customized reports or stale companions", async () => {
  const root = await tempDir();
  roots.push(root);
  await mkdir(join(root, "openspec/project"), { recursive: true });
  await writeFile(
    join(root, "openspec/project/ui-ux.md"),
    "Owner's visual and accessibility rules.",
  );
  const options = {
    root,
    files,
    quality: reviewed(),
    coverage: "partial",
    sources: [],
  };
  expect(
    (await qualityDocuments(options)).some(
      (f) => f.path === "openspec/project/ui-ux.md",
    ),
  ).toBe(false);
  await writeFile(join(root, setupReviewPath), "Owner's custom review");
  await expect(qualityDocuments(options)).rejects.toThrow("customized");
  expect(await readFile(join(root, setupReviewPath), "utf8")).toBe(
    "Owner's custom review",
  );
});

it("samples nested UI, SQL, Python tests and services beyond an import-heavy entrypoint and lists omissions", async () => {
  const root = await tempDir();
  roots.push(root);
  const sources = {
    "README.md":
      "A shop with customer order history, cancellation and catalog management.\n",
    "src/App.tsx":
      "import { x } from './x';\n".repeat(400) +
      "export function App() { return <OrdersModal />; }\n",
    "src/components/OrdersModal.tsx":
      "export function OrdersModal() { return <button>Cancel order</button>; }\n",
    "db/migrations/008.sql":
      "create policy admin_only on orders using (is_admin());\n",
    "tests/test_orders.py":
      "def test_cancel_owner():\n    assert cancel('O1', user='C1').stock == 5\n",
    "services/orders.py":
      "def cancel(order, user):\n    return transaction(order, user)\n",
    "package.json":
      '{"scripts":{"test:db":"node tests/db.mjs","test:e2e":"playwright test"}}',
  };
  for (const [path, content] of Object.entries(sources)) {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), content);
  }
  const inventory = await inventoryProject({ path: root });
  const overview = setupOverview(inventory);
  expect(
    overview.reduce((n, c) => n + c.content.length, 0),
  ).toBeLessThanOrEqual(36000);
  expect(overview.find((c) => c.path === "src/App.tsx")!.content).toContain(
    "OrdersModal",
  );
  expect(
    overview.find((c) => c.path === "src/App.tsx")!.startLine,
  ).toBeGreaterThan(400);
  for (const path of Object.keys(sources))
    expect(overview.some((c) => c.path === path)).toBe(true);
  const coverage = overviewCoverage(inventory, overview);
  expect(coverage).toContain("PARTIAL");
  expect(coverage).toContain("src/App.tsx:1-201,266-372");
  for (const chunk of overview)
    expect(chunk.content).toBe(
      sources[chunk.path as keyof typeof sources]
        .split("\n")
        .slice(chunk.startLine - 1, chunk.endLine)
        .join("\n"),
    );
});

it("keeps semicolon-free imports from swallowing test bodies and handles multiline imports", () => {
  const text =
    "import { test } from 'vitest'\nimport {\n cancel,\n} from '../orders'\n\ntest('stock returns', () => {\n  expect(cancel()).toBe(5)\n})\n";
  expect(modulePreambleLines(text)).toBe(5);
  expect(
    text.split("\n").slice(modulePreambleLines(text)).join("\n"),
  ).toContain("test('stock returns'");
  expect(modulePreambleLines("export { active } from './catalog'\n")).toBe(2);
  expect(
    modulePreambleLines(
      "export const active = products.filter(p => p.active)\n",
    ),
  ).toBe(0);
});

it("reviews existing companions without overwriting them and fills a missing companion from concrete checks", async () => {
  const root = await tempDir();
  roots.push(root);
  const companion = join(root, "openspec/specs/orders/validation.md");
  await mkdir(join(companion, ".."), { recursive: true });
  await writeFile(companion, "Owner's custom validation plan");
  const options = {
    root,
    files: [],
    specifications: files,
    quality: reviewed(),
    coverage: "partial",
    sources: [],
  };
  const preserved = await qualityDocuments(options);
  expect(preserved.some((f) => f.path.endsWith("orders/validation.md"))).toBe(
    false,
  );
  expect(preserved.find((f) => f.path === setupReviewPath)?.after).toContain(
    "stock becomes 5",
  );
  expect(await readFile(companion, "utf8")).toBe(
    "Owner's custom validation plan",
  );
  await rm(companion);
  const missing = await qualityDocuments(options);
  expect(
    missing.find((f) => f.path.endsWith("orders/validation.md"))?.after,
  ).toContain("stock becomes 5");
  expect(missing.some((f) => f.path.endsWith("orders/spec.md"))).toBe(false);
});

it("accepts concrete Cyrillic checks and still rejects a copied Cyrillic scenario", () => {
  const q = reviewed();
  q.checks[0].fixture = "Создайте неоплаченный заказ для пользователя Анна.";
  q.checks[0].action =
    "Откройте историю заказов и нажмите кнопку отмены заказа.";
  expect(() => validateQuality(q, cases, evidence)).not.toThrow();
  const translated = [
    { ...cases[0], behavior: `WHEN ${q.checks[0].action}\nTHEN заказ отменён` },
  ];
  expect(() => validateQuality(q, translated, evidence)).toThrow(/restates/);
});

it("supports native removal and rename deltas without requiring invented scenarios", () => {
  const path = "openspec/changes/retire-orders/specs/orders/spec.md";
  const removed =
    "## REMOVED Requirements\n### Requirement: Legacy order lookup\n**Reason**: Retired by owner.\n**Migration**: Use order history.\n";
  expect(scenarioCases([{ path, after: removed }])).toEqual([]);
  expect(
    scenarioCases([
      {
        path,
        after:
          "## RENAMED Requirements\n- FROM: `Old lookup`\n- TO: `Order history`\n",
      },
    ]),
  ).toEqual([]);
  const added = files[0].after.replace(
    "## Requirements",
    "## ADDED Requirements",
  );
  expect(scenarioCases([{ path, after: removed + "\n" + added }])).toHaveLength(
    1,
  );
  expect(() =>
    scenarioCases([
      {
        path,
        after:
          "## ADDED Requirements\n### Requirement: Broken addition\nOrders SHALL work.\n",
      },
    ]),
  ).toThrow(/no scenarios/);
});

it("reviews original chunks independently and refuses omitted features without retrying semantic rejection", async () => {
  const chunks = [
    {
      id: "src/favorites.ts:1",
      path: "src/favorites.ts",
      startLine: 1,
      endLine: 1,
      content: "export function toggleFavorite(id) { favorites.toggle(id); }",
    },
  ];
  const invoke = vi.fn(async (prompt: string) => {
    expect(prompt).toContain(chunks[0].content);
    expect(JSON.parse(prompt.split("COVERAGE_INPUT\n").at(-1)!).files).toEqual(
      files,
    );
    return JSON.stringify({
      reviewedChunks: [chunks[0].id],
      blockingIssues: [
        "Favorites are implemented but absent from the candidate specifications.",
      ],
    });
  });
  await expect(
    reviewSourceCoverage({
      files,
      batches: [chunks],
      signal: new AbortController().signal,
      invoke,
      progress: () => {},
    }),
  ).rejects.toThrow(/Favorites/);
  expect(invoke).toHaveBeenCalledTimes(1);
  const missing = vi.fn(async () =>
    JSON.stringify({ reviewedChunks: [], blockingIssues: [] }),
  );
  await expect(
    reviewSourceCoverage({
      files,
      batches: [chunks],
      signal: new AbortController().signal,
      invoke: missing,
      progress: () => {},
    }),
  ).rejects.toThrow(/every supplied chunk/);
  expect(missing).toHaveBeenCalledTimes(3);
});

it("reviews all oversized evidence in bounded batches and preserves gaps and scenario mapping", async () => {
  const large = Array.from({ length: 50 }, (_, id) => ({
    text: `Evidence ${id}: ` + "behavior ".repeat(1000),
    sources: [{ path: `src/${id}.ts`, startLine: 1, endLine: 1 }],
  }));
  const seen: string[] = [];
  let batches = 0;
  const result = await reviewSetup({
    files,
    evidence: large,
    coverage: "deep",
    signal: new AbortController().signal,
    progress: () => {},
    invoke: async (prompt) => {
      const input = JSON.parse(prompt.split("REVIEW_INPUT\n").at(-1)!);
      expect(JSON.stringify(input).length).toBeLessThan(350000);
      seen.push(...input.evidence.map((e: any) => e.sources[0].path));
      const review = qualityFixture(prompt);
      review.areas.architecture.gaps.push(`Unique gap from batch ${++batches}`);
      review.checks[0].fixture += ` Additional concrete fixture ID ${batches}.`;
      return JSON.stringify(review);
    },
  });
  expect(batches).toBeGreaterThan(1);
  expect(seen).toEqual(large.map((e) => e.sources[0].path));
  expect(result.checks[0].fixture).toContain(
    `Additional concrete fixture ID ${batches}.`,
  );
  expect(result.areas.architecture.gaps).toContain(
    `Unique gap from batch ${batches}`,
  );
  expect(result.checks.map((c) => c.scenarioId)).toEqual(
    cases.map((c) => c.id),
  );
});

it("rejects a generation blocker in a later evidence batch", async () => {
  let calls = 0;
  await expect(
    reviewSetup({
      files,
      evidence: Array.from({ length: 50 }, (_, id) => ({
        text: "source ".repeat(1500),
        sources: [{ path: `${id}.ts`, startLine: 1, endLine: 1 }],
      })),
      coverage: "deep",
      signal: new AbortController().signal,
      progress: () => {},
      invoke: async (prompt) => {
        const result = qualityFixture(prompt);
        if (++calls > 1)
          result.blockingIssues = [
            "The generated specification omits supported order cancellation.",
          ];
        return JSON.stringify(result);
      },
    }),
  ).rejects.toThrow(/blocking generation defects/);
  expect(calls).toBe(2);
});
