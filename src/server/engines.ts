import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import type {
  EngineAdapter,
  EngineConfig,
  EngineKind,
  EngineProbe,
  EngineRequest,
  EngineResult,
  EngineLoginRequest,
  SetupModel,
} from "../shared/types.js";
import { AppError, assert, cleanEnv, command, errorText } from "./util.js";

type RpcMessage = {
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: { message: string };
};
class JsonProcess {
  child: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  onMessage: (message: RpcMessage) => void = () => {};
  onExit: (error: Error) => void = () => {};
  stderr = "";
  constructor(
    path: string,
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
  ) {
    this.child = spawn(path, args, {
      cwd,
      env,
      stdio: "pipe",
      detached: process.platform !== "win32",
    });
    this.child.stdin.on("error", () => {});
    const lines = createInterface({ input: this.child.stdout });
    lines.on("line", (line) => {
      if (line.length > 2_000_000) {
        this.onExit(
          new AppError("Provider emitted an oversized protocol event."),
        );
        this.close();
        return;
      }
      let msg: RpcMessage;
      try {
        msg = JSON.parse(line);
      } catch {
        this.onExit(
          new AppError("Provider emitted invalid JSON. Check the CLI version."),
        );
        this.close();
        return;
      }
      if (
        typeof msg.id === "number" &&
        !msg.method &&
        this.pending.has(msg.id)
      ) {
        const pending = this.pending.get(msg.id)!;
        clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        msg.error
          ? pending.reject(new AppError(msg.error.message))
          : pending.resolve(msg.result);
      } else this.onMessage(msg);
    });
    this.child.stderr.on("data", (b) => {
      this.stderr = (this.stderr + b.toString()).slice(-16000);
    });
    const exited = (e: Error) => {
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(e);
      }
      this.pending.clear();
      this.onExit(e);
    };
    this.child.on("error", exited);
    this.child.on("close", (code) =>
      exited(
        new AppError(
          `Provider process exited (${code ?? "signal"}). ${errorText(this.stderr).slice(-2000)}`,
        ),
      ),
    );
  }
  send(value: unknown) {
    if (this.child.stdin.writable)
      this.child.stdin.write(JSON.stringify(value) + "\n");
  }
  request(method: string, params: unknown) {
    const id = this.nextId++;
    return new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new AppError(`Provider did not answer ${method}.`));
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }
  close() {
    this.child.stdin.end();
    try {
      if (process.platform !== "win32" && this.child.pid)
        process.kill(-this.child.pid, "SIGTERM");
      else this.child.kill("SIGTERM");
    } catch {}
    const timer = setTimeout(() => {
      try {
        if (process.platform !== "win32" && this.child.pid)
          process.kill(-this.child.pid, "SIGKILL");
        else this.child.kill("SIGKILL");
      } catch {}
    }, 2000);
    timer.unref();
    this.child.once("close", () => clearTimeout(timer));
  }
}

async function probeCommon(
  path: string,
  kind: EngineKind,
): Promise<EngineProbe> {
  try {
    // Public images download separately licensed Claude tooling on first use.
    // Keep a bounded install window; later help/auth probes retain the short timeout.
    const versionTimeout =
      kind === "claude" && process.env.CLINIC_LAZY_CLAUDE === "1"
        ? 180_000
        : 8000;
    const version = await command(path, ["--version"], {
      timeout: versionTimeout,
    });
    if (version.code !== 0)
      return {
        installed: true,
        compatible: false,
        authenticated: null,
        detail: errorText(version.stderr || version.stdout),
        capabilities: [],
      };
    const help = await command(
      path,
      kind === "codex" ? ["app-server", "--help"] : ["--help"],
      { timeout: 8000 },
    );
    const compatible =
      help.code === 0 &&
      (kind === "codex"
        ? /stdio|app-server/.test(help.stdout)
        : /stream-json/.test(help.stdout));
    let authenticated: boolean | null = null,
      detail =
        "CLI found. Authentication status could not be determined; run a connection test.";
    try {
      const auth = await command(
        path,
        kind === "codex" ? ["login", "status"] : ["auth", "status", "--json"],
        { timeout: 8000 },
      );
      if (kind === "codex") {
        authenticated = auth.code === 0;
        detail = authenticated
          ? "Signed in through Codex CLI."
          : process.env.CLINIC_CONTAINER === "1"
            ? "Sign in here, or run docker compose exec clinic codex login --device-auth. Host sign-in is separate from Docker."
            : "Sign in here, or run codex login --device-auth, then check again.";
      } else {
        const data = JSON.parse(auth.stdout);
        authenticated = Boolean(data.loggedIn ?? data.authenticated);
        detail = authenticated
          ? "Claude CLI authentication is configured."
          : process.env.CLINIC_CONTAINER === "1"
            ? "Run docker compose exec clinic claude auth login, then check again. Host sign-in is separate from Docker."
            : "Run claude auth login or configure supported provider credentials.";
      }
    } catch {}
    return {
      installed: true,
      version: version.stdout.trim() || version.stderr.trim(),
      compatible,
      authenticated,
      detail: compatible
        ? detail
        : "This CLI does not expose the required programmatic protocol. Update it and reconnect.",
      capabilities: compatible
        ? ["streaming", "resume", "interrupt", "approvals"]
        : [],
    };
  } catch (e) {
    return {
      installed: false,
      compatible: false,
      authenticated: null,
      detail: `Executable unavailable: ${errorText(e)}. Install ${kind === "codex" ? "Codex" : "Claude"} CLI or select its executable.`,
      capabilities: [],
    };
  }
}

