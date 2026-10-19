import { mkdir, mkdtemp, rm, open } from "node:fs/promises";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { stripVTControlCharacters } from "node:util";
import type {
  EngineAdapter,
  EngineKind,
  Proposal,
  SetupProfile,
} from "../shared/types.js";
import { setupProfileSchema } from "../shared/types.js";
import { Projects } from "./projects.js";
import { Store } from "./store.js";
import { SpecRepository } from "./specs.js";
import { adapters } from "./engines.js";
import { analyzeSetup } from "./setup-analysis.js";
import { defaultSkills, projectSkills } from "./skills.js";
import { inventoryProject } from "./project-inventory.js";
import {
  assert,
  errorText,
  hash,
  id,
  now,
  readOptional,
  redact,
  safePath,
} from "./util.js";

export interface SetupOptions {
  path: string;
  name?: string;
  engine?: EngineKind;
  model?: string;
  reasoning?: string;
  guidanceOnly?: boolean;
  repair?: boolean;
  deep?: boolean;
  rebuild?: boolean;
}
export interface TerminalIO {
  write(text: string): void;
  ask(question: string): Promise<string>;
  login?(engine: EngineKind): Promise<number>;
}
export const terminalText = (text: string) =>
  stripVTControlCharacters(text).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");

export async function selectSetupProfile(
  options: SetupOptions,
  engine: EngineKind,
  saved: SetupProfile | undefined,
  provider: EngineAdapter,
  scratch: string,
  io: TerminalIO,
): Promise<SetupProfile> {
  const models = await provider.setupModels?.(engine, scratch);
  assert(
    models !== undefined,
    `The ${engine} adapter cannot verify setup model controls. Update Clinic.`,
  );
  let model =
    options.model ?? (saved?.engine === engine ? saved.model : undefined);
  const recommended = engine === "codex" ? "gpt-6.1-sol" : undefined;
  if (models) {
    io.write(
      "Available setup models:\n" +
        models
          .map((m) => `  ${m.model}: ${m.name} (${m.efforts.join(", ")})`)
          .join("\n") +
        "\n",
    );
    if (!model && models.some((m) => m.model === recommended))
      model = recommended;
    if (!options.model)
      model =
        (
          await io.ask(
            `Setup model${model ? ` [${model}]` : " (enter an available ID)"}: `,
          )
        ).trim() || model;
    assert(
      models.some((m) => m.model === model),
      "Selected model is unavailable. Rerun setup and choose a listed model; no fallback was used.",
    );
  } else {
    io.write(
      "This provider cannot enumerate account model access. Enter a supported model ID; provider rejection will stop setup without fallback.\n",
    );
    if (!options.model)
      model =
        (await io.ask(`Setup model${model ? ` [${model}]` : ""}: `)).trim() ||
        model;
  }
  assert(model, "Choose a setup model before analysis.");
  let reasoning =
    options.reasoning ??
    (saved?.engine === engine && saved.reasoning === "low" ? "low" : "medium");
  if (!options.reasoning)
    reasoning =
      (await io.ask(`Setup reasoning [${reasoning}]: `)).trim() || reasoning;
  const profile = setupProfileSchema.parse({ engine, model, reasoning });
  if (models)
    assert(
      models
        .find((m) => m.model === model)
        ?.efforts.includes(profile.reasoning),
      "This model does not support the selected reasoning effort.",
    );
  io.write(
    `Setup uses ${engine} / ${model} / ${profile.reasoning} reasoning for every analysis stage.\n`,
  );
  const consent = (
    await io.ask(
      options.deep || options.rebuild
        ? "Analyze all eligible project text with this provider? [y/N]: "
        : "Generate initial specifications from selected project context? [y/N]: ",
    )
  )
    .trim()
    .toLowerCase();
  assert(
    consent === "y" || consent === "yes",
    "Analysis not started. No setup files were applied.",
  );
  return profile;
}

