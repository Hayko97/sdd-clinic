#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const args = process.argv.slice(2);
const send = (value) => process.stdout.write(JSON.stringify(value) + "\n");
if (args.includes("--version")) {
  console.log("codex-cli 0.162.0 fixture");
  process.exit(0);
}
if (args.includes("--help")) {
  console.log(
    "app-server --listen stdio:// --output-format stream-json --effort low medium high xhigh max",
  );
  process.exit(0);
}
const authFixture = path.basename(__filename).startsWith("auth-");
const authFile = path.join(__dirname, "fixture-signed-in");
if (args[0] === "login") {
  const loggedIn = !authFixture || fs.existsSync(authFile);
  console.log(loggedIn ? "Logged in using fixture" : "Not logged in");
  process.exit(loggedIn ? 0 : 1);
}
if (args[0] === "auth") {
  console.log(JSON.stringify({ loggedIn: true }));
  process.exit(0);
}
const walk = (root) =>
  fs.existsSync(root)
    ? fs
        .readdirSync(root, { withFileTypes: true })
        .flatMap((entry) =>
          entry.isDirectory()
            ? walk(path.join(root, entry.name))
            : [path.join(root, entry.name)],
        )
    : [];
function response(prompt) {
  if (prompt.includes("CLINIC_SETUP_QUALITY"))
    return JSON.stringify(require("./setup-quality.cjs")(prompt));
  if (prompt.includes("IMAGE_PROTOCOL")) return "Image content received";
  if (prompt.includes("CLINIC_PRODUCT_SOURCES")) {
    const chunks = JSON.parse(prompt.split("SOURCES\n").at(-1));
    return JSON.stringify({
      reviewed: chunks.map((c) => c.id),
      findings: chunks.map((c) => c.content).join("\n"),
    });
  }
  if (prompt.includes("CLINIC_PRODUCT_IMAGE"))
    return "Visual source uses a green action button. Treat this as a visual interpretation.";
  if (prompt.includes("CLINIC_PRODUCT_SYNTHESIZE")) {
    const answers = prompt
      .split("Clarification answers: ")[1]
      .split("\nFindings")[0];
    if (answers === "[]")
      return JSON.stringify({
        summary: "Choose guest access",
        questions: ["May guests browse products without signing in?"],
        files: [],
      });
    const sources = JSON.parse(
      prompt.split("Allowed source IDs: ")[1].split("\n")[0],
    );
    return JSON.stringify({
      summary: "Catalog intended behavior",
      questions: [],
      files: [
        {
          path: "openspec/specs/catalog/spec.md",
          sourceIds: [sources[0]],
          content:
            "# Catalog Specification\n\n## Purpose\nHelp visitors discover products available to order.\n\n## Requirements\n\n### Requirement: Browse products\nThe system SHALL let guests browse available products.\n\n#### Scenario: Guest browsing\n- **WHEN** a guest opens the catalog\n- **THEN** available products are displayed.\n",
        },
        ...["mission", "tech-stack", "roadmap", "ui-ux"].map((name) => ({
          path: `openspec/project/${name}.md`,
          sourceIds: [],
          content: `# ${name}\nUse accessible green actions. Guests may browse the catalog. Technology choices remain open.\n`,
        })),
      ],
    });
  }
  if (prompt.includes("CLINIC_BASELINE_ANALYZE")) {
    const chunks = JSON.parse(prompt.split("SOURCE_CHUNKS\n").at(-1));
    return JSON.stringify({
      reviewedChunks: chunks.map((c) => c.id),
      notes: chunks
        .filter((c) => c.path.endsWith("catalog.ts"))
        .map((c) => ({
          text: "The catalog lists only active products. An empty catalog returns an empty list.",
          sources: [
            { path: c.path, startLine: c.startLine, endLine: c.endLine },
          ],
        })),
      questions: [],
    });
  }
  if (prompt.includes("CLINIC_BASELINE_SYNTHESIZE")) {
    const notes = JSON.parse(prompt.split("FINDINGS\n").at(-1));
    const existing = JSON.parse(
      prompt.split("EXISTING_SPEC_PATHS\n").at(-1).split("\nFINDINGS")[0],
    );
    const sources = notes.flatMap((n) => n.sources);
    return JSON.stringify({
      summary: sources.length
        ? "Catalog behavior inferred from existing source and documentation."
        : "No additional capabilities identified in this fixture.",
      capabilities:
        sources.length && !existing.includes("openspec/specs/catalog/spec.md")
          ? [
              {
                name: "catalog",
                purpose:
                  "Allow users to discover the active products available in the catalog.",
                requirements: [
                  {
                    name: "Active product listing",
                    statement:
                      "The catalog SHALL list active products and return an empty list when none are available.",
                    basis: "inferred",
                    sources,
                    scenarios: [
                      {
                        name: "List active products",
                        when: "products include active and inactive entries",
                        then: "only active products are listed",
                      },
                      {
                        name: "Empty catalog",
                        when: "no active products exist",
                        then: "the returned list is empty",
                      },
                    ],
                  },
                ],
              },
            ]
          : [],
      reused: existing
        .filter((p) => p.endsWith("/spec.md"))
        .map((path) => ({
          path,
          reason: "Preserve existing specified intent.",
        })),
      questions: sources.length
        ? [
            "Confirm that the current filtering rule is intended product behavior.",
          ]
        : [],
    });
  }
  if (prompt.includes("Analyze the user's intent"))
    return JSON.stringify({
      summary: "Correct the existing addition behavior.",
      action: "refine",
      change: "fix-addition",
      questions: [],
    });
  if (prompt.includes("Propose an OpenSpec change, without writing files"))
    return JSON.stringify({
      summary: "Clarify the existing addition proposal.",
      files: [
        {
          path: "openspec/changes/fix-addition/proposal.md",
          content:
            fs.readFileSync(
              "openspec/changes/fix-addition/proposal.md",
              "utf8",
            ) + "\nThe Developer prompt requests correct addition.\n",
        },
      ],
    });
  if (prompt.includes("Implement the approved OpenSpec change")) {
    if (fs.existsSync("math.ts"))
      fs.writeFileSync(
        "math.ts",
        "export function add(a: number, b: number) { return a + b; }\n",
      );
    if (fs.existsSync("app.py"))
      fs.writeFileSync("app.py", "def add(a, b):\n    return a + b\n");
    for (const file of walk("openspec/changes").filter((p) =>
      p.endsWith("tasks.md"),
    ))
      fs.writeFileSync(
        file,
        fs.readFileSync(file, "utf8").replaceAll("[ ]", "[x]"),
      );
    return JSON.stringify({
      summary: "Implemented addition and verified the fixture tests.",
      questions: [],
    });
  }
  if (prompt.includes("Independently verify this implementation"))
    return JSON.stringify({
      summary:
        "Addition was verified against source and the configured executable check.",
      criteria: [
        {
          scenario: "Adding numbers",
          status: "passed",
          evidence:
            "The configured addition check passed and source adds both inputs.",
        },
      ],
    });
  if (prompt.includes('Return JSON {"findings"'))
    return JSON.stringify({ findings: [] });
  if (prompt.includes('Return JSON {"metrics"'))
    return JSON.stringify({ metrics: [] });
  if (prompt.includes("You are editing an OpenSpec change")) {
    const name = prompt.match(/inside openspec\/changes\/([^/]+)\//)[1];
    return JSON.stringify({
      summary:
        "Added a measurable acceptance scenario for the proposed change.",
      files: [
        {
          path: `openspec/changes/${name}/proposal.md`,
          content:
            "# Better onboarding\n\n## Why\nHelp developers start with a clear project specification.\n\n## What Changes\n- Guide project setup.\n\n## Capabilities\n### New Capabilities\n- `onboarding`: guided setup.\n### Modified Capabilities\nNone.\n\n## Impact\nProject onboarding.\n",
        },
        {
          path: `openspec/changes/${name}/specs/onboarding/spec.md`,
          content:
            "## Purpose\nHelp developers review and apply a consistent project setup.\n\n## ADDED Requirements\n\n### Requirement: Guided setup\nThe app SHALL guide the user through setup.\n\n#### Scenario: Starting a project\n- **WHEN** a project is added\n- **THEN** the user can review setup changes.\n",
        },
      ],
    });
  }
  return "SDD Clinic connection ready.";
}
if (args.includes("-p")) {
  let input = "";
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    if (args.includes("--input-format")) {
      const message = JSON.parse(input);
      const image = message.message.content.find((c) => c.type === "image");
      if (
        !image ||
        image.source.type !== "base64" ||
        !image.source.media_type.startsWith("image/") ||
        !Buffer.from(image.source.data, "base64").length
      )
        throw new Error("Invalid image input");
      input = message.message.content[0].text;
    }

    if (input.includes("MALFORMED")) {
      console.log("invalid JSON");
      return;
    }
    if (/\bHANG\b/.test(input)) return setInterval(() => {}, 1000);
    send({
      type: "system",
      subtype: "init",
      session_id: "claude-fixture-session",
    });
    const text = input.includes("EFFORT_PROTOCOL")
      ? JSON.stringify({
          model: args[args.indexOf("--model") + 1],
          effort: args[args.indexOf("--effort") + 1],
        })
      : response(input);
    send({
      type: "stream_event",
      event: { delta: { type: "text_delta", text } },
    });
    send({
      type: "result",
      subtype: "success",
      result: text,
      session_id: "claude-fixture-session",
      is_error: false,
    });
  });
} else {
  let prompt = "";
  let selectedModel, selectedEffort;
  const finish = () => {
    const text = prompt.includes("EFFORT_PROTOCOL")
      ? JSON.stringify({ model: selectedModel, effort: selectedEffort })
      : response(prompt);
    send({ method: "item/agentMessage/delta", params: { delta: text } });
    send({
      method: "item/completed",
      params: { item: { type: "agentMessage", text } },
    });
    send({
      method: "turn/completed",
      params: { turn: { id: "turn-fixture", status: "completed" } },
    });
  };
  readline.createInterface({ input: process.stdin }).on("line", (line) => {
    const message = JSON.parse(line);
    if (message.method === "account/login/start") {
      const modeFile = path.join(__dirname, "fixture-auth-mode");
      const mode = fs.existsSync(modeFile)
        ? fs.readFileSync(modeFile, "utf8").trim()
        : "success";
      if (mode === "error")
        return send({
          id: message.id,
          error: { message: "Device login disabled by workspace policy." },
        });
      send({
        id: message.id,
        result: {
          type: "chatgptDeviceCode",
          loginId: "fixture-login",
          verificationUrl: "https://auth.openai.com/codex/device",
          userCode: "TEST-1234",
        },
      });
      if (mode !== "hang")
        setTimeout(() => {
          if (mode !== "failed")
            fs.writeFileSync(authFile, "fixture only", { mode: 0o600 });
          send({
            method: "account/login/completed",
            params: {
              loginId: "fixture-login",
              success: mode !== "failed",
              error: mode === "failed" ? "Authorization was denied." : null,
            },
          });
        }, 700);
      return;
    }
    if (message.method === "account/login/cancel")
      return send({ id: message.id, result: { status: "canceled" } });
    if (message.method === "initialize")
      send({ id: message.id, result: { userAgent: "fixture" } });
    if (message.method === "model/list")
      send({
        id: message.id,
        result: {
          data: [
            {
              model: "gpt-6.1-sol",
              displayName: "Sol",
              supportedReasoningEfforts: [
                { reasoningEffort: "medium" },
                { reasoningEffort: "high" },
              ],
            },
          ],
          nextCursor: null,
        },
      });
    if (message.method === "thread/start" || message.method === "thread/resume")
      selectedModel = message.params.model;
    if (message.method === "thread/start" || message.method === "thread/resume")
      send({
        id: message.id,
        result: { thread: { id: "codex-fixture-session" } },
      });
    if (message.method === "turn/start") {
      prompt = message.params.input[0].text;
      selectedEffort = message.params.effort;
      if (
        prompt.includes("IMAGE_PROTOCOL") ||
        prompt.includes("CLINIC_PRODUCT_IMAGE")
      ) {
        const image = message.params.input[1];
        if (image?.type !== "localImage" || !fs.existsSync(image.path))
          throw new Error("Invalid local image input");
      }
      send({ id: message.id, result: { turn: { id: "turn-fixture" } } });
      if (prompt.includes("MALFORMED")) return console.log("invalid JSON");
      if (/\bHANG\b/.test(prompt)) return;
      if (prompt.includes("ASK_QUESTION"))
        return send({
          id: 900,
          method: "item/tool/requestUserInput",
          params: {
            questions: [
              { id: "scope", question: "Which behavior should change?" },
            ],
          },
        });
      if (prompt.includes("ASK_APPROVAL"))
        return send({
          id: 900,
          method: "item/commandExecution/requestApproval",
          params: { command: "fixture check" },
        });
      setTimeout(finish, 10);
    }
    if (message.id === 900 && message.result) finish();
  });
}