export class CodexAdapter implements EngineAdapter {
  async setupModels(path: string, cwd: string): Promise<SetupModel[]> {
    const proc = new JsonProcess(path, ["app-server"], cwd, cleanEnv());
    try {
      await proc.request("initialize", {
        clientInfo: { name: "sdd_clinic", version: "0.1.0" },
      });
      proc.send({ method: "initialized", params: {} });
      const models: SetupModel[] = [];
      let cursor: string | undefined;
      const seen = new Set<string>();
      do {
        const page = await proc.request("model/list", {
          limit: 100,
          ...(cursor ? { cursor } : {}),
        });
        assert(
          Array.isArray(page.data),
          "Codex returned an invalid model catalog.",
        );
        for (const m of page.data) {
          if (
            !m.hidden &&
            typeof m.model === "string" &&
            Array.isArray(m.supportedReasoningEfforts)
          )
            models.push({
              model: m.model,
              name: m.displayName ?? m.model,
              efforts: m.supportedReasoningEfforts.map(
                (e: { reasoningEffort: string }) => e.reasoningEffort,
              ),
            });
        }
        cursor = page.nextCursor || undefined;
        if (cursor) {
          assert(!seen.has(cursor), "Codex repeated a model catalog page.");
          seen.add(cursor);
        }
      } while (cursor);
      return models;
    } finally {
      proc.close();
    }
  }

