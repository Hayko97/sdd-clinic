import { readdir } from "node:fs/promises";
import { assert, hash, readOptional, safePath } from "./util.js";

type Document = { path: string; after: string; beforeHash?: string | null };

export function validationFromSpec(path: string, content: string): string {
  // Fenced examples are not normative requirements or scenarios.
  const text = content.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, "");
  const requirements = text.split(/^### Requirement:\s*/m).slice(1);
  assert(
    requirements.length,
    `${path}: no native requirements; repair the specification first.`,
  );
  const checks: string[] = [];
  for (const requirement of requirements) {
    const [heading, ...rest] = requirement.split("\n");
    const body = rest.join("\n");
    const scenarios = body.split(/^#### Scenario:\s*/m).slice(1);
    assert(
      scenarios.length,
      `${path}: requirement ${heading} has no scenarios.`,
    );
    for (const scenario of scenarios) {
      const [name, ...lines] = scenario.split("\n");
      const behavior = lines.join("\n").trim();
      assert(
        /\bWHEN\b/.test(behavior) && /\bTHEN\b/.test(behavior),
        `${path}: scenario ${name} needs WHEN and THEN conditions.`,
      );
      checks.push(
        `## Check ${checks.length + 1}: ${name.trim()}\n\nRequirement: ${heading.trim()}\n\nRequired behavior: ${body.split(/^#### Scenario:/m)[0]!.trim()}\n\nScenario: ${name.trim()}\n\n${behavior}\n\n### Validation procedure\n1. Arrange the stated preconditions and perform the WHEN action.\n2. Compare the observed behavior with every THEN/AND expectation above.\n3. Record inputs, actual outputs, test command or manual steps, environment, application revision and logs/screenshots.\n\n- Status: UNVERIFIED\n- Execution command or manual steps: Not recorded\n- Environment and application revision: Not recorded\n- Actual result and evidence location: Not recorded\n`,
      );
    }
  }
  return `# Validation plan\n\nSpecification: [spec.md](./spec.md)\n\nStatus: UNVERIFIED. Setup has not executed application tests or implemented product code. These checks are derived from the specification, not proof of tested behavior or reconstruction equivalence. Review missing behavior and adapt the procedure to the application's interfaces.\n\n${checks.join("\n")}`;
}

export async function completeSetupDocuments(
  root: string,
  proposed: Document[],
) {
  const files = [...proposed];
  const bases: { path: string; hash: string }[] = [];
  const specs = new Map<string, string>();
  const directory = await safePath(root, "openspec/specs");
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    entries = [];
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9-]{0,70}$/.test(entry.name))
      continue;
    const path = `openspec/specs/${entry.name}/spec.md`;
    const content = await readOptional(await safePath(root, path));
    if (content !== null) {
      specs.set(path, content);
      bases.push({ path, hash: hash(content) });
    }
  }
  for (const file of proposed)
    if (/^openspec\/specs\/[^/]+\/spec\.md$/.test(file.path))
      specs.set(file.path, file.after);
  const preserved: string[] = [];
  for (const [path, content] of specs) {
    const companion = path.replace(/spec\.md$/, "validation.md");
    const existing = await readOptional(await safePath(root, companion));
    if (existing !== null) {
      preserved.push(companion);
      bases.push({ path: companion, hash: hash(existing) });
      continue;
    }
    if (!files.some((f) => f.path === companion))
      files.push({
        path: companion,
        beforeHash: null,
        after: validationFromSpec(path, content),
      });
  }
  const changelogs = (await readdir(root)).filter(
    (n) => n.toLowerCase() === "changelog.md",
  );
  if (
    !changelogs.length &&
    !files.some((f) => f.path.toLowerCase() === "changelog.md")
  )
    files.push({
      path: "CHANGELOG.md",
      beforeHash: null,
      after:
        "# Changelog\n\n## Unreleased\n\n### Added\n- Initialized missing specification-driven development documentation and workflow guidance. This records documentation setup only; no product implementation or test results are claimed.\n",
    });
  return { files, bases, preserved, specCount: specs.size };
}
