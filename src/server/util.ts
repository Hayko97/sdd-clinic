import { createHash, randomUUID } from "node:crypto";
import {
  realpath,
  lstat,
  mkdir,
  readFile,
  rename,
  writeFile,
  rm,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new AppError(message, status);
}
export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "change"
  );
}
export function safeName(s: string) {
  assert(
    /^[a-z0-9][a-z0-9-]{0,90}$/.test(s),
    "Invalid change name. Use lowercase letters, numbers, and hyphens.",
  );
  return s;
}
export function inside(root: string, candidate: string) {
  const r = relative(root, candidate);
  return (
    r === "" || (!r.startsWith(`..${sep}`) && r !== ".." && !isAbsolute(r))
  );
}
export async function safePath(root: string, name: string) {
  assert(
    !isAbsolute(name) && !name.includes("\0") && !name.includes("\\"),
    "Expected a relative project path.",
  );
  const base = await realpath(root),
    target = resolve(base, name);
  assert(inside(base, target) && target !== base, "Path escapes the project.");
  let parent = target;
  while (parent !== base) {
    try {
      const st = await lstat(parent);
      assert(
        !st.isSymbolicLink(),
        "Symbolic links are not permitted for managed files.",
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    parent = dirname(parent);
  }
  return target;
}
export async function readOptional(path: string): Promise<string | null> {
  try {
    const st = await lstat(path);
    assert(
      st.isFile() && st.size <= 2_000_000,
      "File is too large or not a regular file.",
    );
    return await readFile(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function atomicWrite(path: string, data: string, mode = 0o600) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${id()}.tmp`;
  try {
    await writeFile(temp, data, { mode });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
}
export function parseJsonOutput(text: string) {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{"),
      end = clean.lastIndexOf("}");
    assert(
      start >= 0 && end > start,
      "The engine did not return a valid structured result. Continue the conversation to request a corrected result.",
    );
    return JSON.parse(clean.slice(start, end + 1));
  }
}
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /password|passwd|secret|token|api.?key|authorization|private.?key/i.test(
          k,
        )
          ? "[REDACTED]"
          : redact(v),
      ]),
    );
  if (typeof value !== "string")
    return typeof value === "bigint" ? value.toString() : value;
  return value
    .replace(
      /-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/g,
      "[REDACTED PRIVATE KEY]",
    )
    .replace(
      /(["']?(?:[\w-]*[_-])?(?:password|passwd|secret|token|api[_-]?key|authorization)["']?\s*[=:]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:Bearer\s+)?[^\s,;}]+)/gi,
      "$1[REDACTED]",
    )
    .replace(/(\w+:\/\/[^\s:/]+:)[^\s@]+@/g, "$1[REDACTED]@")
    .replace(
      /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,})\b/g,
      "[REDACTED]",
    );
}
export const errorText = (e: unknown) =>
  String(redact(e instanceof Error ? e.message : String(e)));
export function cleanEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([k, v]) =>
        v !== undefined &&
        /^(PATH|HOME|USER|LOGNAME|SHELL|LANG|LC_.*|TMPDIR|TEMP|TMP|SYSTEMROOT|COMSPEC|CODEX_HOME|ANTHROPIC_API_KEY|OPENAI_API_KEY|CODEX_API_KEY|SSH_AUTH_SOCK)$/.test(
          k,
        ),
    ),
  ) as NodeJS.ProcessEnv;
}
export async function command(
  executable: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    signal?: AbortSignal;
    env?: NodeJS.ProcessEnv;
    maxOutput?: number;
  } = {},
) {
  return await new Promise<{ stdout: string; stderr: string; code: number }>(
    (resolveResult, reject) => {
      const child = spawn(executable, args, {
        cwd: options.cwd,
        env: options.env ?? cleanEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });
      let stdout = "",
        stderr = "",
        settled = false;
      const limit = options.maxOutput ?? 2_000_000;
      const stop = () => {
        try {
          if (process.platform !== "win32" && child.pid)
            process.kill(-child.pid, "SIGTERM");
          else child.kill("SIGTERM");
        } catch {}
      };
      const finish = (error?: Error, code = -1) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        error ? reject(error) : resolveResult({ stdout, stderr, code });
      };
      const abort = () => {
        stop();
        finish(new AppError("Command interrupted."));
      };
      const timer = setTimeout(() => {
        stop();
        finish(new AppError(`Command timed out: ${executable}`));
      }, options.timeout ?? 30000);
      child.stdout.on("data", (b) => {
        stdout += b.toString();
        if (stdout.length > limit) {
          stop();
          finish(new AppError("Command output exceeded the configured limit."));
        }
      });
      child.stderr.on("data", (b) => {
        stderr = (stderr + b.toString()).slice(-limit);
      });
      child.on("error", (e) => finish(e));
      child.on("close", (code) => finish(undefined, code ?? -1));
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) abort();
    },
  );
}
export class KeyLock {
  private held = new Set<string>();
  async with<T>(key: string, task: () => Promise<T>): Promise<T> {
    assert(
      !this.held.has(key),
      "Another operation is modifying this resource. Try again shortly.",
      409,
    );
    this.held.add(key);
    try {
      return await task();
    } finally {
      this.held.delete(key);
    }
  }
}
