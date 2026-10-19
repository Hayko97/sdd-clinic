import type {
  EngineAdapter,
  EngineConfig,
  EngineKind,
  EngineLoginStatus,
} from "../shared/types.js";
import { Store } from "./store.js";
import { assert, errorText } from "./util.js";

type Attempt = {
  state: EngineLoginStatus;
  controller: AbortController;
  timer?: NodeJS.Timeout;
};
export class EngineAuth {
  private attempts = new Map<EngineKind, Attempt>();
  private checking = new Set<EngineKind>();
  private pending = new Set<Promise<void>>();
  constructor(
    readonly store: Store,
    readonly providers: Record<EngineKind, EngineAdapter>,
    readonly timeoutMs = 15 * 60_000,
  ) {}
  status(kind: EngineKind): EngineLoginStatus {
    return this.attempts.get(kind)?.state ?? { status: "idle" };
  }
  private assertIdle(kind: EngineKind) {
    assert(
      !this.checking.has(kind) &&
        !["starting", "waiting"].includes(this.status(kind).status),
      "Sign-in or a connection check is already active. Finish or cancel it before changing the executable.",
      409,
    );
  }
  private save(kind: EngineKind, path: string, probe: EngineConfig["probe"]) {
    return this.store.put<EngineConfig>("engine", {
      id: kind,
      path,
      probe,
      connected: !!(
        probe?.installed &&
        probe.compatible &&
        probe.authenticated === true
      ),
    });
  }
  async connect(kind: EngineKind, path: string) {
    this.assertIdle(kind);
    this.checking.add(kind);
    try {
      return this.save(kind, path, await this.providers[kind].probe(path));
    } finally {
      this.checking.delete(kind);
    }
  }
  start(kind: EngineKind, path: string) {
    this.assertIdle(kind);
    const provider = this.providers[kind];
    assert(
      provider.login,
      "This CLI needs terminal sign-in. Follow the command shown on its connection card.",
    );
    const attempt: Attempt = {
      state: {
        status: "starting",
        path,
        expiresAt: new Date(Date.now() + this.timeoutMs).toISOString(),
      },
      controller: new AbortController(),
    };
    this.attempts.set(kind, attempt);
    const end = (status: EngineLoginStatus["status"], error?: string) => {
      clearTimeout(attempt.timer);
      attempt.state = { status, path, error };
    };
    attempt.timer = setTimeout(() => {
      end("expired", "Sign-in expired. Start a new sign-in attempt.");
      attempt.controller.abort();
    }, this.timeoutMs);
    attempt.timer.unref();
    const job = (async () => {
      try {
        const probe = await provider.probe(path);
        if (attempt.controller.signal.aborted) return;
        assert(probe.installed && probe.compatible, probe.detail);
        this.save(kind, path, probe);
        if (probe.authenticated !== true) {
          await provider.login!(path, {
            signal: attempt.controller.signal,
            onChallenge: (challenge) => {
              if (!attempt.controller.signal.aborted)
                attempt.state = {
                  ...attempt.state,
                  ...challenge,
                  status: "waiting",
                };
            },
          });
        }
        if (attempt.controller.signal.aborted) return;
        const confirmed = await provider.probe(path);
        if (attempt.controller.signal.aborted) return;
        const engine = this.save(kind, path, confirmed);
        assert(
          engine.connected,
          "Sign-in finished but Codex authentication is not confirmed. Check the connection again.",
        );
        end("connected");
      } catch (error) {
        if (!attempt.controller.signal.aborted) end("failed", errorText(error));
      } finally {
        clearTimeout(attempt.timer);
      }
    })();
    this.pending.add(job);
    void job.finally(() => this.pending.delete(job));
    return attempt.state;
  }
  cancel(kind: EngineKind) {
    const attempt = this.attempts.get(kind);
    if (attempt && ["starting", "waiting"].includes(attempt.state.status)) {
      clearTimeout(attempt.timer);
      attempt.state = { status: "canceled", path: attempt.state.path };
      attempt.controller.abort();
    }
    return this.status(kind);
  }
  async close() {
    for (const kind of this.attempts.keys()) this.cancel(kind);
    await Promise.allSettled(this.pending);
    this.attempts.clear();
  }
}