  probe(path: string) {
    return probeCommon(path, "codex");
  }
  async login(path: string, request: EngineLoginRequest): Promise<void> {
    const proc = new JsonProcess(
      path,
      ["app-server", "--listen", "stdio://"],
      process.env.HOME ?? process.cwd(),
      cleanEnv(),
    );
    let loginId: string | undefined;
    const notifications: any[] = [];
    let settled = false;
    let resolve!: () => void, reject!: (error: Error) => void;
    const completed = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    // Initialization can fail before the completion notification is awaited.
    void completed.catch(() => {});
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      error ? reject(error) : resolve();
    };
    const acceptCompletion = (value: any) => {
      if (!loginId) {
        notifications.push(value);
        return;
      }
      if (value.loginId && value.loginId !== loginId) return;
      finish(
        value.success
          ? undefined
          : new AppError(
              value.error ||
                "Codex sign-in failed. Try again or check whether device-code login is enabled for your account.",
            ),
      );
    };
    proc.onMessage = (msg) => {
      if (msg.method === "account/login/completed")
        acceptCompletion(msg.params ?? {});
    };
    proc.onExit = (error) => finish(error);
    const abort = () => {
      if (loginId)
        proc.send({
          id: 9999,
          method: "account/login/cancel",
          params: { loginId },
        });
      finish(new AppError("Sign-in canceled."));
      proc.close();
    };
    request.signal.addEventListener("abort", abort, { once: true });
    try {
      if (request.signal.aborted) throw new AppError("Sign-in canceled.");
      await proc.request("initialize", {
        clientInfo: {
          name: "sdd_clinic",
          title: "SDD Clinic",
          version: "0.1.0",
        },
      });
      proc.send({ method: "initialized", params: {} });
      const challenge = await proc.request("account/login/start", {
        type: "chatgptDeviceCode",
      });
      assert(
        challenge.type === "chatgptDeviceCode" &&
          typeof challenge.loginId === "string" &&
          typeof challenge.userCode === "string" &&
          challenge.userCode.length > 0 &&
          challenge.userCode.length <= 64,
        "Codex returned an unsupported sign-in challenge. Update the CLI or use its terminal sign-in.",
      );
      const url = new URL(challenge.verificationUrl);
      assert(
        url.protocol === "https:" &&
          ["auth.openai.com", "chatgpt.com"].includes(url.hostname) &&
          !url.username &&
          !url.password,
        "Codex returned an unexpected sign-in URL.",
      );
      loginId = challenge.loginId;
      request.onChallenge({
        verificationUrl: url.toString(),
        userCode: challenge.userCode,
      });
      for (const notification of notifications) acceptCompletion(notification);
      await completed;
    } finally {
      request.signal.removeEventListener("abort", abort);
      proc.close();
    }
  }
  async run(path: string, r: EngineRequest): Promise<EngineResult> {
    const args = ["app-server", "--listen", "stdio://"];
    const allowed = r.tools ?? ["read"];
    args.push("-c", "mcp_servers={}", "-c", 'web_search="disabled"');
    if (!allowed.includes("command")) {
      args.push(
        "-c",
        "features.shell_tool=false",
        "-c",
        "features.unified_exec=false",
      );
    }
    if (r.mcp)
      args.push(
        "-c",
        `mcp_servers.clinic.url=${JSON.stringify(r.mcp.url)}`,
        "-c",
        'mcp_servers.clinic.bearer_token_env_var="CLINIC_TOOL_TOKEN"',
      );
    const proc = new JsonProcess(path, args, r.cwd, {
      ...cleanEnv(),
      ...(r.mcp ? { CLINIC_TOOL_TOKEN: r.mcp.token } : {}),
    });
    let sessionId = r.sessionId ?? "",
      turnId = "",
      text = "",
      lastMessage = "";
    let completed = false;
    let steps = 0;
    let resolveResult!: (v: EngineResult) => void,
      rejectResult!: (e: Error) => void;
    const result = new Promise<EngineResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    // Attach immediately: a startup failure may precede the initialize response.
    result.catch(() => {});
    const finish = (error?: Error) => {
      if (completed) return;
      completed = true;
      error
        ? rejectResult(error)
        : resolveResult({ text: lastMessage || text, sessionId });
    };
    const abort = () => {
      if (sessionId && turnId)
        proc.send({
          id: "interrupt",
          method: "turn/interrupt",
          params: { threadId: sessionId, turnId },
        });
      finish(new AppError("Run interrupted."));
      proc.close();
    };
    const timer = setTimeout(() => {
      finish(new AppError("Run reached its configured time limit."));
      proc.close();
    }, r.timeoutMs);
    r.signal.addEventListener("abort", abort, { once: true });
    proc.onExit = (e) => finish(e);
    proc.onMessage = (msg) => {
      if (msg.method && msg.id !== undefined) {
        void (async () => {
          const p = msg.params ?? {};
          if (
            (msg.method === "item/commandExecution/requestApproval" &&
              !allowed.includes("command")) ||
            (msg.method === "item/fileChange/requestApproval" &&
              (r.mode === "read-only" || !allowed.includes("edit")))
          ) {
            proc.send({ id: msg.id, result: { decision: "decline" } });
            return;
          }
          if (
            msg.method === "item/permissions/requestApproval" &&
            r.mode === "read-only"
          ) {
            proc.send({
              id: msg.id,
              result: { permissions: {}, scope: "turn" },
            });
            return;
          }
          const question = /requestUserInput|elicitation/.test(msg.method!);
          const decision = await r.onApproval(
            question
              ? "Agent needs your input"
              : (p.command ?? p.reason ?? "Approve tool action"),
            p,
            question ? "question" : "tool",
          );
          let reply: unknown;
          if (msg.method === "item/tool/requestUserInput")
            reply = {
              answers: Object.fromEntries(
                (p.questions ?? []).map((q: any) => [
                  q.id,
                  {
                    answers: [
                      decision.answer ??
                        (decision.approved ? "Approved" : "Declined"),
                    ],
                  },
                ]),
              ),
            };
          else if (msg.method === "mcpServer/elicitation/request") {
            let content: unknown = { answer: decision.answer };
            try {
              content = JSON.parse(decision.answer ?? "{}");
            } catch {}
            reply = {
              action: decision.approved ? "accept" : "decline",
              content: decision.approved ? content : undefined,
            };
          } else if (msg.method === "item/permissions/requestApproval")
            reply = {
              permissions: decision.approved ? (p.permissions ?? {}) : {},
              scope: "turn",
            };
          else if (/requestApproval$/.test(msg.method!))
            reply = { decision: decision.approved ? "accept" : "decline" };
          else {
            proc.send({
              id: msg.id,
              error: { code: -32601, message: "Unsupported server request" },
            });
            return;
          }
          proc.send({ id: msg.id, result: reply });
        })().catch((e) => {
          proc.send({
            id: msg.id,
            error: { code: -32603, message: errorText(e) },
          });
        });
        return;
      }
      const p = msg.params ?? {};
      if (
        msg.method === "item/started" &&
        !["agentMessage", "userMessage", "reasoning", "plan"].includes(
          p.item?.type,
        )
      ) {
        if (++steps > r.maxTurns) {
          finish(new AppError("Run reached its configured tool-step limit."));
          proc.close();
          return;
        }
      }
      if (msg.method === "item/agentMessage/delta") {
        text += p.delta ?? "";
        r.onEvent("message", { delta: p.delta ?? "" });
      } else if (
        msg.method === "item/completed" &&
        p.item?.type === "agentMessage"
      )
        lastMessage = p.item.text ?? lastMessage;
      else if (msg.method === "turn/started") {
        turnId = p.turn?.id ?? turnId;
        r.onEvent("turn", { id: turnId });
      } else if (msg.method === "thread/started") {
        sessionId = p.thread?.id ?? sessionId;
        r.onEvent("session", { id: sessionId });
      } else if (msg.method === "turn/completed") {
        const status = p.turn?.status;
        status === "completed"
          ? finish()
          : finish(
              new AppError(
                p.turn?.error?.message ??
                  `Provider turn ${status ?? "failed"}.`,
              ),
            );
      } else if (msg.method === "thread/tokenUsage/updated")
        r.onEvent("usage", p);
      else if (msg.method === "item/started" || msg.method === "item/completed")
        r.onEvent("tool", p.item ?? p);
      else if (msg.method === "error") r.onEvent("diagnostic", p);
    };
    try {
      if (r.signal.aborted) throw new AppError("Run interrupted.");
      await proc.request("initialize", {
        clientInfo: {
          name: "sdd_clinic",
          title: "SDD Clinic",
          version: "0.1.0",
        },
      });
      proc.send({ method: "initialized", params: {} });
      const params = {
        cwd: r.cwd,
        sandbox: r.mode,
        approvalPolicy: "on-request",
        ...(r.model ? { model: r.model } : {}),
        developerInstructions: r.instructions ?? "",
      };
      const thread = await proc.request(
        sessionId ? "thread/resume" : "thread/start",
        sessionId
          ? { ...params, threadId: sessionId, excludeTurns: true }
          : params,
      );
      sessionId = thread.thread.id;
      r.onEvent("session", { id: sessionId });
      const turn = await proc.request("turn/start", {
        threadId: sessionId,
        ...(r.reasoning ? { effort: r.reasoning } : {}),
        input: [
          { type: "text", text: r.prompt, text_elements: [] },
          ...(r.images ?? []).map((image) => ({
            type: "localImage",
            path: image.path,
          })),
        ],
      });
      turnId = turn.turn.id;
      return await result;
    } finally {
      clearTimeout(timer);
      r.signal.removeEventListener("abort", abort);
      proc.close();
    }
  }
}

