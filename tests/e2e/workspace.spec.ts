import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
test("project grid opens one workspace with agents, specs, schedules and a Developer prompt", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const bootstrap = await (await request.get("/test/bootstrap")).json();
  await page.goto(`/#token=${bootstrap.token}`);
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await page.getByRole("button", { name: "Connect CLI", exact: true }).click();
  const claude = page.locator(".engine-card").filter({
    has: page.getByRole("heading", { name: "Claude CLI", exact: true }),
  });
  await claude
    .getByRole("button", { name: /Check connection|Check & connect/ })
    .click();
  await expect(
    claude.getByRole("button", { name: "Test conversation", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Back to projects", exact: false })
    .click();
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Project directory").fill(bootstrap.repo);
  await page.getByLabel("Project name").fill("Clinic acceptance project");
  await page.getByLabel("Default engine").selectOption("claude");
  await page.getByRole("button", { name: "Inspect & set up" }).click();
  const instructionPaths = [
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    ".github/copilot-instructions.md",
    ".cursor/rules/sdd-clinic.mdc",
  ];
  for (const path of instructionPaths) {
    await page
      .locator(".diff-layout nav button")
      .filter({ has: page.getByText(path, { exact: true }) })
      .click();
    await expect(page.locator(".diff-content")).toContainText(
      "Before every development prompt",
    );
    await expect(page.locator(".diff-content")).toContainText(
      "refine-spec/SKILL.md",
    );
    await expect(page.locator(".diff-content")).toContainText(
      "create-spec/SKILL.md",
    );
    await expect(page.locator(".diff-content")).toContainText(
      "implement-spec/SKILL.md",
    );
    await expect(readFile(join(bootstrap.repo, path))).rejects.toThrow();
  }
  await page.getByRole("button", { name: /Apply \d+ files/ }).click();
  await expect(
    page.getByRole("heading", { name: "Review proposed changes", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Clinic acceptance project",
      exact: true,
    }),
  ).toBeVisible();
  for (const path of instructionPaths)
    expect(await readFile(join(bootstrap.repo, path), "utf8")).toContain(
      "Before every development prompt",
    );
  await expect(page.locator(".agent-card")).toHaveCount(3);
  await page.getByLabel("Search agents", { exact: true }).fill("independently");
  await expect(page.locator(".agent-card")).toHaveCount(1);
  await page.getByLabel("Search agents", { exact: true }).fill("unknown-role");
  await expect(
    page.getByText("No matching agents.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.locator(".agent-card")).toHaveCount(3);
  await expect(
    page.getByLabel("Prompt for Developer", { exact: true }),
  ).toBeVisible();
  const developer = page.getByRole("article", {
    name: "Developer agent",
    exact: true,
  });
  await developer
    .getByRole("button", { name: "Add schedule", exact: true })
    .click();
  await page.getByLabel("Scheduled prompt").fill("Review calculator behavior");
  await page
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await expect(developer).toContainText("Schedule disabled");
  await expect(developer).toContainText("Review calculator behavior");
  await page
    .getByRole("button", { name: "Configure Developer", exact: true })
    .click();
  await page.getByLabel("Time limit (minutes)").fill("45");
  await page.getByRole("button", { name: "Save agent", exact: true }).click();
  await developer.locator("summary").click();
  await expect(developer).toContainText("45 minutes");
  await page.locator(".workspace-skills > summary").click();
  await expect(page.locator(".workspace-skills")).toContainText(
    "analyze-request",
  );
  const group = page
    .locator(".spec-group")
    .filter({ hasText: "onboarding" })
    .first();
  await group.locator(":scope > summary").click();
  await group.getByRole("button").first().click();
  await expect(page.locator(".markdown")).toContainText("Project onboarding");
  await page
    .getByLabel("Prompt", { exact: true })
    .fill("Add a guided setup scenario.");
  await page.getByRole("button", { name: "Send prompt", exact: true }).click();
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await expect(page.locator(".diff-content")).toContainText(
    "Better onboarding",
  );
  await page
    .getByRole("button", { name: "Apply 7 files", exact: true })
    .click();
  await expect(page.locator(".markdown")).toContainText("Better onboarding");
  await page
    .getByRole("button", { name: "Edit document", exact: true })
    .click();
  const editor = page.getByLabel("Specification content");
  await editor.fill((await editor.inputValue()) + "\nReviewed by owner.\n");
  await page.getByRole("button", { name: "Review edit", exact: true }).click();
  await page.getByRole("button", { name: "Apply 1 file", exact: true }).click();
  await page
    .getByRole("button", { name: "Back to project", exact: false })
    .click();
  await page.getByRole("button", { name: "Run history", exact: true }).click();
  await expect(
    page.locator(".run-table-row").filter({ hasText: "Edit onboarding" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to project", exact: false })
    .click();
  await page.setViewportSize({ width: 375, height: 900 });
  for (const summary of await page.locator(".spec-group > summary").all())
    await summary.click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await expect(
    page.getByLabel("Prompt for Developer", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/project-workspace-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("a second project can be set up and browsed without a provider", async ({
  page,
  request,
}) => {
  const bootstrap = await (await request.get("/test/bootstrap")).json();
  await page.route("**/api/state", async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    state.engines = state.engines.map((e: any) => ({ ...e, connected: false }));
    await route.fulfill({ response, json: state });
  });
  await page.goto(`/#token=${bootstrap.token}`);
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Project directory").fill(bootstrap.secondRepo);
  await page.getByLabel("Project name").fill("Second GUI project");
  await page.getByLabel("Default engine").selectOption("codex");
  await page.getByLabel("Analyze existing code and documentation").uncheck();
  await page.getByRole("button", { name: "Inspect & set up" }).click();
  await expect(page.locator(".baseline-review-note")).toBeVisible();
  await page.getByRole("button", { name: /Apply \d+ files/ }).click();
  await expect(
    page.getByRole("heading", { name: "Second GUI project", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".agent-card")).toHaveCount(3);
  await expect(
    page.getByText("No matching specification groups.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "SDD Clinic · Projects", exact: true })
    .click();
  await expect(
    page.locator(".project-card").filter({ hasText: "Second GUI project" }),
  ).toContainText("0 specs · 3 agents · 4 skills");
  await expect(page.locator(".sidebar")).toHaveCount(0);
});

test("Developer prompt continues from reviewed specs to implementation and QA", async ({
  page,
  request,
}) => {
  const bootstrap = await (await request.get("/test/bootstrap")).json();
  await page.goto(`/#token=${bootstrap.token}`);
  await page.getByRole("button", { name: "Connect CLI", exact: true }).click();
  await page
    .locator(".engine-card")
    .filter({
      has: page.getByRole("heading", { name: "Codex CLI", exact: true }),
    })
    .getByRole("button", { name: /Check connection|Check & connect/ })
    .click();
  await page
    .getByRole("button", { name: "SDD Clinic · Projects", exact: true })
    .click();
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Project directory").fill(bootstrap.workflowRepo);
  await page.getByLabel("Project name").fill("Developer flow project");
  await page
    .getByRole("combobox", { name: "Default engine", exact: true })
    .selectOption("codex");
  await page.getByRole("button", { name: "Inspect & set up" }).click();
  await page.getByRole("button", { name: /Apply \d+ files/ }).click();
  await expect(
    page.getByRole("heading", { name: "Developer flow project", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Review proposed changes", exact: true }),
  ).not.toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  const project = state.projects.find(
    (p: any) => p.name === "Developer flow project",
  );
  const data = await (
    await page.request.get(`/api/projects/${project.id}`)
  ).json();
  const configured = await page.request.put(
    `/api/projects/${project.id}/config`,
    {
      data: {
        ...data.config,
        commands: [
          {
            name: "Addition test",
            command: bootstrap.node,
            args: ["check.mts"],
            phase: "check",
          },
        ],
      },
    },
  );
  expect(configured.ok()).toBe(true);
  const composer = page.getByLabel("Prompt for Developer", { exact: true });
  await composer.fill("/help");
  await composer.press("Enter");
  await expect(
    page.getByText("Keyboard shortcuts", { exact: true }),
  ).toBeVisible();
  await composer.fill("Correct addition using the existing specification.");
  await composer.press("Shift+Enter");
  await composer.pressSequentially("Include tests.");
  await expect(composer).toHaveValue(
    "Correct addition using the existing specification.\nInclude tests.",
  );
  await page.getByRole("button", { name: "Connect CLI", exact: true }).click();
  await page
    .getByRole("button", { name: "Back to project", exact: false })
    .click();
  await expect(composer).toHaveValue(
    "Correct addition using the existing specification.\nInclude tests.",
  );
  await composer.dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    isComposing: true,
  });
  await expect(page.locator(".workflow-card")).toHaveCount(0);
  await composer.press("Enter");
  await expect(page.locator(".workflow-card")).toContainText(
    "awaiting review",
    { timeout: 15000 },
  );
  await page.reload();
  await page
    .locator(".project-card")
    .filter({ hasText: "Developer flow project" })
    .getByRole("button", { name: "Open workspace" })
    .click();
  await page
    .getByRole("button", { name: "Review spec diff", exact: true })
    .click();
  await expect(page.locator(".diff-content")).toContainText(
    "The Developer prompt requests correct addition.",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Approve specs & implement", exact: true })
    .click();
  await expect(page.locator(".workflow-card .stage-label")).toHaveText(
    "review",
    { timeout: 25000 },
  );
  const final = await (
    await page.request.get(`/api/projects/${project.id}`)
  ).json();
  const developer = final.runs.find((r: any) => r.kind === "developer");
  const qa = final.runs.find((r: any) => r.kind === "qa");
  expect(developer.status).toBe("completed");
  expect(qa.qa.verdict).toBe("passed");
  expect(qa.specHash).toBeTruthy();
  expect(qa.specHash).toBe(developer.specHash);
  expect(qa.codeRevision).toBe(developer.codeRevision);
  await composer.press("ArrowUp");
  await expect(composer).toHaveValue(
    "Correct addition using the existing specification.\nInclude tests.",
  );
  await composer.press("ArrowDown");
  await expect(composer).toHaveValue("");
  const draft = "Keep this project draft " + "long-content".repeat(80);
  await composer.fill(draft);
  await page.reload();
  await page
    .locator(".project-card")
    .filter({ hasText: "Developer flow project" })
    .getByRole("button", { name: "Open workspace" })
    .click();
  await expect(composer).toHaveValue(draft);
  await page
    .getByRole("button", { name: "SDD Clinic · Projects", exact: true })
    .click();
  await page
    .locator(".project-card")
    .filter({ hasText: "Second GUI project" })
    .getByRole("button", { name: "Open workspace" })
    .click();
  await expect(composer).toHaveValue("");
  await expect(page.locator(".workflow-card")).toHaveCount(0);
  await page
    .getByRole("button", { name: "SDD Clinic · Projects", exact: true })
    .click();
  await page
    .locator(".project-card")
    .filter({ hasText: "Developer flow project" })
    .getByRole("button", { name: "Open workspace" })
    .click();
  await expect(composer).toHaveValue(draft);
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await composer.fill("ASK_QUESTION while testing interruption");
  await composer.press("Enter");
  await expect(page.locator(".workflow-card .stage-label").last()).toHaveText(
    "needs input",
  );
  await expect(
    page.getByRole("button", { name: "Send answer", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".clarification-history").last()).toContainText(
    "Which behavior should change?",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page
    .getByRole("button", { name: "Cancel workflow", exact: true })
    .click();
  await expect(page.locator(".workflow-card .stage-label").last()).toHaveText(
    "canceled",
  );
  await expect(
    page.getByRole("log", { name: "Developer conversation" }),
  ).not.toContainText('"action":"refine"');
});

test("Codex sign-in handles a waiting device challenge, cancellation and completion", async ({
  page,
  request,
}) => {
  const bootstrap = await (await request.get("/test/bootstrap")).json();
  await page.goto(`/#token=${bootstrap.token}`);
  await page.getByRole("button", { name: "Connect CLI", exact: true }).click();
  const card = page.locator(".engine-card").filter({
    has: page.getByRole("heading", { name: "Codex CLI", exact: true }),
  });
  await card
    .getByLabel("Executable", { exact: true })
    .fill(bootstrap.authEngine);
  await card
    .getByRole("button", { name: /Check connection|Check & connect/ })
    .click();
  await expect(card).toContainText("Not connected");
  await writeFile(bootstrap.authMode, "hang");
  await card.getByRole("button", { name: "Sign in with ChatGPT" }).click();
  await expect(card.getByText("TEST-1234", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(
    card.getByRole("link", { name: "Open sign-in page" }),
  ).toHaveAttribute("href", "https://auth.openai.com/codex/device");
  await card
    .getByRole("button", { name: "Cancel sign-in", exact: true })
    .click();
  await expect(card.getByText("TEST-1234", { exact: true })).toHaveCount(0);
  await expect(card).toContainText("Sign-in canceled");
  await writeFile(bootstrap.authMode, "success");
  await card.getByRole("button", { name: "Sign in with ChatGPT" }).click();
  await expect(
    card.getByRole("button", { name: "Check connection", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(card.getByText("TEST-1234", { exact: true })).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Test conversation", exact: false }),
  ).toBeEnabled();
});

test("connection credentials are saved in project chat without entering drafts or model history", async ({
  page,
  request,
}) => {
  const bootstrap = await (await request.get("/test/bootstrap")).json();
  await page.route("**/api/state", async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    state.engines = state.engines.map((engine: any) => ({
      ...engine,
      connected: false,
    }));
    await route.fulfill({ response, json: state });
  });
  await page.goto(`/#token=${bootstrap.token}`);
  const open = async (name: string) =>
    page
      .locator(".project-card")
      .filter({ hasText: name })
      .getByRole("button", { name: "Open workspace" })
      .click();
  await open("Second GUI project");
  const composer = page.getByLabel("Prompt for Developer", { exact: true });
  await composer.focus();
  await page.keyboard.insertText(
    "postgres://reader:browser-secret-only@db.example/app",
  );
  await expect(
    page.getByRole("button", { name: "Save connection", exact: true }),
  ).toBeVisible();
  const storage = () =>
    page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  expect(await storage()).not.toContain("browser-secret-only");
  await composer.fill("browser-secret-only");
  expect(await storage()).not.toContain("browser-secret-only");
  await expect(
    page.getByRole("button", { name: "Save connection", exact: true }),
  ).toBeVisible();
  await composer.fill("postgres://reader:browser-secret-only@db.example/app");
  await page
    .getByRole("combobox", { name: "Connection agent", exact: true })
    .selectOption("developer");
  await page
    .getByRole("button", { name: "Save connection", exact: true })
    .click();
  await expect(composer).toHaveValue("");
  await expect(page.locator(".chat-source")).toHaveCount(1);
  await expect(page.locator(".chat-source")).toContainText("Developer");
  await expect(page.locator(".chat-source")).toContainText("not tested");
  await expect(
    page.getByRole("log", { name: "Developer conversation" }),
  ).not.toContainText("browser-secret-only");
  const state = await (await page.request.get("/api/state")).json();
  const project = state.projects.find(
    (p: any) => p.name === "Second GUI project",
  );
  let data = await (
    await page.request.get(`/api/projects/${project.id}`)
  ).json();
  expect(data.workflows).toHaveLength(0);
  expect(data.runs).toHaveLength(0);
  expect(JSON.stringify(data)).not.toContain("browser-secret-only");
  await page.reload();
  await open("Second GUI project");
  await expect(composer).toHaveValue("");
  await expect(page.locator(".chat-source")).toHaveCount(1);
  await page
    .locator(".chat-source")
    .getByRole("button", { name: "Update", exact: true })
    .click();
  await composer.fill("password: rotated-browser-secret");
  await page
    .getByRole("button", { name: "Save connection", exact: true })
    .click();
  await expect(composer).toHaveValue("");
  await expect(page.locator(".chat-source")).toHaveCount(1);
  await page.getByRole("button", { name: "Connect CLI", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Data & server connections" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add connection" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Back to project", exact: false })
    .click();
  await page.setViewportSize({ width: 375, height: 950 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page
    .locator(".chat-source")
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(page.locator(".chat-source")).toHaveCount(0);
  await composer.fill(`sqlite://${bootstrap.sqlite}`);
  await page
    .getByRole("button", { name: "Save connection", exact: true })
    .click();
  await expect(page.locator(".chat-source")).toHaveCount(1);
  await page
    .locator(".chat-source")
    .getByRole("button", { name: "Test", exact: true })
    .click();
  await expect(page.locator(".chat-source")).toContainText(
    "Connection test passed",
  );
  await page
    .getByRole("button", { name: "SDD Clinic · Projects", exact: true })
    .click();
  await open("Clinic acceptance project");
  await expect(page.locator(".chat-source")).toHaveCount(0);
  await page
    .getByRole("button", { name: "SDD Clinic · Projects", exact: true })
    .click();
  await open("Second GUI project");
  await page
    .locator(".chat-source")
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(page.locator(".chat-source")).toHaveCount(0);
  expect(await storage()).not.toContain("browser-secret");
});

test("project guidance and complete feature folders include related archived documents", async ({
  page,
  request,
}) => {
  const bootstrap = await (await request.get("/test/bootstrap")).json();
  await page.goto(`/#token=${bootstrap.token}`);
  await page
    .locator(".project-card")
    .filter({ hasText: "Clinic acceptance project" })
    .getByRole("button", { name: "Open workspace" })
    .click();
  const guidance = page.getByRole("region", { name: "Project guidance" });
  for (const name of [
    "mission.md",
    "tech-stack.md",
    "roadmap.md",
    "workflow.md",
    "architecture.md",
    "contracts.md",
    "ui-ux.md",
    "operations.md",
    "setup-review.md",
    "baseline-analysis.md",
  ])
    await expect(
      guidance.getByRole("button", {
        name: new RegExp(name.replace(".", "\\.")),
      }),
    ).toBeVisible();
  await guidance.getByRole("button", { name: /mission.md/ }).click();
  await page
    .getByRole("button", { name: "Edit document", exact: true })
    .click();
  await page
    .getByLabel("Specification content")
    .fill(
      "# Reviewed mission\nMake project setup understandable to developers.\n",
    );
  await page.getByRole("button", { name: "Review edit", exact: true }).click();
  await page.getByRole("button", { name: "Apply 1 file", exact: true }).click();
  await expect(page.locator(".markdown")).toContainText("Reviewed mission");
  await page
    .getByRole("button", { name: "Back to project", exact: false })
    .click();
  const capability = page.locator(".spec-group").filter({
    has: page.locator(":scope > summary strong", { hasText: /^onboarding$/ }),
  });
  await capability.locator(":scope > summary").click();
  const history = capability
    .locator(".feature-bundle")
    .filter({ hasText: "2026-10-01-onboarding" });
  await history.locator("summary").click();
  await expect(history.getByRole("button")).toHaveCount(6);
  await history.getByRole("button", { name: /design.md/ }).click();
  await expect(page.locator(".markdown")).toContainText(
    "Archived onboarding design",
  );
  await expect(
    page.getByRole("button", { name: "Edit document", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Back to project", exact: false })
    .click();
  await page.getByRole("button", { name: "New change", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Documentation preview");
  await page.getByLabel("Affected capability").selectOption("onboarding");
  await page
    .getByLabel("Why is this change needed?")
    .fill("Explain the review flow before implementation.");
  await page
    .getByRole("button", { name: "Create proposal", exact: false })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply 7 files", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".diff-content")).toContainText("CLINIC:DRAFT");
  await page
    .getByRole("button", { name: "Apply 7 files", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to project", exact: false })
    .click();
  await capability.locator(":scope > summary").click();
  const feature = capability
    .locator(".feature-bundle")
    .filter({ hasText: "documentation-preview" });
  for (const name of [
    "research.md",
    "proposal.md",
    "spec.md",
    "design.md",
    "validation.md",
    "tasks.md",
  ])
    await expect(
      feature.getByRole("button", {
        name: new RegExp(`^${name.replace(".", "\\.")}`),
      }),
    ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 950 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "test-results/documentation-mobile.png",
    fullPage: true,
  });
});

test("existing project setup analyzes nested code, retains review after reload, and creates capability specs with agent guidance", async ({
  page,
  request,
}) => {
  const bootstrap = await (await request.get("/test/bootstrap")).json();
  await page.goto(`/#token=${bootstrap.token}`);
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  expect(
    (
      await page.request.post("/api/engines/claude/connect", {
        data: { path: bootstrap.engine },
      })
    ).ok(),
  ).toBe(true);
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Project directory").fill(bootstrap.baselineRepo);
  await page.getByLabel("Project name").fill("Existing catalog project");
  await page.getByLabel("Default engine").selectOption("claude");
  await expect(
    page.getByLabel("Analyze existing code and documentation"),
  ).toBeChecked();
  await page.getByRole("button", { name: "Inspect & set up" }).click();
  await expect(
    page.getByRole("heading", { name: "Review proposed changes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("These specs are inferred", { exact: false }),
  ).toBeVisible();
  await page
    .locator(".diff-layout nav button")
    .filter({
      has: page.getByText("openspec/specs/catalog/spec.md", { exact: true }),
    })
    .click();
  await expect(page.locator(".diff-content")).toContainText(
    "Active product listing",
  );
  await expect(
    readFile(join(bootstrap.baselineRepo, "openspec/specs/catalog/spec.md")),
  ).rejects.toThrow();
  await page
    .getByRole("button", { name: "Keep reviewing", exact: true })
    .click();
  await page.reload();
  await page
    .locator(".project-card")
    .filter({ hasText: "Existing catalog project" })
    .getByRole("button", { name: "Open workspace" })
    .click();
  await page
    .getByRole("button", { name: "Review setup proposal", exact: true })
    .click();
  await page
    .locator(".diff-layout nav button")
    .filter({
      has: page.getByText("openspec/project/baseline-analysis.md", {
        exact: true,
      }),
    })
    .click();
  await expect(page.locator(".diff-content")).toContainText(
    "2 eligible text files",
  );
  await expect(page.locator(".diff-content")).toContainText("docs/catalog.md");
  await expect(page.locator(".diff-content")).toContainText(
    "packages/shop/src/features/products/internal/catalog.ts",
  );
  await page.getByRole("button", { name: /Apply \d+ files/ }).click();
  await expect(
    page.getByRole("heading", { name: "Review proposed changes", exact: true }),
  ).not.toBeVisible();
  const catalog = page.locator(".spec-group").filter({
    has: page.locator(":scope > summary strong", { hasText: /^catalog$/ }),
  });
  await catalog.locator(":scope > summary").click();
  await catalog.getByRole("button").first().click();
  await expect(page.locator(".markdown")).toContainText("Inferred baseline");
  await expect(page.locator(".markdown")).toContainText("Empty catalog");
  expect(
    await readFile(join(bootstrap.baselineRepo, "AGENTS.md"), "utf8"),
  ).toContain("Before every development prompt");
  expect(
    await readFile(join(bootstrap.baselineRepo, "CLAUDE.md"), "utf8"),
  ).toContain("create-spec");
  await page
    .getByRole("button", { name: "Back to project", exact: false })
    .click();
  await expect(
    page.getByRole("region", { name: "Existing project analysis" }),
  ).toContainText("Reviewed baseline saved");
  await page.setViewportSize({ width: 375, height: 950 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "test-results/baseline-mobile.png",
    fullPage: true,
  });
});

test("new project prompt and attachments clarify, survive reload, and apply a reviewed SDD package", async ({
  page,
  request,
}) => {
  const b = await (await request.get("/test/bootstrap")).json();
  await page.goto(`/#token=${b.token}`);
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  expect(
    (
      await page.request.post("/api/engines/claude/connect", {
        data: { path: b.engine },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await page
    .getByRole("button", { name: "New project from a brief", exact: true })
    .click();
  await page.getByLabel("Project name", { exact: true }).fill("Prompt catalog");
  await page.getByLabel("Project destination").fill(b.newProjectPath);
  await page.getByLabel("Setup engine").selectOption("claude");
  await page
    .getByLabel("Product prompt")
    .fill("Build an accessible catalog. Use the attached UI/UX guidance.");
  await page
    .getByLabel("Attach product documents or UI/UX references")
    .setInputFiles({
      name: "product.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Product brief\nVisitors can browse products. Use green primary actions.",
      ),
    });
  await expect(
    page.getByText("characters extracted", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Set up SDD", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Product questions" }),
  ).toBeVisible();
  await expect(readFile(join(b.newProjectPath, "AGENTS.md"))).rejects.toThrow();
  await page.reload();
  await page
    .getByRole("button", { name: /Resume setup: Prompt catalog/ })
    .click();
  await expect(
    page.getByText("May guests browse products without signing in?"),
  ).toBeVisible();
  await page
    .getByLabel("Your answers")
    .fill("Yes, guests can browse without an account.");
  await page.getByRole("button", { name: "Send answers", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Review setup package" }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "openspec/specs/catalog/spec.md" })
    .click();
  await expect(
    page.getByRole("region", { name: "Review setup package" }),
  ).toContainText("Guest browsing");
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "test-results/product-setup-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Apply SDD setup", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Prompt catalog", exact: true }),
  ).toBeVisible();
  expect(await readFile(join(b.newProjectPath, "AGENTS.md"), "utf8")).toContain(
    "ask focused questions",
  );
  expect(
    await readFile(join(b.newProjectPath, "openspec/project/ui-ux.md"), "utf8"),
  ).toContain("green");
  await expect(readFile(join(b.newProjectPath, ".git/HEAD"))).rejects.toThrow();
});
