import { completeSetupDocuments } from "./setup-documents.js";
import { defaultSkills } from "./skills.js";
import {
  agentInstructionContent,
  agentInstructionPaths,
} from "./agent-instructions.js";
import {
  clinicSchema,
  projectDocuments,
  schemaFiles,
} from "./documentation.js";
import { readdir, realpath, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse, stringify } from "yaml";
import {
  agentSchema,
  projectConfigSchema,
  type AgentDefinition,
  type Project,
  type ProjectConfig,
} from "../shared/types.js";
import { Store } from "./store.js";
import {
  assert,
  hash,
  atomicWrite,
  command,
  id,
  now,
  readOptional,
  redact,
  safePath,
} from "./util.js";

export const defaultAgents: AgentDefinition[] = [
  {
    id: "developer",
    name: "Developer",
    role: "developer",
    engine: "project",
    model: "",
    instructions:
      "Use analyze-request to understand the prompt, create-spec or refine-spec for required specification changes, and implement-spec for the validated approved revision. Respect the current pipeline stage: planning returns proposals only; implementation changes code in its assigned workspace. Write useful tests, run configured checks, and keep task checklists accurate. Do not merge, push, deploy, access production credentials, or change the approved requirements. Report limitations explicitly.",
    tools: ["read", "edit", "command"],
    timeoutMinutes: 30,
    maxTurns: 40,
    trigger: "manual",
  },
  {
    id: "qa",
    name: "QA",
    role: "qa",
    engine: "project",
    model: "",
    instructions:
      "Independently verify every approved acceptance scenario against the frozen implementation. Read test evidence and source. Do not edit application code. Distinguish failures from checks that cannot be verified. Return evidence for each result.",
    tools: ["read"],
    timeoutMinutes: 20,
    maxTurns: 30,
    trigger: "after-development",
  },
  {
    id: "po",
    name: "Product Owner",
    role: "po",
    engine: "project",
    model: "",
    instructions:
      "Analyze features, approved metric mappings, and timestamped database/server evidence. Use only Clinic broker tools for data access. Never request raw credentials. Require evidence for every finding, distinguish anomalies from confirmed bugs, and propose improvements or instrumentation when justified. Do not fabricate statistics or causality.",
    tools: ["read", "data"],
    timeoutMinutes: 15,
    maxTurns: 30,
    trigger: "manual",
  },
];