export async function addSetupProfile(
  project: Awaited<ReturnType<Projects["add"]>>,
  specs: SpecRepository,
  proposal: Proposal,
  profile: SetupProfile,
  configBefore: string | null,
) {
  const path = ".clinic/project.yaml";
  const existing = proposal.files.find((f) => f.path === path);
  const document = parseDocument(existing?.after ?? configBefore ?? "");
  assert(!document.errors.length, "Project configuration is not valid YAML.");
  document.set("setup", profile);
  const after = document.toString();
  const edited = await specs.propose(
    project,
    proposal.title,
    [
      ...proposal.files
        .filter((f) => f.path !== path)
        .map((f) => ({
          path: f.path,
          after: f.after,
          beforeHash: f.beforeHash,
        })),
      {
        path,
        after,
        beforeHash: configBefore === null ? null : hash(configBefore),
      },
    ],
    proposal.source,
    undefined,
    proposal.contextBases,
  );
  const result = { ...edited, inventoryHash: proposal.inventoryHash };
  specs.store.put("proposal", result);
  specs.store.put("proposal", { ...proposal, status: "rejected" });
  return result;
}

export async function terminalSetup(
  options: SetupOptions,
  dependencies: {
    dataDir: string;
    io: TerminalIO;
    signal: AbortSignal;
    providers?: Record<EngineKind, EngineAdapter>;
  },
) {
  assert(
    !options.guidanceOnly ||
      (!options.model &&
        !options.reasoning &&
        !options.deep &&
        !options.rebuild),
    "--guidance-only cannot use --model, --reasoning or --deep/--rebuild.",
  );
  assert(
    !options.repair ||
      (!options.guidanceOnly &&
        !options.model &&
        !options.reasoning &&
        !options.deep &&
        !options.rebuild),
    "--repair cannot be combined with analysis/model options.",
  );
  const { dataDir, signal } = dependencies;
  const io: TerminalIO = {
    ...dependencies.io,
    write: (text) => dependencies.io.write(terminalText(text)),
    ask: (text) => dependencies.io.ask(terminalText(text)),
  };
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const lockPath = join(dataDir, "setup.lock");
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch {
    throw new Error(
      `Another setup may be active. If an earlier process crashed, remove ${lockPath} inside the terminal runtime and retry.`,
    );
  }
  let store: Store | undefined;
  let scratch: string | undefined;
  const runId = id();
  const check = () =>
    assert(!signal.aborted, "Setup canceled. No proposal was applied.");
  try {
    store = new Store(join(dataDir, "clinic.sqlite"));
    const projects = new Projects(store),
      specs = new SpecRepository(store);
    // Read directly before registration so an existing project's engine wins by default.
    const raw = await readOptional(
      await safePath(options.path, ".clinic/project.yaml"),
    );
    const doc = parseDocument(raw ?? "");
    assert(!doc.errors.length, "Project configuration is not valid YAML.");
    let engine =
      options.engine ??
      (doc.getIn(["setup", "engine"]) as EngineKind | undefined) ??
      (doc.get("engine") as EngineKind | undefined);
    if (!engine && options.repair) engine = "codex";
    if (!engine)
      engine = ((await io.ask("Provider [codex] (codex/claude): ")).trim() ||
        "codex") as EngineKind;
    assert(
      engine === "codex" || engine === "claude",
      "Choose codex or claude.",
    );
    const project = await projects.add(options.path, engine, options.name);
    const config = await projects.config(project);
    store.put("terminal-setup", {
      id: runId,
      projectId: project.id,
      status: "running",
      startedAt: now(),
    });
    io.write(
      `Setup mode: ${options.repair ? "repair missing SDD documents (no model analysis)" : options.guidanceOnly ? "guidance only (no specifications)" : options.rebuild ? "reconstruction blueprint (all eligible source)" : options.deep ? "deep source audit" : "initial specifications from selected project context"}.\n`,
    );
    io.write(
      `Project: ${options.path}\nInventorying existing specifications, agents, skills, source and documentation.\n`,
    );
    const inventory = options.repair
      ? { files: [], excluded: [], fingerprint: "" }
      : await inventoryProject(project, signal);
    const assets = inventory.files.filter((f) =>
      /^(openspec\/|\.clinic\/|\.agents\/|\.claude\/|\.cursor\/|\.github\/copilot-instructions|AGENTS\.md$|CLAUDE\.md$|GEMINI\.md$)/.test(
        f.path,
      ),
    );
    io.write(
      `${inventory.files.length} eligible files; ${inventory.excluded.length} exclusions.\nExisting SDD and agent files:\n${assets.map((f) => `  ${f.path}`).join("\n") || "  None"}\n`,
    );
    for (const excluded of inventory.excluded)
      io.write(`Excluded ${excluded.path}: ${excluded.reason}\n`);
    let proposal: Proposal;
    let profile: SetupProfile | undefined;
    if (options.guidanceOnly || options.repair) {
      io.write(
        options.repair
          ? "Repair reads existing specifications; no provider or source analysis is used.\n"
          : "Guidance-only setup: semantic code analysis was not performed; no model is used.\n",
      );
      const setup = await projects.setupFiles(project, !!options.repair);
      if (options.repair) {
        assert(
          setup.specCount > 0,
          "No capability specifications exist. Run initial sddclinic setup for a source project, or use the GUI project brief flow for a new product. Repair cannot infer product specifications. No files were applied.",
        );
        io.write(
          `Preserved ${setup.specCount} existing specs and ${setup.preserved.length} existing validation plans. Missing documents will be reviewed below.\n`,
        );
      }
      if (!setup.files.length) {
        io.write("No setup changes are needed.\n");
        store.put("terminal-setup", {
          id: runId,
          projectId: project.id,
          status: "unchanged",
          endedAt: now(),
        });
        return "unchanged" as const;
      }
      proposal = await specs.propose(
        project,
        "Review project guidance and skills",
        setup.files,
        "setup",
        undefined,
        setup.bases,
      );
    } else {
      const provider = (dependencies.providers ?? adapters)[engine];
      let probe = await provider.probe(engine);
      assert(
        probe.installed && probe.compatible,
        `${engine} is missing or incompatible in the Docker runtime. Rebuild/update Clinic.`,
      );
      if (!probe.authenticated) {
        io.write(
          `Sign in to ${engine} inside this terminal runtime; host and browser sign-in are separate.\n`,
        );
        if (io.login) {
          io.write(
            "Opening your browser to sign in. Complete sign-in there; setup will continue here.\n",
          );
          assert(
            (await io.login(engine)) === 0,
            "Provider sign-in did not complete. Retry setup.",
          );
          probe = await provider.probe(engine);
        }
        assert(
          probe.authenticated,
          "Provider authentication is required. Rerun setup to sign in, or explicitly use --guidance-only.",
        );
      }
      scratch = await mkdtemp(join(dataDir, "analysis-"));
      profile = await selectSetupProfile(
        options,
        engine,
        config.setup,
        provider,
        scratch,
        io,
      );
      store.append(runId, "setup-model", {
        ...profile,
        source:
          options.model || options.reasoning
            ? "flags and terminal selection"
            : "terminal selection",
      });
      const skills = await projectSkills(project);
      proposal = await analyzeSetup({
        project,
        projects,
        specs,
        signal,
        mode: options.rebuild ? "rebuild" : options.deep ? "deep" : "initial",
        invoke: async (skillName, prompt) => {
          check();
          const skill =
            skills.find((s) => s.name === skillName) ??
            defaultSkills.find((s) => s.name === skillName)!;
          store!.append(runId, "skill", {
            name: skillName,
            revision: hash(skill.content),
          });
          const started = Date.now();
          const stage = prompt.includes("CLINIC_RECONSTRUCTION_SYNTHESIZE")
            ? "Generating reconstruction blueprint"
            : prompt.includes("CLINIC_BASELINE_SYNTHESIZE")
              ? "Generating capability specifications"
              : prompt.includes("CLINIC_BASELINE_CONSOLIDATE")
                ? "Consolidating analysis findings"
                : "Analyzing source evidence";
          const heartbeat = setInterval(
            () =>
              io.write(
                `${stage}: waiting for ${profile!.model} (${Math.floor((Date.now() - started) / 1000)}s elapsed). Specifications will be saved after review.\n`,
              ),
            10_000,
          );
          try {
            const result = await provider.run(engine!, {
              cwd: scratch!,
              prompt: `${skill.content}\n\n${prompt}`,
              model: profile!.model,
              reasoning: profile!.reasoning,
              instructions:
                "Analyze only supplied redacted evidence. No tools, filesystem access, commands, or edits. Return requested JSON for review.",
              tools: [],
              mode: "read-only",
              timeoutMs: 15 * 60_000,
              maxTurns: 30,
              signal,
              onEvent: (type, data) => store!.append(runId, type, redact(data)),
              onApproval: async () => ({ approved: false }),
            });
            check();
            return result.text;
          } finally {
            clearInterval(heartbeat);
          }
        },
        progress: (message, details) => {
          io.write(message + "\n");
          store!.append(runId, "setup-progress", { message, ...details });
        },
      });
      const specPaths = proposal.files
        .filter((f) => /^openspec\/specs\/[^/]+\/spec\.md$/.test(f.path))
        .map((f) => f.path);
      const existingSpecs = inventory.files.filter(
        (f) =>
          /^openspec\/specs\/[^/]+\/spec\.md$/.test(f.path) &&
          /^### Requirement:/m.test(f.content) &&
          /^#### Scenario:/m.test(f.content),
      );
      if (!specPaths.length && !existingSpecs.length) {
        const report =
          proposal.files.find(
            (f) => f.path === "openspec/project/baseline-analysis.md",
          )?.after ?? "";
        store.put("proposal", { ...proposal, status: "rejected" });
        throw new Error(
          `No capability specifications were generated, so SDD baseline setup is incomplete. No setup files were applied. Add product requirements/source evidence and rerun full setup, or use the GUI's project brief flow. --guidance-only installs instructions without specs.\n${report.split("## Existing intent")[1] ?? report.slice(0, 1500)}`,
        );
      }
      io.write(
        `\nSpecification baseline: ${specPaths.length} new capability specs; ${existingSpecs.length} existing specs preserved.\n${specPaths.map((p) => `  ${p}`).join("\n")}\n`,
      );
      proposal = await addSetupProfile(project, specs, proposal, profile, raw);
    }
    check();
    io.write(
      `\n${proposal.title}\n${proposal.files.length} proposed file changes. Review the complete diff below.\n`,
    );
    const reviewFiles = [...proposal.files].sort(
      (a, b) =>
        Number(b.path.startsWith("openspec/specs/")) -
        Number(a.path.startsWith("openspec/specs/")),
    );
    for (const file of reviewFiles) io.write(`\n${file.diff}\n`);
    store.put("terminal-setup", {
      id: runId,
      projectId: project.id,
      status: "review",
      proposalId: proposal.id,
      profile,
    });
    check();
    if (
      !/^(y|yes)$/i.test(
        (await io.ask("Apply these setup changes? [y/N]: ")).trim(),
      )
    ) {
      store.put("proposal", { ...proposal, status: "rejected" });
      store.put("terminal-setup", {
        id: runId,
        projectId: project.id,
        status: "declined",
        endedAt: now(),
      });
      io.write("Setup not applied. Project files are unchanged.\n");
      return "declined" as const;
    }
    check();
    if (!options.repair)
      assert(
        (await inventoryProject(project, signal)).fingerprint ===
          inventory.fingerprint,
        "Project sources changed. Nothing was applied; rerun setup to reanalyze.",
      );
    // Application is an atomic reviewed unit: finish or roll back, never abort between replacements.
    await specs.apply(project, proposal.id);
    store.put("terminal-setup", {
      id: runId,
      projectId: project.id,
      status: "applied",
      proposalId: proposal.id,
      profile,
      endedAt: now(),
    });
    io.write(
      "\nSDD setup applied:\n" +
        proposal.files.map((f) => `  ${f.path}`).join("\n") +
        "\nReview and commit these files using your Git workflow. Product code was not implemented.\n",
    );
    return "applied" as const;
  } catch (error) {
    store?.put("terminal-setup", {
      id: runId,
      status: signal.aborted ? "canceled" : "failed",
      error: errorText(error),
      endedAt: now(),
    });
    throw error;
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true });
    store?.close();
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