export class ClaudeAdapter implements EngineAdapter {
  async setupModels(path: string): Promise<null> {
    const help = await command(path, ["--help"], { timeout: 8000 });
    assert(
      help.code === 0 &&
        /--effort/.test(help.stdout) &&
        /medium/.test(help.stdout),
      "This Claude CLI cannot enforce setup reasoning. Update the runtime before analysis.",
    );
    // Claude CLI does not expose an account-specific model catalog through this adapter.
    return null;
  }

  probe(path: string) {
    return probeCommon(path, "claude");
  }
  async run(path: string, r: EngineRequest): Promise<EngineResult> {
    const imageInput = r.images?.length
      ? JSON.stringify({
          type: "user",
          message: {
            role: "user",
            content: [
              { type: "text", text: r.prompt },
              ...(await Promise.all(
                r.images.map(async (image) => ({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: image.mime,
                    data: (
                      await (
                        await import("node:fs/promises")
                      ).readFile(image.path)
                    ).toString("base64"),
                  },
                })),
              )),
            ],
          },
        }) + "\n"
      : undefined;
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--max-turns",
      String(r.maxTurns),
      "--permission-mode",
      "default",
      "--setting-sources",
      "",
    ];
    if (r.images?.length) args.push("--input-format", "stream-json");
    if (r.sessionId) args.push("--resume", r.sessionId);
    if (r.model) args.push("--model", r.model);
    if (r.reasoning) args.push("--effort", r.reasoning);
    if (r.instructions) args.push("--append-system-prompt", r.instructions);
    const allowed = r.tools ?? ["read"];
    args.push(
      "--tools",
      [
        ...(allowed.includes("read") ? ["Read", "Glob", "Grep"] : []),
        ...(r.mode === "workspace-write" && allowed.includes("edit")
          ? ["Edit", "Write"]
          : []),
        ...(r.mode === "workspace-write" && allowed.includes("command")
          ? ["Bash"]
          : []),
      ].join(","),
    );
    if (r.mcp)
      args.push(
        "--strict-mcp-config",
        "--mcp-config",
        JSON.stringify({
          mcpServers: {
            clinic: {
              type: "http",
              url: r.mcp.url,
              headers: { Authorization: `Bearer ${r.mcp.token}` },
            },
          },
        }),
        "--permission-prompt-tool",
        "mcp__clinic__approve",
      );
    else args.push("--permission-mode", "dontAsk");
    return new Promise<EngineResult>((resolve, reject) => {
      const child = spawn(path, args, {
        cwd: r.cwd,
        env: cleanEnv(),
        stdio: "pipe",
        detached: process.platform !== "win32",
      });
      let sessionId = r.sessionId ?? "",
        text = "",
        stderr = "",
        settled = false,
        sawResult = false;
      const kill = () => {
        try {
          if (process.platform !== "win32" && child.pid)
            process.kill(-child.pid, "SIGTERM");
          else child.kill("SIGTERM");
        } catch {}
        const t = setTimeout(() => {
          try {
            if (process.platform !== "win32" && child.pid)
              process.kill(-child.pid, "SIGKILL");
            else child.kill("SIGKILL");
          } catch {}
        }, 2000);
        t.unref();
        child.once("close", () => clearTimeout(t));
      };
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        r.signal.removeEventListener("abort", abort);
        error ? reject(error) : resolve({ text, sessionId });
        kill();
      };
      const abort = () => finish(new AppError("Run interrupted."));
      const timer = setTimeout(
        () => finish(new AppError("Run reached its configured time limit.")),
        r.timeoutMs,
      );
      r.signal.addEventListener("abort", abort, { once: true });
      child.stdin.on("error", () => {});
      child.stdin.end(imageInput ?? r.prompt);
      child.stderr.on(
        "data",
        (b) => (stderr = (stderr + b.toString()).slice(-16000)),
      );
      createInterface({ input: child.stdout }).on("line", (line) => {
        let msg: any;
        try {
          msg = JSON.parse(line);
        } catch {
          finish(
            new AppError(
              "Claude emitted invalid JSON. Check CLI compatibility.",
            ),
          );
          return;
        }
        if (msg.session_id) {
          sessionId = msg.session_id;
          r.onEvent("session", { id: sessionId });
        }
        if (
          msg.type === "stream_event" &&
          msg.event?.delta?.type === "text_delta"
        ) {
          r.onEvent("message", { delta: msg.event.delta.text });
        } else if (msg.type === "assistant") {
          const content = msg.message?.content ?? [];
          for (const block of content) {
            if (block.type === "text") text = block.text;
            else if (block.type === "tool_use") r.onEvent("tool", block);
          }
        } else if (msg.type === "result") {
          sawResult = true;
          if (msg.is_error || msg.subtype !== "success")
            finish(
              new AppError(
                msg.result ??
                  (msg.errors ?? []).join("\n") ??
                  "Claude run failed.",
              ),
            );
          else {
            text = msg.result ?? text;
            r.onEvent("usage", { usage: msg.usage, cost: msg.total_cost_usd });
            finish();
          }
        } else if (msg.type === "system") r.onEvent("diagnostic", msg);
      });
      child.on("error", (e) => finish(e));
      child.on("close", (code) => {
        if (!sawResult)
          finish(
            new AppError(
              `Claude exited without a successful result (${code}). ${errorText(stderr)}`,
            ),
          );
      });
      if (r.signal.aborted) abort();
    });
  }
}

export const adapters: Record<EngineKind, EngineAdapter> = {
  codex: new CodexAdapter(),
  claude: new ClaudeAdapter(),
};
export async function discoverEngines(): Promise<EngineConfig[]> {
  const codexCandidates = [
    "codex",
    "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
    "/Applications/Codex.app/Contents/Resources/codex",
  ];
  let codex = "codex";
  try {
    const located = await command("which", ["codex"]);
    if (located.code === 0) codex = located.stdout.trim();
    else throw new Error();
  } catch {
    for (const candidate of codexCandidates.slice(1)) {
      try {
        await access(candidate, constants.X_OK);
        codex = candidate;
        break;
      } catch {}
    }
  }
  return [
    { id: "codex", path: codex, connected: false },
    { id: "claude", path: "claude", connected: false },
  ];
}