export class Projects {
  constructor(readonly store: Store) {}
  async add(path: string, engine: "codex" | "claude", name?: string) {
    const canonical = await realpath(path);
    assert(
      (await stat(canonical)).isDirectory(),
      "Choose a project directory.",
    );
    const existing = this.store
      .list<Project>("project")
      .find((p) => p.path === canonical);
    if (existing) return existing;
    const project: Project = {
      id: id(),
      path: canonical,
      name: name?.trim() || basename(canonical),
      engine,
      createdAt: now(),
    };
    return this.store.put("project", project);
  }
  get(projectId: string) {
    return this.store.require<Project>("project", projectId);
  }
  async config(project: Project): Promise<ProjectConfig> {
    const raw = await readOptional(
      await safePath(project.path, ".clinic/project.yaml"),
    );
    return projectConfigSchema.parse(
      raw ? parse(raw) : { name: project.name, engine: project.engine },
    );
  }
  async saveConfig(project: Project, input: unknown) {
    const config = projectConfigSchema.parse(input);
    await atomicWrite(
      await safePath(project.path, ".clinic/project.yaml"),
      stringify(config),
    );
    this.store.put("project", {
      ...project,
      name: config.name,
      engine: config.engine,
    });
    return config;
  }
  async agents(project: Project): Promise<AgentDefinition[]> {
    const directory = await safePath(project.path, ".clinic/agents");
    try {
      const files = await readdir(directory);
      const agents: AgentDefinition[] = [];
      for (const file of files.filter((f) => /\.ya?ml$/.test(f))) {
        const text = await readOptional(
          await safePath(project.path, `.clinic/agents/${file}`),
        );
        if (text) agents.push(agentSchema.parse(parse(text)));
      }
      return agents.length ? agents : defaultAgents;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return defaultAgents;
      throw e;
    }
  }
  async saveAgent(project: Project, input: unknown) {
    const agent = agentSchema.parse(input);
    await atomicWrite(
      await safePath(project.path, `.clinic/agents/${agent.id}.yaml`),
      stringify(agent),
    );
    return agent;
  }
  async inspect(project: Project, documentsOnly = false) {
    const files = await readdir(project.path, { withFileTypes: true });
    const names = files.map((f) => f.name);
    const schemaFiles: { path: string; content: string }[] = [];
    const testFiles: string[] = [];
    let inspectedEntries = 0;
    const inspectDirectory = async (directory: string, depth: number) => {
      if (depth > 4 || inspectedEntries >= 1500) return;
      const entries = directory
        ? await readdir(await safePath(project.path, directory), {
            withFileTypes: true,
          })
        : files;
      for (const entry of entries) {
        if (++inspectedEntries > 1500) break;
        if (
          entry.isSymbolicLink() ||
          entry.name.startsWith(".") ||
          [
            "node_modules",
            "dist",
            "build",
            "vendor",
            "venv",
            "__pycache__",
            "openspec",
          ].includes(entry.name)
        )
          continue;
        const path = directory ? `${directory}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await inspectDirectory(path, depth + 1);
        else if (entry.isFile()) {
          if (
            schemaFiles.length < 30 &&
            /\.sql$|schema\.prisma$|schema\.rb$|schema\.graphql$/i.test(
              entry.name,
            )
          ) {
            const content = await readOptional(
              await safePath(project.path, path),
            );
            if (content)
              schemaFiles.push({
                path,
                content: String(redact(content.slice(0, 8000))),
              });
          }
          if (
            testFiles.length < 50 &&
            /(^|\/)(tests?|specs?)\/|\.(test|spec)\.|(^|\/)test_[^/]+\.py$/.test(
              path,
            )
          )
            testFiles.push(path);
        }
      }
    };
    if (!documentsOnly) await inspectDirectory("", 0);
    const packageText = names.includes("package.json")
      ? await readOptional(await safePath(project.path, "package.json"))
      : null;
    let pkg: {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    } = {};
    try {
      pkg = JSON.parse(packageText ?? "{}");
    } catch {}
    const languages: string[] = [];
    const commands: ProjectConfig["commands"] = [];
    if (packageText) {
      languages.push(
        names.includes("tsconfig.json") ? "TypeScript" : "JavaScript",
      );
      const manager = names.includes("pnpm-lock.yaml")
        ? "pnpm"
        : names.includes("yarn.lock")
          ? "yarn"
          : "npm";
      if (
        names.some((n) =>
          ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"].includes(n),
        )
      )
        commands.push({
          name: "Install dependencies",
          command: manager,
          args: manager === "npm" ? ["ci"] : ["install", "--frozen-lockfile"],
          cwd: ".",
          phase: "setup",
        });
      for (const name of ["test", "typecheck", "lint", "build"])
        if (pkg.scripts?.[name])
          commands.push({
            name,
            command: manager,
            args: ["run", name],
            cwd: ".",
            phase: "check",
          });
    }
    if (
      names.some((n) =>
        ["pyproject.toml", "requirements.txt", "setup.py"].includes(n),
      )
    ) {
      languages.push("Python");
      commands.push({
        name: "tests",
        command: "python3",
        args: ["-m", "pytest"],
        cwd: ".",
        phase: "check",
      });
    }
    if (names.includes("Cargo.toml")) {
      languages.push("Rust");
      commands.push({
        name: "tests",
        command: "cargo",
        args: ["test"],
        cwd: ".",
        phase: "check",
      });
    }
    if (names.includes("go.mod")) {
      languages.push("Go");
      commands.push({
        name: "tests",
        command: "go",
        args: ["test", "./..."],
        cwd: ".",
        phase: "check",
      });
    }
    let targetBranch = "main",
      git = false,
      head: string | null = null;
    try {
      const root = await command("git", ["rev-parse", "--show-toplevel"], {
        cwd: project.path,
      });
      git =
        root.code === 0 &&
        (await realpath(root.stdout.trim())) === project.path;
      if (git) {
        const branch = await command(
          "git",
          ["symbolic-ref", "--short", "HEAD"],
          { cwd: project.path },
        );
        if (branch.code === 0) targetBranch = branch.stdout.trim();
        const rev = await command("git", ["rev-parse", "HEAD"], {
          cwd: project.path,
        });
        if (rev.code === 0) head = rev.stdout.trim();
      }
    } catch {}
    const docs: { path: string; content: string }[] = [];
    for (const name of [
      "README.md",
      ...agentInstructionPaths,
      "pyproject.toml",
      "package.json",
      "Cargo.toml",
      "go.mod",
      "requirements.txt",
      "Gemfile",
      "composer.json",
    ]) {
      const content = await readOptional(await safePath(project.path, name));
      if (content)
        docs.push({
          path: name,
          content: String(redact(content.slice(0, 10000))),
        });
    }
    return {
      languages,
      commands,
      targetBranch,
      git,
      head,
      existingOpenSpec: names.includes("openspec"),
      entries: names
        .filter((n) => !["node_modules", ".git", ".env"].includes(n))
        .slice(0, 100),
      dependencies: Object.keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
      }).slice(0, 60),
      docs,
      schemaFiles,
      testFiles,
      questions: commands.some((command) => command.phase === "check")
        ? []
        : [
            "No test commands were discovered. Configure commands before implementation.",
          ],
    };
  }
  async setupFiles(project: Project, documentsOnly = false) {
    const inspection = await this.inspect(project, documentsOnly);
    const additions: {
      path: string;
      after: string;
      beforeHash: string | null;
    }[] = [];
    const addMissing = async (path: string, after: string) => {
      if ((await readOptional(await safePath(project.path, path))) === null)
        additions.push({ path, after, beforeHash: null });
    };
    await addMissing(
      ".clinic/project.yaml",
      stringify({
        version: 1,
        name: project.name,
        engine: project.engine,
        context: `${project.name}. Detected stack: ${inspection.languages.join(", ") || "custom"}.\nRepository structure: ${inspection.entries.join(", ")}\nSchema references: ${inspection.schemaFiles.map((f) => f.path).join(", ") || "none found"}\nTest references: ${inspection.testFiles.join(", ") || "none found"}\nSetup questions: ${inspection.questions.join(" ") || "Confirm the proposed commands and project context."}\nReview inferred behavior before accepting baseline specs.`,
        commands: inspection.commands,
        targetBranch: inspection.targetBranch,
      }),
    );
    for (const agent of defaultAgents)
      await addMissing(`.clinic/agents/${agent.id}.yaml`, stringify(agent));
    await addMissing(
      "openspec/config.yaml",
      stringify({
        schema: clinicSchema,
        context: `${project.name}: use spec-driven development. Read .clinic/project.yaml and existing repository instructions. Describe externally observable behavior and testable scenarios.`,
      }),
    );
    for (const file of [
      ...projectDocuments(project.name, inspection),
      ...schemaFiles,
    ])
      await addMissing(file.path, file.after);
    for (const skill of defaultSkills) {
      const path = `.clinic/skills/${skill.name}/SKILL.md`;
      const existing = await readOptional(await safePath(project.path, path));
      if (
        existing === null ||
        existing === skill.previousContent ||
        existing === skill.priorDocumentationContent
      )
        additions.push({
          path,
          after: skill.content,
          beforeHash: existing === null ? null : hash(existing),
        });
      for (const directory of [".agents/skills", ".claude/skills"])
        await addMissing(
          `${directory}/${skill.name}/SKILL.md`,
          `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\nRead and follow .clinic/skills/${skill.name}/SKILL.md in this repository. That file is the authoritative project skill.\n`,
        );
    }
    for (const path of agentInstructionPaths) {
      const original = await readOptional(await safePath(project.path, path));
      const after = agentInstructionContent(path, original);
      if (after !== original)
        additions.push({
          path,
          after,
          beforeHash: original === null ? null : hash(original),
        });
    }
    return {
      inspection,
      ...(await completeSetupDocuments(project.path, additions)),
    };
  }
}
